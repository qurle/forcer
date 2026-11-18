import type { CollectionInfo, FieldState, Prefs, SelectionInfo, ToCode, ToUI, VarItem } from '../shared/types'

export interface VarsEntry {
	items: VarItem[]
	pending: number
	error?: string
}

export const app = $state({
	selection: null as SelectionInfo | null,
	collections: [] as CollectionInfo[],
	collectionsLoading: true,
	collectionsError: '',
	vars: {} as Record<string, VarsEntry>,
	prefs: { lastCollection: {} } as Prefs,
	/** Field the picker is open for */
	picker: null as FieldState | null,
	/** Human context for the picker title, e.g. "Padding · Top" */
	pickerContext: '',
	busy: false,
	/** Collapsed state per group id, kept across selection changes */
	collapsed: { more: true } as Record<string, boolean>,
})

export function post(msg: ToCode) {
	parent.postMessage({ pluginMessage: msg }, '*')
}

function findField(sel: SelectionInfo, key: string): FieldState | null {
	for (const g of sel.groups) for (const s of g.sections) for (const f of s.fields) if (f.key === key) return f
	return null
}

window.addEventListener('message', event => {
	const msg = event.data?.pluginMessage as ToUI | undefined
	if (!msg) return
	switch (msg.type) {
		case 'selection':
			app.selection = msg.data
			// Keep the picker pointed at the same field, close it if the field is gone
			if (app.picker) app.picker = findField(msg.data, app.picker.key)
			break
		case 'collections':
			app.collections = msg.items
			app.collectionsLoading = msg.loading
			app.collectionsError = msg.error ?? ''
			break
		case 'variables':
			app.vars[msg.collectionId] = { items: msg.items, pending: msg.pending, error: msg.error }
			break
		case 'prefs':
			app.prefs = msg.prefs
			break
		case 'busy':
			app.busy = msg.busy
			break
	}
})

// ---------- Formatting helpers ----------

export const leaf = (name: string) => name.slice(name.lastIndexOf('/') + 1)
export const path = (name: string) => (name.includes('/') ? name.slice(0, name.lastIndexOf('/') + 1) : '')

export function formatNum(v: number, unit?: string) {
	return `${Number.isInteger(v) ? v : v.toFixed(2).replace(/0+$/, '')}${unit ?? ''}`
}

export function inScope(scopes: VariableScope[], req: VariableScope[][]) {
	if (!req.length || scopes.includes('ALL_SCOPES')) return true
	return req.every(alts => alts.some(s => scopes.includes(s)))
}

export function isBoundTo(field: FieldState, item: VarItem) {
	const b = field.bound
	if (!b || b === 'mixed') return false
	return item.ref === `local:${b.id}` || (!!b.key && item.ref === `lib:${b.key}`)
}
