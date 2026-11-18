// Selection analysis: which fields can be bound on all selected layers, with current values
import type { Display, FieldState, GroupState, Section, SelectionInfo, StyleInfo, StyleKind, VarRef, VarType } from '../shared/types'
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
	const raw: { id: string; label: string; styles?: StyleInfo[]; notice?: string; sections: { title?: string; note?: string; fields: RawField[] }[] }[] = []

	/** Builds a field if it applies to every read node, aggregating value and binding */
	const field = (addr: Addr, label: string, scopeReq: Req, type: VarType = requiredType(addr)): RawField | null => {
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
		return { key: encode(addr), label, type, scopeReq, value: value!, boundId: boundId ?? null }
	}
	const fields = (...list: (RawField | null)[]) => list.filter((f): f is RawField => !!f)
	const every = (prop: string) => nodes.every(n => prop in n)

	// --- Size
	const size = fields(
		field({ k: 'node', f: 'width' }, 'Width', R.size),
		field({ k: 'node', f: 'height' }, 'Height', R.size),
		field({ k: 'node', f: 'minWidth' }, 'Min width', R.size),
		field({ k: 'node', f: 'maxWidth' }, 'Max width', R.size),
		field({ k: 'node', f: 'minHeight' }, 'Min height', R.size),
		field({ k: 'node', f: 'maxHeight' }, 'Max height', R.size),
	)
	if (size.length) raw.push({ id: 'size', label: 'Size', sections: [{ fields: size }] })

	// --- Auto layout
	const gaps = fields(
		field({ k: 'node', f: 'itemSpacing' }, 'Gap', R.gap),
		field({ k: 'node', f: 'counterAxisSpacing' }, 'Wrap gap', R.gap),
		field({ k: 'node', f: 'gridRowGap' }, 'Row gap', R.gap),
		field({ k: 'node', f: 'gridColumnGap' }, 'Column gap', R.gap),
	)
	const padding = fields(
		field({ k: 'node', f: 'paddingTop' }, 'Top', R.gap),
		field({ k: 'node', f: 'paddingRight' }, 'Right', R.gap),
		field({ k: 'node', f: 'paddingBottom' }, 'Bottom', R.gap),
		field({ k: 'node', f: 'paddingLeft' }, 'Left', R.gap),
	)
	if (gaps.length || padding.length) {
		const sections: { title?: string; fields: RawField[] }[] = []
		if (gaps.length) sections.push({ fields: gaps })
		if (padding.length) sections.push({ title: 'Padding', fields: padding })
		raw.push({ id: 'layout', label: 'Auto layout', sections })
	}

	// --- Radius
	const radius = fields(
		field({ k: 'node', f: 'radiusAll' }, 'All corners', R.radius),
		field({ k: 'node', f: 'topLeftRadius' }, 'Top left', R.radius),
		field({ k: 'node', f: 'topRightRadius' }, 'Top right', R.radius),
		field({ k: 'node', f: 'bottomRightRadius' }, 'Bottom right', R.radius),
		field({ k: 'node', f: 'bottomLeftRadius' }, 'Bottom left', R.radius),
	)
	if (radius.length) raw.push({ id: 'radius', label: 'Corner radius', sections: [{ fields: radius }] })

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
			const title = (PAINT_LABEL[p.type] ?? p.type) + (p.visible === false ? ' · hidden' : '')
			if (p.type === 'SOLID') g.sections.push({ title, fields: fields(field({ k: 'paint', prop, i }, 'Color', req)) })
			else if ('gradientStops' in p)
				g.sections.push({
					title,
					fields: fields(...p.gradientStops.map((s, j) => field({ k: 'paint', prop, i, stop: j }, `Stop ${Math.round(s.position * 100)}%`, req))),
				})
			else g.sections.push({ title, note: 'Can’t bind variables', fields: [] })
		}
		if (!paints.length) g.sections.push({ note: isFill ? 'No fills' : 'No strokes', fields: [] })
		if (!isFill && paints.length) {
			const weight = fields(
				field({ k: 'node', f: 'strokeWeightAll' }, 'All sides', R.strokeWeight),
				field({ k: 'node', f: 'strokeTopWeight' }, 'Top', R.strokeWeight),
				field({ k: 'node', f: 'strokeRightWeight' }, 'Right', R.strokeWeight),
				field({ k: 'node', f: 'strokeBottomWeight' }, 'Bottom', R.strokeWeight),
				field({ k: 'node', f: 'strokeLeftWeight' }, 'Left', R.strokeWeight),
			)
			if (weight.length) g.sections.push({ title: 'Weight', fields: weight })
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
				const title = (progressive ? `Progressive ${base.toLowerCase()}` : base) + (e.visible === false ? ' · hidden' : '')
				if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
					g.sections.push({
						title,
						fields: fields(
							field({ k: 'effect', i, f: 'offsetX' }, 'X', R.effectFloat),
							field({ k: 'effect', i, f: 'offsetY' }, 'Y', R.effectFloat),
							field({ k: 'effect', i, f: 'radius' }, 'Blur', R.effectFloat),
							field({ k: 'effect', i, f: 'spread' }, 'Spread', R.effectFloat),
							field({ k: 'effect', i, f: 'color' }, 'Color', R.effectColor),
						),
					})
				} else if (effectSupports(e, 'radius')) {
					g.sections.push({
						title,
						note: progressive ? 'Start blur can’t be bound' : undefined,
						fields: fields(field({ k: 'effect', i, f: 'radius' }, progressive ? 'End blur' : 'Blur', R.effectFloat)),
					})
				} else g.sections.push({ title, note: 'Can’t bind variables', fields: [] })
			}
			if (!effects.length) g.sections.push({ note: 'No effects', fields: [] })
		}
	}

	// --- More
	const more = { id: 'more', label: 'More', sections: [] as any[], styles: undefined as StyleInfo[] | undefined }
	const layer = fields(field({ k: 'node', f: 'opacity' }, 'Opacity', R.opacity), field({ k: 'node', f: 'visible' }, 'Visible', R.none))
	if (layer.length) more.sections.push({ fields: layer })
	if (every('layoutGrids') && nodes.some(n => ((n as any).layoutGrids as LayoutGrid[]).length)) {
		const style = await styleInfo(nodes, 'grid')
		const lists = nodes.map(n => (n as any).layoutGrids as LayoutGrid[])
		const sig = lists[0].map(gridSig).join(',')
		if (style) more.styles = [style]
		else if (lists.some(l => l.map(gridSig).join(',') !== sig)) more.sections.push({ title: 'Layout grids', note: 'Layers have different layout grids', fields: [] })
		else {
			lists[0].forEach((lg, i) => {
				const title = lg.pattern === 'GRID' ? 'Grid' : lg.pattern === 'COLUMNS' ? 'Columns' : 'Rows'
				const sizeLabel = lg.pattern === 'ROWS' ? 'Height' : lg.pattern === 'COLUMNS' ? 'Width' : 'Size'
				const f = (gf: 'count' | 'gutterSize' | 'offset' | 'sectionSize', label: string) =>
					gridSupports(lg, gf) ? field({ k: 'grid', i, f: gf }, label, R.none) : null
				more.sections.push({ title, fields: fields(f('count', 'Count'), f('sectionSize', sizeLabel), f('gutterSize', 'Gutter'), f('offset', 'Offset')) })
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
			title: s.title,
			note: s.note,
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
