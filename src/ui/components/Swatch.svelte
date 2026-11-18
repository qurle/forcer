<script lang="ts">
	let { hex, a = 1 }: { hex: string; a?: number } = $props()
</script>

<span class="swatch" title={`${hex} ${Math.round(a * 100)}%`}>
	<span class="fill" style:background={hex} style:opacity={a}></span>
</span>

<style>
	.swatch {
		position: relative;
		width: 14px;
		height: 14px;
		flex: none;
		border-radius: 3px;
		overflow: hidden;
		background: repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 6px 6px;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
	}

	.fill {
		position: absolute;
		inset: 0;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
	}
</style>
