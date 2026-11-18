// Field addressing plus low-level read/write of a single field on a single node
import type { Display, VarType } from '../shared/types'

export type NodeField =
	| 'width' | 'height' | 'minWidth' | 'maxWidth' | 'minHeight' | 'maxHeight'
	| 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft'
	| 'itemSpacing' | 'counterAxisSpacing' | 'gridRowGap' | 'gridColumnGap'
	| 'topLeftRadius' | 'topRightRadius' | 'bottomRightRadius' | 'bottomLeftRadius'
	| 'strokeTopWeight' | 'strokeRightWeight' | 'strokeBottomWeight' | 'strokeLeftWeight'
	| 'opacity' | 'visible'
	// Virtual fields: bind all corners / all sides / a padding pair at once
	| 'radiusAll' | 'strokeWeightAll' | 'paddingX' | 'paddingY'

export type PaintProp = 'fills' | 'strokes'
export type EffectField = 'offsetX' | 'offsetY' | 'radius' | 'spread' | 'color'
export type GridField = 'count' | 'gutterSize' | 'offset' | 'sectionSize'

export type Addr =
	| { k: 'node'; f: NodeField }
	| { k: 'paint'; prop: PaintProp; i: number; stop?: number }
	| { k: 'effect'; i: number; f: EffectField }
	| { k: 'grid'; i: number; f: GridField }

export const CORNERS = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'] as const
export const SIDES = ['strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight'] as const
const PADDING_PAIR = { paddingX: ['paddingLeft', 'paddingRight'], paddingY: ['paddingTop', 'paddingBottom'] } as const

export const MIXED = 'mixed' as const
export type Bound = string | null | typeof MIXED

export interface Read {
	value: Display
	bound: Bound
}

// ---------- Addressing ----------

export function encode(a: Addr): string {
	switch (a.k) {
		case 'node': return `node:${a.f}`
		case 'paint': return a.stop === undefined ? `paint:${a.prop}:${a.i}` : `paint:${a.prop}:${a.i}:${a.stop}`
		case 'effect': return `effect:${a.i}:${a.f}`
		case 'grid': return `grid:${a.i}:${a.f}`
	}
}

export function decode(key: string): Addr {
	const p = key.split(':')
	switch (p[0]) {
		case 'node': return { k: 'node', f: p[1] as NodeField }
		case 'paint': return { k: 'paint', prop: p[1] as PaintProp, i: +p[2], stop: p[3] === undefined ? undefined : +p[3] }
		case 'effect': return { k: 'effect', i: +p[1], f: p[2] as EffectField }
		case 'grid': return { k: 'grid', i: +p[1], f: p[2] as GridField }
	}
	throw new Error(`Unknown field ${key}`)
}

export function requiredType(a: Addr): VarType {
	if (a.k === 'paint') return 'COLOR'
	if (a.k === 'effect' && a.f === 'color') return 'COLOR'
	if (a.k === 'node' && a.f === 'visible') return 'BOOLEAN'
	return 'FLOAT'
}

// ---------- Helpers ----------

const h2 = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0')
export const toHex = (c: RGB) => `#${h2(c.r)}${h2(c.g)}${h2(c.b)}`.toUpperCase()

const num = (v: unknown, unit?: '%'): Display => {
	if (v === figma.mixed) return { t: 'mixed' }
	if (v === null || v === undefined) return { t: 'none' }
	if (typeof v !== 'number') return { t: 'none' }
	if (!isFinite(v)) return { t: 'auto' }
	return unit ? { t: 'num', v: Math.round(v * 10000) / 100, unit } : { t: 'num', v: Math.round(v * 100) / 100 }
}

const sameOrMixed = (ids: (string | null)[]): Bound => (ids.every(id => id === ids[0]) ? ids[0] : MIXED)

const aliasId = (bv: any, f: string): string | null => {
	const a = bv && bv[f]
	return a && a.id ? a.id : null
}

export const isAutoLayout = (n: BaseNode | null): boolean =>
	!!n && 'layoutMode' in n && (n as FrameNode).layoutMode !== 'NONE'

export const isFrameLike = (n: SceneNode) =>
	n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'COMPONENT_SET' || n.type === 'INSTANCE' || n.type === 'SECTION'

const NO_SIZE = new Set(['GROUP', 'BOOLEAN_OPERATION', 'SLICE', 'SECTION'])

// ---------- Read ----------

/** Read a field from a node. Returns null when the field does not apply to this node. */
export function readField(node: SceneNode, a: Addr): Read | null {
	const n = node as any
	switch (a.k) {
		case 'node': return readNodeField(n, a.f)
		case 'paint': {
			const arr = n[a.prop]
			if (!Array.isArray(arr)) return null
			const p = arr[a.i] as Paint | undefined
			if (!p) return null
			if (a.stop === undefined) {
				if (p.type !== 'SOLID') return null
				return { value: { t: 'color', hex: toHex(p.color), a: p.opacity ?? 1 }, bound: aliasId(p.boundVariables, 'color') }
			}
			if (!('gradientStops' in p)) return null
			const s = p.gradientStops[a.stop]
			if (!s) return null
			return { value: { t: 'color', hex: toHex(s.color), a: s.color.a }, bound: aliasId(s.boundVariables, 'color') }
		}
		case 'effect': {
			if (!Array.isArray(n.effects)) return null
			const e = n.effects[a.i] as Effect | undefined
			if (!e || !effectSupports(e, a.f)) return null
			const bound = aliasId((e as any).boundVariables, a.f)
			if (a.f === 'color') {
				const c = (e as DropShadowEffect).color
				return { value: { t: 'color', hex: toHex(c), a: c.a }, bound }
			}
			const s = e as DropShadowEffect
			const v = a.f === 'offsetX' ? s.offset.x : a.f === 'offsetY' ? s.offset.y : a.f === 'spread' ? (s.spread ?? 0) : s.radius
			return { value: num(v), bound }
		}
		case 'grid': {
			if (!Array.isArray(n.layoutGrids)) return null
			const g = n.layoutGrids[a.i] as LayoutGrid | undefined
			if (!g || !gridSupports(g, a.f)) return null
			return { value: num((g as any)[a.f]), bound: aliasId((g as any).boundVariables, a.f) }
		}
	}
}

function readNodeField(n: any, f: NodeField): Read | null {
	const bv = n.boundVariables || {}
	switch (f) {
		case 'width': case 'height':
			if (NO_SIZE.has(n.type) || !(f in n)) return null
			return { value: num(n[f]), bound: aliasId(bv, f) }
		case 'minWidth': case 'maxWidth': case 'minHeight': case 'maxHeight':
			if (!(f in n) || !(isAutoLayout(n) || isAutoLayout(n.parent))) return null
			return { value: num(n[f]), bound: aliasId(bv, f) }
		case 'paddingTop': case 'paddingRight': case 'paddingBottom': case 'paddingLeft':
			if (!isAutoLayout(n)) return null
			return { value: num(n[f]), bound: aliasId(bv, f) }
		case 'paddingX': case 'paddingY': {
			if (!isAutoLayout(n)) return null
			const [a, b] = PADDING_PAIR[f]
			return { value: n[a] === n[b] ? num(n[a]) : { t: 'mixed' }, bound: sameOrMixed([aliasId(bv, a), aliasId(bv, b)]) }
		}
		case 'itemSpacing':
			if (n.layoutMode !== 'HORIZONTAL' && n.layoutMode !== 'VERTICAL') return null
			return { value: n.primaryAxisAlignItems === 'SPACE_BETWEEN' ? { t: 'auto' } : num(n.itemSpacing), bound: aliasId(bv, f) }
		case 'counterAxisSpacing':
			if (!isAutoLayout(n) || n.layoutWrap !== 'WRAP') return null
			return { value: n.counterAxisAlignContent === 'SPACE_BETWEEN' ? { t: 'auto' } : num(n.counterAxisSpacing), bound: aliasId(bv, f) }
		case 'gridRowGap': case 'gridColumnGap':
			if (n.layoutMode !== 'GRID') return null
			return { value: num(n[f]), bound: aliasId(bv, f) }
		case 'topLeftRadius': case 'topRightRadius': case 'bottomRightRadius': case 'bottomLeftRadius':
			if (!(f in n)) return null
			return { value: num(n[f]), bound: aliasId(bv, f) }
		case 'radiusAll':
			if ('topLeftRadius' in n) return { value: num(n.cornerRadius), bound: sameOrMixed(CORNERS.map(c => aliasId(bv, c))) }
			if ('cornerRadius' in n && n.type !== 'LINE') return { value: num(n.cornerRadius), bound: aliasId(bv, 'cornerRadius') }
			return null
		case 'strokeTopWeight': case 'strokeRightWeight': case 'strokeBottomWeight': case 'strokeLeftWeight':
			if (!(f in n)) return null
			return { value: num(n[f]), bound: aliasId(bv, f) }
		case 'strokeWeightAll':
			if ('strokeTopWeight' in n) return { value: num(n.strokeWeight), bound: sameOrMixed(SIDES.map(s => aliasId(bv, s))) }
			if ('strokeWeight' in n) return { value: num(n.strokeWeight), bound: aliasId(bv, 'strokeWeight') }
			return null
		case 'opacity':
			if (!('opacity' in n)) return null
			return { value: num(n.opacity, '%'), bound: aliasId(bv, f) }
		case 'visible':
			return { value: { t: 'bool', v: !!n.visible }, bound: aliasId(bv, f) }
	}
}

export function effectSupports(e: Effect, f: EffectField): boolean {
	if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') return true
	if (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR') return f === 'radius'
	return false
}

export function gridSupports(g: LayoutGrid, f: GridField): boolean {
	if (g.pattern === 'GRID') return f === 'sectionSize'
	if (f === 'offset') return g.alignment !== 'CENTER'
	if (f === 'sectionSize') return g.alignment !== 'STRETCH'
	return true
}

// ---------- Write ----------

const STYLE_PROP: Record<string, string> = { fills: 'fillStyleId', strokes: 'strokeStyleId', effects: 'effectStyleId', layoutGrids: 'gridStyleId' }

function assertNoStyle(n: any, prop: string) {
	const id = n[STYLE_PROP[prop]]
	if (id === figma.mixed || (typeof id === 'string' && id !== '')) throw new Error('has a style, detach it first')
}

function bindNode(n: any, f: VariableBindableNodeField, v: Variable | null) {
	if (typeof n.setBoundVariable !== 'function') throw new Error('can’t bind variables')
	n.setBoundVariable(f, v)
}

/** Bind (or unbind with null) a variable to a field on one node. Throws a short reason on failure. */
export function writeField(node: SceneNode, a: Addr, v: Variable | null) {
	const n = node as any
	if (!readField(node, a)) throw new Error('field doesn’t apply')
	switch (a.k) {
		case 'node': {
			if (a.f === 'radiusAll') {
				if ('topLeftRadius' in n) CORNERS.forEach(c => bindNode(n, c, v))
				else bindNode(n, 'cornerRadius', v)
			} else if (a.f === 'strokeWeightAll') {
				if ('strokeTopWeight' in n) SIDES.forEach(s => bindNode(n, s, v))
				else bindNode(n, 'strokeWeight', v)
			} else if (a.f === 'paddingX' || a.f === 'paddingY') {
				PADDING_PAIR[a.f].forEach(p => bindNode(n, p, v))
			} else bindNode(n, a.f, v)
			return
		}
		case 'paint': {
			assertNoStyle(n, a.prop)
			const paints = (n[a.prop] as Paint[]).slice()
			const p = paints[a.i]
			if (a.stop === undefined) {
				paints[a.i] = figma.variables.setBoundVariableForPaint(p as SolidPaint, 'color', v)
			} else {
				const g = p as GradientPaint
				const stops = g.gradientStops.map((s, j) => {
					if (j !== a.stop) return s
					const { boundVariables, ...rest } = s as ColorStop & { boundVariables?: unknown }
					return v ? { ...rest, boundVariables: { color: figma.variables.createVariableAlias(v) } } : rest
				})
				paints[a.i] = { ...g, gradientStops: stops } as GradientPaint
			}
			n[a.prop] = paints
			return
		}
		case 'effect': {
			assertNoStyle(n, 'effects')
			const effects = (n.effects as Effect[]).slice()
			effects[a.i] = figma.variables.setBoundVariableForEffect(effects[a.i], a.f, v)
			n.effects = effects
			return
		}
		case 'grid': {
			assertNoStyle(n, 'layoutGrids')
			const grids = (n.layoutGrids as LayoutGrid[]).slice()
			grids[a.i] = figma.variables.setBoundVariableForLayoutGrid(grids[a.i], a.f, v)
			n.layoutGrids = grids
			return
		}
	}
}
