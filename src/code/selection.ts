// Selection analysis: which fields can be bound on all selected layers, with current values
import type { Display, FieldState, Glyph, GroupState, Prefix, Section, SelectionInfo, StyleInfo, StyleKind, VarRef, VarType } from '../shared/types'
import { type Addr, type Bound, MIXED, encode, isFrameLike, readField, requiredType, effectSupports, gridSupports } from './fields'
import { getCollection } from './catalog'

/** Values are read from at most this many layers; binding still applies to the whole selection */
export const READ_LIMIT = 50

type Req = VariableScope[][]
const R = {
	size: [['WIDTH_HEIGHT']] as Req,
	gap: [['GAP']] as Req,
	radius: [['CORNER_RADIUS']] as Req,
	strokeWeight: [['STROKE_FLOAT']] as Req,
	strokeColor: [['STROKE_COLOR']] as Req,
	effectColor: [['EFFECT_COLOR']] as Req,
	effectFloat: [['EFFECT_FLOAT']] as Req,
	opacity: [['OPACITY']] as Req,
	none: [] as Req,
}

function fillReq(nodes: readonly SceneNode[]): Req {
	const req: Req = []
	const add = (s: VariableScope) => { if (!req.some(r => r[1] === s)) req.push(['ALL_FILLS', s]) }
	for (const n of nodes) add(n.type === 'TEXT' ? 'TEXT_FILL' : isFrameLike(n) ? 'FRAME_FILL' : 'SHAPE_FILL')
	return req
}

interface RawField extends Omit<FieldState, 'bound'> { boundId: Bound }

const TYPE_LABEL: Record<string, string> = {
	FRAME: 'Frame', COMPONENT: 'Component', COMPONENT_SET: 'Component set', INSTANCE: 'Instance', TEXT: 'Text',
	RECTANGLE: 'Rectangle', ELLIPSE: 'Ellipse', POLYGON: 'Polygon', STAR: 'Star', LINE: 'Line', VECTOR: 'Vector',
	GROUP: 'Group', BOOLEAN_OPERATION: 'Boolean', SECTION: 'Section',
}

const PAINT_LABEL: Record<string, string> = {
	SOLID: 'Solid', GRADIENT_LINEAR: 'Linear gradient', GRADIENT_RADIAL: 'Radial gradient',
	GRADIENT_ANGULAR: 'Angular gradient', GRADIENT_DIAMOND: 'Diamond gradient', IMAGE: 'Image', VIDEO: 'Video', PATTERN: 'Pattern',
}

const EFFECT_LABEL: Record<string, string> = {
	DROP_SHADOW: 'Drop shadow', INNER_SHADOW: 'Inner shadow', LAYER_BLUR: 'Layer blur', BACKGROUND_BLUR: 'Background blur',
	NOISE: 'Noise', TEXTURE: 'Texture', GLASS: 'Glass',
}

const paintSig = (p: Paint) => p.type + ('gradientStops' in p ? `:${p.gradientStops.length}` : '')
const effectSig = (e: Effect) => e.type + ('blurType' in e ? `:${(e as BlurEffect).blurType}` : '')
const gridSig = (g: LayoutGrid) => g.pattern + ('alignment' in g ? `:${g.alignment}` : '')

export async function analyze(): Promise<SelectionInfo> {
	const all = figma.currentPage.selection
	if (!all.length) return { count: 0, title: '', subtitle: '', instance: false, readLimit: null, groups: [] }
	const nodes = all.slice(0, READ_LIMIT)
	type RawSection = Omit<Section, 'fields'> & { fields: RawField[] }
	const raw: { id: string; label: string; styles?: StyleInfo[]; notice?: string; sections: RawSection[] }[] = []

	/** Builds a field if it applies to every read node, aggregating value and binding */
	const field = (addr: Addr, label: string, scopeReq: Req, prefix?: Prefix | Glyph, aside?: string): RawField | null => {
		const type: VarType = requiredType(addr)
		let value: Display | undefined
		let valueKey = ''
		let boundId: Bound | undefined
		for (const n of nodes) {
			const r = readField(n, addr)
			if (!r) return null
			const k = JSON.stringify(r.value)
			if (value === undefined) { value = r.value; valueKey = k }
			else if (k !== valueKey) value = { t: 'mixed' }
			if (boundId === undefined) boundId = r.bound
			else if (boundId !== r.bound) boundId = MIXED
		}
		const pre = typeof prefix === 'string' ? { icon: prefix } : prefix
		return { key: encode(addr), label, prefix: pre, aside, type, scopeReq, value: value!, boundId: boundId ?? null }
	}
	const fields = (...list: (RawField | null)[]) => list.filter((f): f is RawField => !!f)
	const every = (prop: string) => nodes.every(n => prop in n)

	const T = (text: string): Prefix => ({ text })

	/** Leading fields stay visible, the rest hide behind a chevron. Falls back to showing all if a leading field is missing */
	const expandable = (list: RawField[], lead: string[], more: string): RawSection => {
		const shown = list.filter(f => lead.includes(f.key)).length
		const ordered = [...list.filter(f => lead.includes(f.key)), ...list.filter(f => !lead.includes(f.key))]
		return shown && shown < list.length ? { fields: ordered, shown, more } : { fields: list }
	}

	// --- Size: width and height, min/max on demand
	// Ordered for a two-column grid: width-like fields on the left, height-like on the right
	const size = fields(
		field({ k: 'node', f: 'width' }, 'Width', R.size, T('W')),
		field({ k: 'node', f: 'height' }, 'Height', R.size, T('H')),
		field({ k: 'node', f: 'minWidth' }, 'Min width', R.size, 'min-w'),
		field({ k: 'node', f: 'minHeight' }, 'Min height', R.size, 'min-h'),
		field({ k: 'node', f: 'maxWidth' }, 'Max width', R.size, 'max-w'),
		field({ k: 'node', f: 'maxHeight' }, 'Max height', R.size, 'max-h'),
	)
	if (size.length) raw.push({ id: 'size', label: 'Size', sections: [expandable(size, ['node:width', 'node:height'], 'min and max size')] })

	// --- Layout: gaps, padding pairs with individual sides on demand
	const layout: RawSection[] = []
	const gaps = fields(
		field({ k: 'node', f: 'itemSpacing' }, 'Gap', R.gap, 'gap-h'),
		field({ k: 'node', f: 'counterAxisSpacing' }, 'Wrap gap', R.gap, 'gap-v'),
		field({ k: 'node', f: 'gridRowGap' }, 'Row gap', R.gap, 'gap-row'),
		field({ k: 'node', f: 'gridColumnGap' }, 'Column gap', R.gap, 'gap-col'),
	)
	if (gaps.length) layout.push({ fields: gaps })
	const padding = fields(
		field({ k: 'node', f: 'paddingX' }, 'Horizontal padding', R.gap, 'pad-x'),
		field({ k: 'node', f: 'paddingY' }, 'Vertical padding', R.gap, 'pad-y'),
		field({ k: 'node', f: 'paddingLeft' }, 'Left padding', R.gap, 'pad-l'),
		field({ k: 'node', f: 'paddingTop' }, 'Top padding', R.gap, 'pad-t'),
		field({ k: 'node', f: 'paddingRight' }, 'Right padding', R.gap, 'pad-r'),
		field({ k: 'node', f: 'paddingBottom' }, 'Bottom padding', R.gap, 'pad-b'),
	)
	if (padding.length) layout.push(expandable(padding, ['node:paddingX', 'node:paddingY'], 'individual padding'))
	if (layout.length) raw.push({ id: 'layout', label: 'Layout', sections: layout })

	// --- Appearance: opacity and corner radius in one row as in Figma, individual corners on demand, visibility
	const appearance: RawSection[] = []
	const look = fields(
		field({ k: 'node', f: 'opacity' }, 'Opacity', R.opacity, 'opacity'),
		field({ k: 'node', f: 'radiusAll' }, 'Corner radius', R.radius, 'radius'),
		field({ k: 'node', f: 'topLeftRadius' }, 'Top left radius', R.radius, 'corner-tl'),
		field({ k: 'node', f: 'topRightRadius' }, 'Top right radius', R.radius, 'corner-tr'),
		field({ k: 'node', f: 'bottomLeftRadius' }, 'Bottom left radius', R.radius, 'corner-bl'),
		field({ k: 'node', f: 'bottomRightRadius' }, 'Bottom right radius', R.radius, 'corner-br'),
	)
	if (look.length) appearance.push(expandable(look, ['node:opacity', 'node:radiusAll'], 'individual corners'))
	const visible = fields(field({ k: 'node', f: 'visible' }, 'Visibility', R.none, 'eye'))
	if (visible.length) appearance.push({ fields: visible })
	if (appearance.length) raw.push({ id: 'appearance', label: 'Appearance', sections: appearance })

	// --- Fill & stroke
	for (const prop of ['fills', 'strokes'] as const) {
		if (!every(prop)) continue
		const isFill = prop === 'fills'
		const g = { id: prop, label: isFill ? 'Fill' : 'Stroke', sections: [] as any[], styles: undefined as StyleInfo[] | undefined, notice: undefined as string | undefined }
		raw.push(g)
		const style = await styleInfo(nodes, isFill ? 'fill' : 'stroke')
		if (style) { g.styles = [style]; continue }
		if (nodes.some(n => (n as any)[prop] === figma.mixed)) { g.notice = 'Text has different fills across ranges'; continue }
		const lists = nodes.map(n => (n as any)[prop] as Paint[])
		const sig = lists[0].map(paintSig).join(',')
		if (lists.some(l => l.map(paintSig).join(',') !== sig)) {
			g.notice = `Layers have different ${isFill ? 'fills' : 'strokes'}. Make them match to bind variables.`
			continue
		}
		const req = isFill ? fillReq(nodes) : R.strokeColor
		const paints = lists[0]
		for (let i = paints.length - 1; i >= 0; i--) {
			const p = paints[i]
			const dim = p.visible === false
			const kind = PAINT_LABEL[p.type] ?? p.type
			const what = isFill ? 'Fill' : 'Stroke'
			if (p.type === 'SOLID') g.sections.push({ dim, fields: fields(field({ k: 'paint', prop, i }, `${what} color`, req)) })
			else if ('gradientStops' in p)
				g.sections.push({
					title: kind,
					dim,
					fields: fields(
						...p.gradientStops.map((s, j) => {
							const pos = `${Math.round(s.position * 100)}%`
							return field({ k: 'paint', prop, i, stop: j }, `${kind} stop ${pos}`, req, undefined, pos)
						}),
					),
				})
			else g.sections.push({ title: kind, dim, note: 'Can’t bind variables', fields: [] })
		}
		if (!paints.length) g.sections.push({ note: isFill ? 'No fills' : 'No strokes', fields: [] })
		if (!isFill && paints.length) {
			const weight = fields(
				field({ k: 'node', f: 'strokeWeightAll' }, 'Stroke weight', R.strokeWeight, 'stroke-weight'),
				field({ k: 'node', f: 'strokeLeftWeight' }, 'Left stroke', R.strokeWeight, 'side-l'),
				field({ k: 'node', f: 'strokeTopWeight' }, 'Top stroke', R.strokeWeight, 'side-t'),
				field({ k: 'node', f: 'strokeRightWeight' }, 'Right stroke', R.strokeWeight, 'side-r'),
				field({ k: 'node', f: 'strokeBottomWeight' }, 'Bottom stroke', R.strokeWeight, 'side-b'),
			)
			if (weight.length) g.sections.push(expandable(weight, ['node:strokeWeightAll'], 'individual sides'))
		}
	}

	// --- Effects
	if (every('effects')) {
		const g = { id: 'effects', label: 'Effects', sections: [] as any[], styles: undefined as StyleInfo[] | undefined, notice: undefined as string | undefined }
		raw.push(g)
		const style = await styleInfo(nodes, 'effect')
		const lists = nodes.map(n => (n as any).effects as Effect[])
		const sig = lists[0].map(effectSig).join(',')
		if (style) g.styles = [style]
		else if (lists.some(l => l.map(effectSig).join(',') !== sig)) g.notice = 'Layers have different effects. Make them match to bind variables.'
		else {
			const effects = lists[0]
			for (let i = effects.length - 1; i >= 0; i--) {
				const e = effects[i]
				const progressive = 'blurType' in e && (e as BlurEffect).blurType === 'PROGRESSIVE'
				const base = EFFECT_LABEL[e.type] ?? e.type
				const title = progressive ? `Progressive ${base.toLowerCase()}` : base
				const dim = e.visible === false
				if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
					g.sections.push({
						title,
						dim,
						fields: fields(
							field({ k: 'effect', i, f: 'offsetX' }, `${title} X`, R.effectFloat, T('X')),
							field({ k: 'effect', i, f: 'offsetY' }, `${title} Y`, R.effectFloat, T('Y')),
							field({ k: 'effect', i, f: 'radius' }, `${title} blur`, R.effectFloat, 'blur'),
							field({ k: 'effect', i, f: 'spread' }, `${title} spread`, R.effectFloat, 'spread'),
							field({ k: 'effect', i, f: 'color' }, `${title} color`, R.effectColor),
						),
					})
				} else if (effectSupports(e, 'radius')) {
					g.sections.push({
						title,
						dim,
						note: progressive ? 'Start blur can’t be bound' : undefined,
						fields: fields(field({ k: 'effect', i, f: 'radius' }, progressive ? `${title} end` : `${title} radius`, R.effectFloat, 'blur')),
					})
				} else g.sections.push({ title, dim, note: 'Can’t bind variables', fields: [] })
			}
			if (!effects.length) g.sections.push({ note: 'No effects', fields: [] })
		}
	}

	// --- Layout guides
	const more = { id: 'guides', label: 'Layout guide', sections: [] as RawSection[], styles: undefined as StyleInfo[] | undefined }
	if (every('layoutGrids') && nodes.some(n => ((n as any).layoutGrids as LayoutGrid[]).length)) {
		const style = await styleInfo(nodes, 'grid')
		const lists = nodes.map(n => (n as any).layoutGrids as LayoutGrid[])
		const sig = lists[0].map(gridSig).join(',')
		if (style) more.styles = [style]
		else if (lists.some(l => l.map(gridSig).join(',') !== sig)) more.sections.push({ title: 'Layout grids', note: 'Layers have different layout grids', fields: [] })
		else {
			lists[0].forEach((lg, i) => {
				const title = lg.pattern === 'GRID' ? 'Grid' : lg.pattern === 'COLUMNS' ? 'Columns' : 'Rows'
				const sizeLabel = lg.pattern === 'ROWS' ? 'height' : lg.pattern === 'COLUMNS' ? 'width' : 'size'
				const f = (gf: 'count' | 'gutterSize' | 'offset' | 'sectionSize', label: string, icon: Glyph) =>
					gridSupports(lg, gf) ? field({ k: 'grid', i, f: gf }, `${title} ${label}`, R.none, icon) : null
				more.sections.push({
					title,
					dim: lg.visible === false,
					fields: fields(f('count', 'count', 'grid-count'), f('sectionSize', sizeLabel, 'grid-size'), f('gutterSize', 'gutter', 'grid-gutter'), f('offset', 'offset', 'grid-offset')),
				})
			})
		}
	}
	if (more.sections.length || more.styles) raw.push(more)

	// --- Resolve bound variable ids to names
	const ids = new Set<string>()
	for (const g of raw) for (const s of g.sections) for (const f of s.fields) if (f.boundId && f.boundId !== MIXED) ids.add(f.boundId)
	const refs = new Map<string, VarRef>()
	await Promise.all([...ids].map(async id => refs.set(id, await refFor(id))))

	const groups: GroupState[] = raw.map(g => ({
		id: g.id,
		label: g.label,
		styles: g.styles,
		notice: g.notice,
		sections: g.sections.map((s): Section => ({
			...s,
			fields: s.fields.map(({ boundId, ...f }) => ({ ...f, bound: boundId === MIXED ? 'mixed' : boundId ? refs.get(boundId)! : null })),
		})),
	}))

	const single = all.length === 1
	const types = new Set(all.map(n => n.type))
	return {
		count: all.length,
		title: single ? all[0].name : `${all.length} layers`,
		subtitle: types.size === 1 ? (TYPE_LABEL[all[0].type] ?? all[0].type) : 'Mixed types',
		instance: nodes.some(n => n.type === 'INSTANCE' || n.id.startsWith('I')),
		readLimit: all.length > READ_LIMIT ? READ_LIMIT : null,
		groups,
	}
}

async function refFor(id: string): Promise<VarRef> {
	const v = await figma.variables.getVariableByIdAsync(id)
	if (!v) return { id, key: '', name: 'Missing variable', collection: '', remote: false, missing: true }
	const col = await getCollection(v.variableCollectionId)
	return { id, key: v.key, name: v.name, collection: col?.name ?? '', remote: v.remote }
}

const STYLE_ID: Record<StyleKind, string> = { fill: 'fillStyleId', stroke: 'strokeStyleId', effect: 'effectStyleId', grid: 'gridStyleId' }

async function styleInfo(nodes: readonly SceneNode[], kind: StyleKind): Promise<StyleInfo | undefined> {
	const ids = nodes.map(n => (n as any)[STYLE_ID[kind]] as string | symbol | undefined)
	const set = ids.filter(id => id === figma.mixed || (typeof id === 'string' && id !== ''))
	if (!set.length) return undefined
	const first = ids[0]
	const uniform = typeof first === 'string' && first !== '' && ids.every(id => id === first)
	if (!uniform) return { kind, name: 'Mixed styles', mixed: true }
	const style = await figma.getStyleByIdAsync(first as string)
	return { kind, name: style?.name ?? 'Unknown style', mixed: false }
}

export function styleProp(kind: StyleKind) {
	return STYLE_ID[kind]
}
