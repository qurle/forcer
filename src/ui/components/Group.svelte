<script lang="ts">
	import type { GroupState } from '../../shared/types'
	import { app, post } from '../state.svelte'
	import FieldRow from './FieldRow.svelte'
	import Icon from './Icon.svelte'

	let { group }: { group: GroupState } = $props()

	const open = $derived(!app.collapsed[group.id])
	const toggle = () => (app.collapsed[group.id] = open)
</script>

<section class="group">
	<button class="head" aria-expanded={open} onclick={toggle}>
		<span class="chevron" class:open><Icon name="chevron" /></span>
		<span>{group.label}</span>
	</button>

	{#if open}
		<div class="body">
			{#each group.styles ?? [] as style (style.kind)}
				<div class="style">
					<span class="style-chip" title={style.mixed ? 'Selected layers use different styles' : style.name}>
						<Icon name="style" />
						<span class="style-name">{style.name}</span>
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
				<p class="notice">{group.notice}</p>
			{/if}

			{#each group.sections as section, i (i)}
				{#if section.title}<h3 class="sub">{section.title}</h3>{/if}
				{#if section.note}<p class="note">{section.note}</p>{/if}
				{#each section.fields as field (field.key)}
					<FieldRow {field} context={section.title ?? group.label} />
				{/each}
			{/each}
		</div>
	{/if}
</section>

<style>
	.group {
		border-bottom: 1px solid var(--border);
	}

	.head {
		display: flex;
		align-items: center;
		gap: 2px;
		width: 100%;
		height: 40px;
		padding: 0 var(--gutter) 0 4px;
		font-weight: 550;
		text-align: left;
	}

	.chevron {
		width: 12px;
		display: grid;
		place-items: center;
		color: var(--icon-secondary);
		transition: transform 120ms ease-out;
	}

	.chevron.open {
		transform: rotate(90deg);
	}

	.body {
		padding-bottom: 8px;
		margin-top: -4px;
	}

	.sub {
		font-size: 11px;
		font-weight: 450;
		color: var(--text);
		padding: 8px var(--gutter) 2px;
	}

	.note,
	.notice {
		padding: 2px var(--gutter) 6px;
		color: var(--text-secondary);
	}

	.notice {
		margin: 0 8px 4px var(--gutter);
		padding: 6px 8px;
		border-radius: var(--radius);
		background: var(--bg-warning);
		color: var(--text-warning);
	}

	.style {
		display: flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 8px 0 var(--gutter);
	}

	.style-chip {
		flex: 1;
		min-width: 0;
		height: var(--control);
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 0 8px 0 4px;
		border-radius: var(--radius);
		background: var(--bg-secondary);
		color: var(--icon-secondary);
	}

	.style-name {
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
