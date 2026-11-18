<script lang="ts">
	import { onMount } from 'svelte'
	import { app, post } from './state.svelte'
	import Group from './components/Group.svelte'
	import Icon from './components/Icon.svelte'
	import Picker from './components/Picker.svelte'
	import Resizer from './components/Resizer.svelte'

	onMount(() => post({ type: 'ready' }))

	const sel = $derived(app.selection)
</script>

<main class:busy={app.busy}>
	{#if !sel}
		<p class="empty">Loading…</p>
	{:else if sel.count === 0}
		<div class="empty">
			<p class="empty-title">Nothing selected</p>
			<p>Select layers to bind variables to their fields, scopes or not.</p>
		</div>
	{:else}
		<header>
			<div class="head">
				<span class="title ellipsis" title={sel.title}>{sel.title}</span>
				<span class="subtitle">{sel.subtitle}</span>
			</div>
			{#if sel.instance}
				<p class="banner" title="Variables bound inside an instance are stored as overrides">
					<span class="banner-icon"><Icon name="instance" /></span>
					Bindings override the instance
				</p>
			{/if}
			{#if sel.readLimit}
				<p class="banner">
					<span class="banner-icon"><Icon name="info" /></span>
					Values from the first {sel.readLimit} of {sel.count} layers. Bindings apply to all.
				</p>
			{/if}
		</header>

		<div class="groups">
			{#each sel.groups as group (group.id)}
				<Group {group} />
			{:else}
				<p class="empty">No bindable fields shared by the selected layers.</p>
			{/each}
		</div>
	{/if}

	{#if app.picker && app.anchor}
		<Picker field={app.picker} anchor={app.anchor} />
	{/if}

	<Resizer />
</main>

<style>
	/* The whole panel scrolls, header included */
	main {
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	main.busy {
		cursor: progress;
	}

	header {
		flex: none;
		border-bottom: 1px solid var(--border);
	}

	/* Mirrors Figma's "Frame" header: 13px semibold title */
	.head {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
		padding: 13px 8px 13px 16px;
	}

	.title {
		font-size: 13px;
		font-weight: 550;
		line-height: 22px;
		letter-spacing: -0.0025em;
	}

	.subtitle {
		flex: none;
		color: var(--text-secondary);
	}

	.banner {
		display: flex;
		align-items: flex-start;
		margin: -4px 8px 12px 16px;
		padding: 4px 8px 4px 0;
		border-radius: var(--radius);
		background: var(--bg-secondary);
		color: var(--text-secondary);
	}

	.banner + .banner {
		margin-top: -4px;
	}

	/* 24px icon slot aligned to the first 16px text line */
	.banner-icon {
		width: var(--control);
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: none;
		color: var(--icon-secondary);
	}

	.banner-icon :global(svg) {
		margin: -4px 0;
	}

	.groups {
		/* Room for the resizer below the last row */
		padding-bottom: 16px;
	}

	.empty {
		margin: auto;
		max-width: 220px;
		padding: 24px;
		text-align: center;
		color: var(--text-secondary);
	}

	.empty-title {
		color: var(--text);
		font-weight: 550;
		margin-bottom: 4px;
	}
</style>
