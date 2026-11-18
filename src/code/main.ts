import type { Prefs, ToCode, ToUI } from '../shared/types'
import { analyze } from './selection'
import { loadVariables, resolveRef, sendCollections } from './catalog'
import { applyBinding, detachStyle, type ApplyResult } from './apply'
import { load, save } from './storage'

const K_PREFS = 'forcer:prefs:v1'
const K_SIZE = 'forcer:size:v1'

// Window size: resizable from the corner dragger, remembered between launches
const SIZE = { width: 280, height: 560, minWidth: 240, minHeight: 240, maxWidth: 800, maxHeight: 1400 }
const clampSize = (w: number, h: number) => ({
	width: Math.round(Math.min(SIZE.maxWidth, Math.max(SIZE.minWidth, w || SIZE.width))),
	height: Math.round(Math.min(SIZE.maxHeight, Math.max(SIZE.minHeight, h || SIZE.height))),
})

figma.showUI(__html__, { themeColors: true, width: SIZE.width, height: SIZE.height })
load<{ width: number; height: number }>(K_SIZE).then(saved => {
	if (!saved) return
	const { width, height } = clampSize(saved.width, saved.height)
	if (width !== SIZE.width || height !== SIZE.height) figma.ui.resize(width, height)
})

const post = (msg: ToUI) => figma.ui.postMessage(msg)

let notification: NotificationHandler | null = null
function notify(message: string, error = false) {
	notification?.cancel()
	notification = figma.notify(message, { error, timeout: error ? 6000 : 3000 })
}

// ---------- Selection tracking ----------

let token = 0
let timer: ReturnType<typeof setTimeout> | undefined

async function refresh() {
	const t = ++token
	try {
		const data = await analyze()
		if (t === token) post({ type: 'selection', data })
	} catch (e) {
		console.error('[forcer] analyze failed', e)
	}
}

function schedule(delay = 120) {
	if (timer) clearTimeout(timer)
	timer = setTimeout(refresh, delay)
}

let page = figma.currentPage
const onNodeChange = () => schedule(200)
page.on('nodechange', onNodeChange)
figma.on('selectionchange', () => schedule())
figma.on('currentpagechange', () => {
	page.off('nodechange', onNodeChange)
	page = figma.currentPage
	page.on('nodechange', onNodeChange)
	schedule(0)
})

// ---------- Messages ----------

function report(res: ApplyResult, verb: string) {
	if (!res.failed.length) {
		notify(res.ok ? `${verb} on ${res.ok} layer${res.ok === 1 ? '' : 's'}` : 'Nothing changed')
		return
	}
	const first = res.failed[0]
	const more = res.failed.length > 1 ? ` (+${res.failed.length - 1} more)` : ''
	notify(`${verb} on ${res.ok}, skipped ${res.failed.length}: “${first.name}” ${first.reason}${more}`, res.ok === 0)
	console.warn('[forcer] skipped layers', res.failed)
}

async function busy<T>(fn: () => Promise<T>) {
	post({ type: 'busy', busy: true })
	try {
		return await fn()
	} catch (e: any) {
		notify(String(e?.message ?? e), true)
	} finally {
		post({ type: 'busy', busy: false })
		schedule(0)
	}
}

figma.ui.onmessage = async (msg: ToCode) => {
	switch (msg.type) {
		case 'ready': {
			const prefs = (await load<Prefs>(K_PREFS)) ?? { lastCollection: {} }
			post({ type: 'prefs', prefs })
			schedule(0)
			sendCollections(post)
			break
		}
		case 'refresh-collections':
			sendCollections(post)
			break
		case 'load-variables':
			loadVariables(msg.collectionId, post)
			break
		case 'save-prefs':
			save(K_PREFS, msg.prefs)
			break
		case 'resize': {
			const { width, height } = clampSize(msg.width, msg.height)
			figma.ui.resize(width, height)
			if (msg.save) save(K_SIZE, { width, height })
			break
		}
		case 'reset-size':
			figma.ui.resize(SIZE.width, SIZE.height)
			save(K_SIZE, null)
			break
		case 'bind':
			await busy(async () => {
				const v = await resolveRef(msg.ref)
				report(await applyBinding(msg.field, v), `Bound ${v.name}`)
			})
			break
		case 'unbind':
			await busy(async () => report(await applyBinding(msg.field, null), 'Detached variable'))
			break
		case 'detach-style':
			await busy(async () => report(await detachStyle(msg.kind), 'Detached style'))
			break
	}
}
