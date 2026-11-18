<script lang="ts">
	import type { Display } from '../../shared/types'
	import { formatNum } from '../state.svelte'

	let { value, boolLabels = ['True', 'False'] }: { value: Display; boolLabels?: [string, string] } = $props()
</script>

{#if value.t === 'num'}
	<span class="v ellipsis tabular">{formatNum(value.v, value.unit)}</span>
{:else if value.t === 'color'}
	<span class="v ellipsis">{value.hex.slice(1)}</span>
	{#if value.a < 1}<span class="alpha tabular">{Math.round(value.a * 100)}%</span>{/if}
{:else if value.t === 'bool'}
	<span class="v ellipsis">{value.v ? boolLabels[0] : boolLabels[1]}</span>
{:else if value.t === 'auto'}
	<span class="v dim">Auto</span>
{:else if value.t === 'none'}
	<span class="v dim">–</span>
{:else}
	<span class="v dim">Mixed</span>
{/if}

<style>
	.v {
		flex: 1;
	}

	.dim,
	.alpha {
		color: var(--text-secondary);
	}

	.alpha {
		flex: none;
	}
</style>
