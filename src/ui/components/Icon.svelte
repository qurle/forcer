<script lang="ts" module>
	import type { Glyph } from '../../shared/types'

	export type IconName =
		| Glyph
		| 'chevron-down' | 'chevron-right' | 'close' | 'search' | 'detach' | 'style' | 'instance'
		| 'refresh' | 'check' | 'number' | 'boolean' | 'info'
</script>

<script lang="ts">
	// 24px icons in the Figma UI3 style: 1px strokes on a 12px live area, centered in a 24px box
	let { name, size = 24 }: { name: IconName; size?: number } = $props()

	// Directional icons are drawn once and rotated
	const ROTATED: Partial<Record<IconName, [IconName, number]>> = {
		'pad-r': ['pad-t', 90], 'pad-b': ['pad-t', 180], 'pad-l': ['pad-t', 270],
		'side-r': ['side-t', 90], 'side-b': ['side-t', 180], 'side-l': ['side-t', 270],
		'corner-tr': ['corner-tl', 90], 'corner-br': ['corner-tl', 180], 'corner-bl': ['corner-tl', 270],
		'min-h': ['min-w', 90], 'max-h': ['max-w', 90],
		'pad-y': ['pad-x', 90],
		'gap-v': ['gap-h', 90], 'gap-row': ['gap-h', 90], 'gap-col': ['gap-h', 0],
	}
	const base = $derived(ROTATED[name]?.[0] ?? name)
	const rot = $derived(ROTATED[name]?.[1] ?? 0)
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
	<g transform={rot ? `rotate(${rot} 12 12)` : undefined} stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
		{#if base === 'chevron-down'}
			<path d="m9 10.5 3 3 3-3" />
		{:else if base === 'chevron-right'}
			<path d="m10.5 9 3 3-3 3" />
		{:else if base === 'close'}
			<path d="m8 8 8 8m0-8-8 8" />
		{:else if base === 'search'}
			<circle cx="11" cy="11" r="4.5" />
			<path d="m14.5 14.5 3 3" />
		{:else if base === 'detach'}
			<!-- Broken chain link on a diagonal -->
			<path d="M10.5 9.5h-2.5a2.5 2.5 0 0 0 0 5h2.5m3-5h2.5a2.5 2.5 0 0 1 0 5h-2.5" transform="rotate(-45 12 12)" />
		{:else if base === 'style'}
			<circle cx="9" cy="9" r="1.75" />
			<circle cx="15" cy="9" r="1.75" />
			<circle cx="9" cy="15" r="1.75" />
			<circle cx="15" cy="15" r="1.75" />
		{:else if base === 'instance'}
			<path d="M12 6.5 17.5 12 12 17.5 6.5 12Z" />
		{:else if base === 'refresh'}
			<path d="M17 12a5 5 0 1 1-1.46-3.54M16.5 6.5v2.5H14" />
		{:else if base === 'check'}
			<path d="m7.5 12.5 3 3 6-7" />
		{:else if base === 'info'}
			<circle cx="12" cy="12" r="5.5" />
			<path d="M12 11.5v3" />
			<circle cx="12" cy="9.25" r="0.25" fill="currentColor" />
		{:else if base === 'gap-h'}
			<path d="M6.5 7v10m11-10v10M10 12h4" />
		{:else if base === 'pad-t'}
			<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
			<path d="M9.5 9.5h5" />
		{:else if base === 'pad-x'}
			<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
			<path d="M9.5 9.5v5m5-5v5" />
		{:else if base === 'side-t'}
			<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" stroke-dasharray="1.5 2" opacity="0.5" />
			<path d="M6.5 6.5h11" stroke-width="1.5" />
		{:else if base === 'max-w'}
			<path d="M6.5 8v8m11-8v8M9 12h6m-4.5-1.5L9 12l1.5 1.5m3-3L15 12l-1.5 1.5" />
		{:else if base === 'min-w'}
			<path d="M6.5 8v8m11-8v8M8.5 12h2.5m2 0h2.5M9.5 10.5 11 12l-1.5 1.5m5-3L13 12l1.5 1.5" />
		{:else if base === 'radius'}
			<path d="M6.5 10V8.5a2 2 0 0 1 2-2H10m4 0h1.5a2 2 0 0 1 2 2V10m0 4v1.5a2 2 0 0 1-2 2H14m-4 0H8.5a2 2 0 0 1-2-2V14" />
		{:else if base === 'corner-tl'}
			<path d="M7.5 16.5v-5a4 4 0 0 1 4-4h5" />
		{:else if base === 'stroke-weight'}
			<path d="M7 8h10" />
			<path d="M7 12h10" stroke-width="1.5" />
			<path d="M7 16h10" stroke-width="2" />
		{:else if base === 'opacity'}
			<rect x="6.5" y="6.5" width="11" height="11" rx="2" />
			<path d="M17 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-8Z" fill="currentColor" stroke="none" opacity="0.35" />
		{:else if base === 'eye'}
			<path d="M5.5 12s2.5-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.5 4.5-6.5 4.5S5.5 12 5.5 12Z" />
			<circle cx="12" cy="12" r="1.75" />
		{:else if base === 'blur'}
			<path d="M12 6.5s-4.5 4.6-4.5 7.5a4.5 4.5 0 0 0 9 0c0-2.9-4.5-7.5-4.5-7.5Z" />
		{:else if base === 'spread'}
			<rect x="9.5" y="9.5" width="5" height="5" rx="1" />
			<path d="M6.5 9V6.5H9m6 0h2.5V9m0 6v2.5H15m-6 0H6.5V15" />
		{:else if base === 'grid-count'}
			<path d="M8 7v10m4-10v10m4-10v10" />
		{:else if base === 'grid-size'}
			<path d="M7.5 9.5v5m9-5v5m-9-2.5h9" />
		{:else if base === 'grid-gutter'}
			<rect x="6.5" y="7.5" width="3.5" height="9" rx="1" />
			<rect x="14" y="7.5" width="3.5" height="9" rx="1" />
		{:else if base === 'grid-offset'}
			<path d="M6.5 7v10M9.5 12h7m-2-2 2 2-2 2" />
		{:else if base === 'number'}
			<path d="m10.5 7.5-1 9m5-9-1 9m-5.5-6h9m-9.5 3h9" />
		{:else if base === 'boolean'}
			<rect x="5.5" y="8.5" width="13" height="7" rx="3.5" />
			<circle cx="15" cy="12" r="1.75" fill="currentColor" stroke="none" />
		{/if}
	</g>
</svg>

<style>
	svg {
		display: block;
		flex: none;
	}
</style>
