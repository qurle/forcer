// Types shared by the main thread (src/code) and the UI (src/ui)

export type VarType = 'COLOR' | 'FLOAT' | 'BOOLEAN'

/** A current field value, ready for display */
export type Display =
	| { t: 'num'; v: number; unit?: '%' }
	| { t: 'color'; hex: string; a: number }
	| { t: 'bool'; v: boolean }
	| { t: 'auto' }
	| { t: 'none' }
	| { t: 'mixed' }

/** A variable bound to a field */
export interface VarRef {
	id: string
	key: string
	name: string
	collection: string
	remote: boolean
	missing?: boolean
}

/** Icons used as input prefixes, drawn by src/ui/components/Icon.svelte */
export type Glyph =
	| 'gap-h' | 'gap-v' | 'gap-row' | 'gap-col'
	| 'pad-t' | 'pad-r' | 'pad-b' | 'pad-l' | 'pad-x' | 'pad-y'
	| 'side-t' | 'side-r' | 'side-b' | 'side-l'
	| 'min-w' | 'max-w' | 'min-h' | 'max-h'
	| 'radius' | 'corner-tl' | 'corner-tr' | 'corner-br' | 'corner-bl'
	| 'stroke-weight' | 'opacity' | 'eye' | 'blur' | 'spread'
	| 'grid-count' | 'grid-size' | 'grid-gutter' | 'grid-offset'

/** What sits at the start of an input instead of a label, as in Figma: a letter (W, H, X) or an icon */
export type Prefix = { text: string } | { icon: Glyph }

export interface FieldState {
	/** Opaque address of the field, see src/code/fields.ts */
	key: string
	/** Full name, used for tooltips and the picker title */
	label: string
	prefix?: Prefix
	/** Short caption shown before the input, e.g. a gradient stop position */
	aside?: string
	type: VarType
	/**
	 * Scopes that make a variable "in scope" for this field:
	 * every inner list must be satisfied by at least one of its scopes. Empty = no scope rules.
	 */
	scopeReq: VariableScope[][]
	value: Display
	bound: VarRef | 'mixed' | null
}

export interface Section {
	title?: string
	note?: string
	/** Hidden paint or effect, shown dimmed */
	dim?: boolean
	/**
	 * How many leading fields are always visible. The rest (min/max sizes, individual corners,
	 * sides or paddings) are revealed with a chevron right after the last visible field.
	 * Unset: everything is visible.
	 */
	shown?: number
	/** What the chevron reveals, e.g. "individual corners" */
	more?: string
	fields: FieldState[]
}

export type StyleKind = 'fill' | 'stroke' | 'effect' | 'grid'

export interface StyleInfo {
	kind: StyleKind
	name: string
	mixed: boolean
}

export interface GroupState {
	id: string
	label: string
	styles?: StyleInfo[]
	notice?: string
	sections: Section[]
}

export interface SelectionInfo {
	count: number
	title: string
	subtitle: string
	instance: boolean
	/** Set when only the first N layers were read for display */
	readLimit: number | null
	groups: GroupState[]
}

export type Preview = { t: 'color'; hex: string; a: number } | { t: 'num'; v: number } | { t: 'bool'; v: boolean }

export interface CollectionInfo {
	id: string
	name: string
	library: string
	source: 'local' | 'library'
}

export interface VarItem {
	/** `local:<variableId>` or `lib:<variableKey>` */
	ref: string
	name: string
	type: VarType
	/** null until the variable was imported and its scopes are known */
	scopes: VariableScope[] | null
	preview: Preview | null
}

export interface Prefs {
	lastCollection: Partial<Record<VarType, string>>
}

export type ToCode =
	| { type: 'ready' }
	| { type: 'load-variables'; collectionId: string }
	| { type: 'refresh-collections' }
	| { type: 'bind'; field: string; ref: string }
	| { type: 'unbind'; field: string }
	| { type: 'detach-style'; kind: StyleKind }
	| { type: 'save-prefs'; prefs: Prefs }
	| { type: 'resize'; width: number; height: number; save?: boolean }
	| { type: 'reset-size' }

export type ToUI =
	| { type: 'selection'; data: SelectionInfo }
	| { type: 'collections'; items: CollectionInfo[]; loading: boolean; error?: string }
	| { type: 'variables'; collectionId: string; items: VarItem[]; pending: number; error?: string }
	| { type: 'prefs'; prefs: Prefs }
	| { type: 'busy'; busy: boolean }
