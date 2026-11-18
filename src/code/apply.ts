// Applying bindings and detaching styles across the whole selection
import type { StyleKind } from '../shared/types'
import { decode, requiredType, writeField } from './fields'

export interface ApplyResult {
	ok: number
	failed: { name: string; reason: string }[]
}

const CHUNK = 40
const breathe = () => new Promise(resolve => setTimeout(resolve, 0))
const TYPE_NAME = { COLOR: 'color', FLOAT: 'number', BOOLEAN: 'boolean' }
const reason = (e: unknown) => String((e as Error)?.message ?? e).replace(/^in \w+: /, '')

/** Groups everything since the last commit into one undo step. Never let it break an apply. */
function commitUndo() {
	try {
		figma.commitUndo()
	} catch {
		// Not available in every environment
	}
}

/** Binds `v` (or unbinds when null) to `fieldKey` on every selected layer. One undo step. */
export async function applyBinding(fieldKey: string, v: Variable | null): Promise<ApplyResult> {
	const addr = decode(fieldKey)
	if (v) {
		const need = requiredType(addr)
		if (v.resolvedType !== need) throw new Error(`This field needs a ${TYPE_NAME[need]} variable`)
	}
	// Snapshot: selection may change while we yield between chunks
	const nodes = figma.currentPage.selection.slice()
	const res: ApplyResult = { ok: 0, failed: [] }
	for (let i = 0; i < nodes.length; i++) {
		const n = nodes[i]
		try {
			if (n.removed) throw new Error('layer was removed')
			writeField(n, addr, v)
			res.ok++
		} catch (e) {
			res.failed.push({ name: n.name, reason: reason(e) })
		}
		if (i % CHUNK === CHUNK - 1) await breathe()
	}
	commitUndo()
	return res
}

const SETTER: Record<StyleKind, [string, string]> = {
	fill: ['fillStyleId', 'setFillStyleIdAsync'],
	stroke: ['strokeStyleId', 'setStrokeStyleIdAsync'],
	effect: ['effectStyleId', 'setEffectStyleIdAsync'],
	grid: ['gridStyleId', 'setGridStyleIdAsync'],
}

/** Detaches a style from every selected layer that has it, keeping the current values */
export async function detachStyle(kind: StyleKind): Promise<ApplyResult> {
	const [prop, setter] = SETTER[kind]
	const nodes = figma.currentPage.selection.slice()
	const res: ApplyResult = { ok: 0, failed: [] }
	for (const n of nodes as any[]) {
		const id = n[prop]
		if (id === undefined || id === '') continue
		try {
			await n[setter]('')
			res.ok++
		} catch (e) {
			res.failed.push({ name: n.name, reason: reason(e) })
		}
	}
	commitUndo()
	return res
}
