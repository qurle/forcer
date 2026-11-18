<script lang="ts">
	import type { FieldState } from '../../shared/types'
	import { app, leaf, post } from '../state.svelte'
	import Icon from './Icon.svelte'
	import Swatch from './Swatch.svelte'
	import Value from './Value.svelte'

	let { field, context }: { field: FieldState; context: string } = $props()

	function open() {
		app.pickerContext = `${context} · ${field.label}`
		app.picker = field
	}

	const bound = $derived(field.bound && field.bound !== 'mixed' ? field.bound : null)
	const active = $derived(app.picker?.key === field.key)
	const title = $derived(
		bound ? `${bound.name}${bound.collection ? ` · ${bound.collection}` : ''}` : field.bound === 'mixed' ? 'Layers use different variables' : 'Bind a variable',
	)
</script>

<div class="row">
	<span class="label">{field.label}</span>
	<button class="pill" class:active disabled={app.busy} {title} onclick={open}>
		{#if bound}
			<span class="chip" class:missing={bound.missing}>
				{#if field.value.t === 'color'}<Swatch hex={field.value.hex} a={field.value.a} />{/if}
				<span class="name">{leaf(bound.name)}</span>
			</span>
		{:else if field.bound === 'mixed'}
			<span class="chip mixed"><span class="name">Mixed variables</span></span>
		{:else}
			<Value value={field.value} boolLabels={['Shown', 'Hidden']} />
		{/if}
	</button>
	{#if field.bound}
		<button
			class="icon-button"
			title="Detach variable"
			aria-label="Detach variable"
			disabled={app.busy}
			onclick={() => post({ type: 'unbind', field: field.key })}
		>
			<Icon name="detach" />
		</button>
	{:else}
		<span class="spacer"></span>
	{/if}
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 8px 0 var(--gutter);
	}

	.label {
		width: 76px;
		flex: none;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pill {
		flex: 1;
		min-width: 0;
		height: var(--control);
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 4px 0 8px;
		border-radius: var(--radius);
		background: var(--bg-secondary);
		text-align: left;
		overflow: hidden;
		box-shadow: inset 0 0 0 1px transparent;
	}

	.pill:hover {
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.pill.active {
		box-shadow: inset 0 0 0 1px var(--border-selected);
	}

	.pill:disabled {
		opacity: 0.5;
	}

	.chip {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
		height: 18px;
		margin-left: -4px;
		padding: 0 5px 0 3px;
		border-radius: 3px;
		background: var(--bg);
		box-shadow: inset 0 0 0 1px var(--border-strong);
	}

	.chip.mixed {
		padding-left: 5px;
		color: var(--text-secondary);
	}

	.chip.missing .name {
		color: var(--text-warning);
		text-decoration: line-through;
	}

	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.spacer {
		width: var(--control);
		flex: none;
	}
</style>
