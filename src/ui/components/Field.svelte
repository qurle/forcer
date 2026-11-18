<script lang="ts">
	import type { FieldState } from '../../shared/types'
	import { app, leaf, openPicker, post } from '../state.svelte'
	import Icon from './Icon.svelte'
	import Swatch from './Swatch.svelte'
	import Value from './Value.svelte'

	// One Figma-style input: prefix (letter, icon or color chit), value or bound variable, detach on hover
	let { field }: { field: FieldState } = $props()

	let input: HTMLButtonElement | undefined = $state()

	const bound = $derived(field.bound && field.bound !== 'mixed' ? field.bound : null)
	const active = $derived(app.picker?.key === field.key)
	const color = $derived(field.value.t === 'color' ? field.value : null)
	const title = $derived(
		bound
			? `${field.label}: ${bound.name}${bound.collection ? ` · ${bound.collection}` : ''}`
			: field.bound === 'mixed'
				? `${field.label}: layers use different variables`
				: `${field.label}: bind a variable`,
	)
</script>

<div class="field" class:wide={field.type === 'COLOR'}>
	{#if field.aside}<span class="aside tabular">{field.aside}</span>{/if}
	<div class="control" class:bound={!!field.bound} class:active>
		<button
			bind:this={input}
			class="input"
			{title}
			disabled={app.busy}
			aria-haspopup="dialog"
			aria-expanded={active}
			onclick={() => input && openPicker(field, input)}
		>
			<span class="prefix" class:letter={field.prefix && 'text' in field.prefix}>
				{#if field.type === 'COLOR'}
					{#if color}<Swatch hex={color.hex} a={color.a} />{:else}<span class="chit-empty"></span>{/if}
				{:else if field.prefix && 'text' in field.prefix}
					{field.prefix.text}
				{:else if field.prefix}
					<Icon name={field.prefix.icon} />
				{/if}
			</span>
			{#if bound}
				<span class="name ellipsis" class:missing={bound.missing}>{leaf(bound.name)}</span>
			{:else if field.bound === 'mixed'}
				<span class="name ellipsis mixed">Mixed</span>
			{:else}
				<Value value={field.value} boolLabels={['Shown', 'Hidden']} />
			{/if}
		</button>
		{#if field.bound}
			<button
				class="detach icon-button"
				title="Detach variable"
				aria-label="Detach variable from {field.label}"
				disabled={app.busy}
				onclick={() => post({ type: 'unbind', field: field.key })}
			>
				<Icon name="detach" />
			</button>
		{/if}
	</div>
</div>

<style>
	.field {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.field.wide {
		grid-column: 1 / 3;
	}

	.aside {
		width: 32px;
		flex: none;
		color: var(--text-secondary);
	}

	.control {
		position: relative;
		flex: 1;
		min-width: 0;
		height: var(--control);
		border-radius: var(--radius);
		background: var(--bg-secondary);
	}

	/* Hover and focus draw a 1px border inside, like Figma's inputs */
	.control::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: inset 0 0 0 1px transparent;
		pointer-events: none;
	}

	.control:hover::after {
		box-shadow: inset 0 0 0 1px var(--border);
	}

	/* Bound fields are outlined instead of filled */
	.control.bound {
		background: var(--bg);
	}

	.control.bound::after {
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.control.active::after,
	.control:has(.input:focus-visible)::after {
		box-shadow: inset 0 0 0 1px var(--border-selected);
	}

	.input {
		display: flex;
		align-items: center;
		width: 100%;
		height: 100%;
		padding-right: 8px;
		border-radius: inherit;
		outline: none;
		overflow: hidden;
	}

	.input:disabled {
		opacity: 0.5;
	}

	.control.bound:hover .input,
	.control.bound:focus-within .input {
		padding-right: var(--control);
	}

	.prefix {
		width: var(--control);
		height: var(--control);
		display: grid;
		place-items: center;
		flex: none;
		color: var(--icon-secondary);
	}

	.prefix.letter {
		color: var(--text-secondary);
	}

	.chit-empty {
		width: 14px;
		height: 14px;
		border-radius: 20%;
		background: var(--bg-tertiary);
	}

	.name {
		flex: 1;
	}

	.name.mixed {
		color: var(--text-secondary);
	}

	.name.missing {
		color: var(--text-danger);
		text-decoration: line-through;
	}

	.detach {
		position: absolute;
		top: 0;
		right: 0;
		opacity: 0;
		pointer-events: none;
	}

	.control:hover .detach,
	.control:focus-within .detach {
		opacity: 1;
		pointer-events: auto;
	}

	.detach:hover {
		background: none;
		color: var(--icon);
	}
</style>
