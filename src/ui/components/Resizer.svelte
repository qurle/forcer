<script lang="ts">
	import { post } from '../state.svelte'

	// Corner dragger. The iframe can't resize itself, so it asks the main thread (figma.ui.resize).
	// Pointer capture keeps the drag going when the cursor leaves the shrinking iframe.
	let grab: { x: number; y: number } | null = null
	let frame = 0
	let size = { width: 0, height: 0 }

	function down(e: PointerEvent) {
		const el = e.currentTarget as HTMLElement
		const r = el.getBoundingClientRect()
		// Distance from the cursor to the window's bottom-right corner, kept constant while dragging
		grab = { x: r.right - e.clientX, y: r.bottom - e.clientY }
		el.setPointerCapture(e.pointerId)
		e.preventDefault()
	}

	function move(e: PointerEvent) {
		if (!grab) return
		size = { width: Math.round(e.clientX + grab.x), height: Math.round(e.clientY + grab.y) }
		if (!frame)
			frame = requestAnimationFrame(() => {
				frame = 0
				post({ type: 'resize', ...size })
			})
	}

	function up(e: PointerEvent) {
		if (!grab) return
		grab = null
		;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
		if (frame) cancelAnimationFrame(frame), (frame = 0)
		if (size.width) post({ type: 'resize', ...size, save: true })
	}
</script>

<div
	class="resizer"
	role="separator"
	aria-label="Resize window. Double-click to reset"
	title="Drag to resize, double-click to reset"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
	ondblclick={() => post({ type: 'reset-size' })}
>
	<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
		<path d="M5.85 13.63a14.83 14.83 0 0 0 7.78-7.78" stroke="currentColor" stroke-linecap="round" />
	</svg>
</div>

<style>
	.resizer {
		position: fixed;
		right: 0;
		bottom: 0;
		z-index: 30;
		padding: 4px;
		color: var(--icon-tertiary);
		cursor: nwse-resize;
		touch-action: none;
	}

	.resizer svg {
		display: block;
		stroke-width: 2px;
		transition:
			stroke-width 120ms ease-out,
			color 120ms ease-out;
	}

	.resizer:hover,
	.resizer:active {
		color: var(--icon-secondary);
	}

	.resizer:hover svg,
	.resizer:active svg {
		stroke-width: 3px;
	}
</style>
