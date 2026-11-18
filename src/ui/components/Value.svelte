<script lang="ts">
	import type { Display } from '../../shared/types'
	import { formatNum } from '../state.svelte'
	import Swatch from './Swatch.svelte'

	let { value, boolLabels = ['True', 'False'] }: { value: Display; boolLabels?: [string, string] } = $props()
</script>

{#if value.t === 'num'}
	<span class="v num">{formatNum(value.v, value.unit)}</span>
{:else if value.t === 'color'}
	<Swatch hex={value.hex} a={value.a} />
	<span class="v">{value.hex.slice(1)}</span>
	{#if value.a < 1}<span class="v dim">{Math.round(value.a * 100)}%</span>{/if}
{:else if value.t === 'bool'}
	<span class="v">{value.v ? boolLabels[0] : boolLabels[1]}</span>
{:else if value.t === 'auto'}
	<span class="v dim">Auto</span>
{:else if value.t === 'none'}
	<span class="v dim">—</span>
{:else}
	<span class="v dim">Mixed</span>
{/if}

<style>
	.v {
		white-space: nowrap;
	}

	.num {
		font-variant-numeric: tabular-nums;
	}

	.dim {
		color: var(--text-secondary);
	}
</style>
