// Variable catalog: local + library collections, lazy per-collection loading, import cache
import type { CollectionInfo, Preview, ToUI, VarItem, VarType } from '../shared/types'
import { toHex } from './fields'
import { load, save } from './storage'

type Post = (msg: ToUI) => void

const SUPPORTED = new Set<string>(['COLOR', 'FLOAT', 'BOOLEAN'])
const K_COLLECTIONS = 'forcer:collections:v1'
const K_META = (collectionKey: string) => `forcer:meta:v1:${collectionKey}`
/** Scopes and previews of library variables are cached this long before being re-read */
const META_TTL = 12 * 60 * 60 * 1000
const IMPORT_CONCURRENCY = 8
const POST_THROTTLE = 300

interface MetaEntry { scopes: VariableScope[]; preview: Preview | null; t: number }
interface Meta { vars: Record<string, MetaEntry> }

const imports = new Map<string, Promise<Variable>>()
const collections = new Map<string, Promise<VariableCollection | null>>()

// ---------- Primitive caches ----------

export function getCollection(id: string) {
	let p = collections.get(id)
	if (!p) {
		p = figma.variables.getVariableCollectionByIdAsync(id)
		collections.set(id, p)
	}
	return p
}

export function importByKey(key: string): Promise<Variable> {
	let p = imports.get(key)
	if (!p) {
		p = figma.variables.importVariableByKeyAsync(key)
		imports.set(key, p)
		p.catch(() => imports.delete(key))
	}
	return p
}

/** `local:<id>` or `lib:<key>` → Variable */
export async function resolveRef(ref: string): Promise<Variable> {
	if (ref.startsWith('local:')) {
		const v = await figma.variables.getVariableByIdAsync(ref.slice(6))
		if (!v) throw new Error('Variable not found, it may have been deleted')
		return v
	}
	try {
		return await importByKey(ref.slice(4))
	} catch {
		throw new Error('Couldn’t import the variable. Is the library change published?')
	}
}

function toPreview(raw: VariableValue, type: VariableResolvedDataType): Preview | null {
	if (type === 'COLOR' && raw && typeof raw === 'object' && 'r' in raw) {
		const c = raw as RGBA
		return { t: 'color', hex: toHex(c), a: c.a ?? 1 }
	}
	if (type === 'FLOAT' && typeof raw === 'number') return { t: 'num', v: Math.round(raw * 100) / 100 }
	if (type === 'BOOLEAN' && typeof raw === 'boolean') return { t: 'bool', v: raw }
	return null
}

/** Value in the default mode, following aliases */
export async function previewOf(v: Variable, depth = 0): Promise<Preview | null> {
	const col = await getCollection(v.variableCollectionId)
	const modes = Object.keys(v.valuesByMode)
	const modeId = col && v.valuesByMode[col.defaultModeId] !== undefined ? col.defaultModeId : modes[0]
	const raw = v.valuesByMode[modeId]
	if (raw && typeof raw === 'object' && (raw as VariableAlias).type === 'VARIABLE_ALIAS') {
		if (depth > 8) return null
		const target = await figma.variables.getVariableByIdAsync((raw as VariableAlias).id)
		return target ? previewOf(target, depth + 1) : null
	}
	return toPreview(raw, v.resolvedType)
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
	let i = 0
	const worker = async () => {
		while (i < items.length) await fn(items[i++])
	}
	await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
}

// ---------- Collections ----------

async function localCollections(): Promise<CollectionInfo[]> {
	const cols = await figma.variables.getLocalVariableCollectionsAsync()
	return cols
		.filter(c => c.variableIds.length > 0)
		.map(c => ({ id: `local:${c.id}`, name: c.name, library: 'This file', source: 'local' as const }))
}

/**
 * Posts collections twice: instantly with the cached library list, then again once
 * the (slow, ~2s) team library request returns.
 */
export async function sendCollections(post: Post) {
	const local = await localCollections()
	const cached = await load<{ items: CollectionInfo[] }>(K_COLLECTIONS)
	post({ type: 'collections', items: [...local, ...(cached?.items ?? [])], loading: true })
	try {
		const lib = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()
		const items: CollectionInfo[] = lib.map(c => ({ id: `lib:${c.key}`, name: c.name, library: c.libraryName, source: 'library' }))
		await save(K_COLLECTIONS, { items, t: Date.now() })
		post({ type: 'collections', items: [...local, ...items], loading: false })
	} catch (e: any) {
		post({ type: 'collections', items: [...local, ...(cached?.items ?? [])], loading: false, error: `Libraries unavailable: ${e?.message ?? e}` })
	}
}

// ---------- Variables ----------

let loadToken = 0
const metaMemory = new Map<string, Meta>()

/**
 * Posts the variables of one collection. Library variables are listed instantly
 * (name + type only), then imported in the background to learn scopes and values.
 * Starting another load cancels the background work of the previous one.
 */
export async function loadVariables(collectionId: string, post: Post) {
	const token = ++loadToken
	try {
		if (collectionId.startsWith('local:')) return await loadLocal(collectionId, post)
		await loadLibrary(collectionId, token, post)
	} catch (e: any) {
		post({ type: 'variables', collectionId, items: [], pending: 0, error: String(e?.message ?? e) })
	}
}

async function loadLocal(collectionId: string, post: Post) {
	const col = await figma.variables.getVariableCollectionByIdAsync(collectionId.slice(6))
	if (!col) throw new Error('Collection not found')
	const vars = await Promise.all(col.variableIds.map(id => figma.variables.getVariableByIdAsync(id)))
	const items = await Promise.all(
		vars
			.filter((v): v is Variable => !!v && SUPPORTED.has(v.resolvedType))
			.map(async v => ({ ref: `local:${v.id}`, name: v.name, type: v.resolvedType as VarType, scopes: v.scopes.slice(), preview: await previewOf(v) })),
	)
	post({ type: 'variables', collectionId, items, pending: 0 })
}

async function loadLibrary(collectionId: string, token: number, post: Post) {
	const key = collectionId.slice(4)
	const list = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(key)
	// Shared in-memory object so a restarted load sees progress of a cancelled one
	let meta = metaMemory.get(key)
	if (!meta) {
		meta = (await load<Meta>(K_META(key))) ?? { vars: {} }
		metaMemory.set(key, meta)
	}
	const now = Date.now()

	const items: VarItem[] = list
		.filter(v => SUPPORTED.has(v.resolvedType))
		.map(v => {
			const m = meta.vars[v.key]
			return { ref: `lib:${v.key}`, name: v.name, type: v.resolvedType as VarType, scopes: m ? m.scopes : null, preview: m ? m.preview : null }
		})

	const todo = items.filter(i => {
		const m = meta.vars[i.ref.slice(4)]
		return !m || now - m.t > META_TTL
	})
	let pending = todo.length
	post({ type: 'variables', collectionId, items, pending })
	if (!todo.length) return

	let lastPost = Date.now()
	const flush = (force = false) => {
		if (!force && Date.now() - lastPost < POST_THROTTLE) return
		lastPost = Date.now()
		post({ type: 'variables', collectionId, items: items.slice(), pending })
	}

	const vars = meta.vars
	await pool(todo, IMPORT_CONCURRENCY, async item => {
		if (token !== loadToken) return
		const varKey = item.ref.slice(4)
		try {
			const v = await importByKey(varKey)
			item.scopes = v.scopes.slice()
			item.preview = await previewOf(v)
			vars[varKey] = { scopes: item.scopes, preview: item.preview, t: Date.now() }
		} catch {
			// Not importable (e.g. unpublished). Leave scopes unknown; binding will report the error.
		}
		pending--
		flush()
	})

	// Drop cache entries of variables no longer in the library, then persist
	const alive = new Set(list.map(v => v.key))
	for (const k of Object.keys(meta.vars)) if (!alive.has(k)) delete meta.vars[k]
	await save(K_META(key), meta)
	if (token === loadToken) flush(true)
}
