<script lang="ts">
	import type { FieldState, Section } from '../../shared/types'
	import { app } from '../state.svelte'
	import Field from './Field.svelte'
	import Icon from './Icon.svelte'

	// Packs fields into Figma's row grid: [input][input][24px]. Colors take both input columns.
	// Fields past `shown` hide behind a chevron placed right after the last visible field
	let { section }: { section: Section } = $props()

	function pack(fields: FieldState[]) {
		const rows: FieldState[][] = []
		let pair: FieldState[] = []
		for (const f of fields) {
			if (f.type === 'COLOR') {
				if (pair.length) rows.push(pair)
				pair = []
				rows.push([f])
			} else {
				pair.push(f)
				if (pair.length === 2) rows.push(pair), (pair = [])
			}
		}
		if (pair.length) rows.push(pair)
		return rows
	}

	const shown = $derived(section.shown ?? section.fields.length)
	const extra = $derived(section.fields.slice(shown))
	const moreKey = $derived(shown && extra.length ? extra[0].key : '')
	const expanded = $derived(!!moreKey && !!app.expanded[moreKey])

	const lead = $derived(pack(section.fields.slice(0, shown)))
	const rows = $derived(expanded ? [...lead, ...pack(extra)] : lead)
</script>

<div class="section" class:dim={section.dim}>
	{#if section.title}
		<div class="sub">
			<span class="ellipsis">{section.title}</span>
			{#if section.dim}<span class="hidden-tag">Hidden</span>{/if}
		</div>
	{/if}
	{#if section.note}<p class="note">{section.note}</p>{/if}
	{#each rows as row, i (row[0].key)}
		<div class="row">
			{#each row as field (field.key)}
				<Field {field} />
			{/each}
			{#if moreKey && i === lead.length - 1}
				<button
					class="more"
					class:open={expanded}
					title={expanded ? `Hide ${section.more}` : `Show ${section.more}`}
					aria-label="Show {section.more}"
					aria-expanded={expanded}
					onclick={() => (app.expanded[moreKey] = !expanded)}
				>
					<Icon name="chevron-down" />
				</button>
			{/if}
		</div>
	{/each}
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) var(--control);
		column-gap: 8px;
		align-items: center;
		height: var(--row);
		padding: 0 8px 0 16px;
	}

	/* Chevron hugs the last visible field: it takes the next grid cell and pulls back over the column gap */
	.more {
		justify-self: start;
		width: 16px;
		height: var(--control);
		margin-left: -6px;
		display: grid;
		place-items: center;
		border-radius: var(--radius);
		color: var(--icon-secondary);
	}

	.more:hover {
		color: var(--icon);
	}

	.more :global(svg) {
		margin: 0 -4px;
		transition: transform 120ms ease-out;
	}

	.more.open :global(svg) {
		transform: rotate(180deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.more :global(svg) {
			transition: none;
		}
	}

	.sub {
		display: flex;
		align-items: center;
		gap: 6px;
		height: var(--row);
		padding: 0 8px 0 16px;
	}

	.hidden-tag,
	.note {
		color: var(--text-secondary);
	}

	.note {
		padding: 4px 8px 4px 16px;
	}

	.sub + .note {
		margin-top: -8px;
	}

	.dim .row :global(.field),
	.dim .sub > span:first-child {
		opacity: 0.5;
	}
</style>
