<script lang="ts">
	import type { GroupState } from '../../shared/types'
	import { app, post } from '../state.svelte'
	import Icon from './Icon.svelte'
	import Section from './Section.svelte'

	// A properties panel section: 40px title row, rows, 12px bottom padding, divider
	let { group }: { group: GroupState } = $props()

	const open = $derived(!app.collapsed[group.id])
	const toggle = () => (app.collapsed[group.id] = open)
</script>

<section class="group" class:open>
	<button class="title" aria-expanded={open} onclick={toggle}>
		<span class="chevron"><Icon name={open ? 'chevron-down' : 'chevron-right'} size={16} /></span>
		<span class="ellipsis">{group.label}</span>
	</button>

	{#if open}
		{#each group.styles ?? [] as style (style.kind)}
			<div class="row">
				<span class="style" title={style.mixed ? 'Selected layers use different styles' : style.name}>
					<span class="prefix"><Icon name="style" /></span>
					<span class="ellipsis">{style.name}</span>
				</span>
				<button
					class="icon-button"
					title="Detach style"
					aria-label="Detach style"
					disabled={app.busy}
					onclick={() => post({ type: 'detach-style', kind: style.kind })}
				>
					<Icon name="detach" />
				</button>
			</div>
			<p class="note">Detach the style to bind variables here.</p>
		{/each}

		{#if group.notice}
			<p class="note">{group.notice}</p>
		{/if}

		{#each group.sections as section, i (i)}
			<Section {section} />
		{/each}
	{/if}
</section>

<style>
	.group {
		border-bottom: 1px solid var(--border);
	}

	.group:last-child {
		border-bottom: none;
	}

	.group.open {
		padding-bottom: 12px;
	}

	.title {
		position: relative;
		display: flex;
		align-items: center;
		width: 100%;
		height: var(--title-row);
		padding: 0 8px 0 16px;
		font-weight: 550;
		letter-spacing: 0.01em;
		color: var(--text-secondary);
	}

	.group.open .title {
		color: var(--text);
	}

	/* Chevron sits in the left gutter and shows on hover, as in Figma's collapsible sections */
	.chevron {
		position: absolute;
		left: 0;
		width: 16px;
		display: grid;
		place-items: center;
		color: var(--icon-secondary);
		opacity: 0;
		transition: opacity 100ms ease-out;
	}

	.title:hover .chevron,
	.title:focus-visible .chevron {
		opacity: 1;
	}

	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) var(--control);
		column-gap: 8px;
		align-items: center;
		height: var(--row);
		padding: 0 8px 0 16px;
	}

	.style {
		display: flex;
		align-items: center;
		min-width: 0;
		height: var(--control);
		padding-right: 8px;
		border-radius: var(--radius);
		background: var(--bg-secondary);
	}

	.prefix {
		width: var(--control);
		display: grid;
		place-items: center;
		flex: none;
		color: var(--icon-secondary);
	}

	.note {
		padding: 4px 8px 4px 16px;
		color: var(--text-secondary);
	}
</style>
