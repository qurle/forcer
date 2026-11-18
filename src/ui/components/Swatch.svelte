<script lang="ts">
	// Color chit: 14px in inputs, 16px in the picker list, as in Figma
	let { hex, a = 1, size = 14 }: { hex: string; a?: number; size?: number } = $props()
</script>

<span class="swatch" style:width="{size}px" style:height="{size}px" title={`${hex} ${Math.round(a * 100)}%`}>
	<span class="fill" style:background={hex}></span>
	{#if a < 1}
		<span class="checker"></span>
		<span class="alpha" style:background={hex} style:opacity={a}></span>
	{/if}
</span>

<style>
	.swatch {
		position: relative;
		display: block;
		flex: none;
		border-radius: 20%;
		overflow: hidden;
	}

	.fill,
	.checker,
	.alpha {
		position: absolute;
		inset: 0;
	}

	/* Translucent colors: solid left half, alpha over a checkerboard on the right, like Figma's chits */
	.checker,
	.alpha {
		left: 50%;
	}

	.checker {
		background: repeating-conic-gradient(#d9d9d9 0 25%, #fff 0 50%) 0 0 / 6px 6px;
	}

	.swatch::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
	}

	:global(.figma-dark) .swatch::after {
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
	}
</style>
