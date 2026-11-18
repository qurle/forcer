<script lang="ts">
	import { onMount } from 'svelte'
	import { app, post } from './state.svelte'
	import Group from './components/Group.svelte'
	import Icon from './components/Icon.svelte'
	import Picker from './components/Picker.svelte'

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
			<div class="titles">
				<span class="title">{sel.title}</span>
				<span class="subtitle">{sel.subtitle}</span>
			</div>
			{#if sel.instance}
				<span class="instance" title="Bindings on instance layers are overrides">
					<Icon name="instance" size={12} /> Overriding the instance
				</span>
			{/if}
		</header>

		{#if sel.readLimit}
			<p class="limit">Values from the first {sel.readLimit} of {sel.count} layers. Bindings apply to all.</p>
		{/if}

		<div class="groups">
			{#each sel.groups as group (group.id)}
				<Group {group} />
			{:else}
				<p class="empty">No bindable fields shared by the selected layers.</p>
			{/each}
		</div>
	{/if}

	{#if app.picker}
		<Picker field={app.picker} />
	{/if}
</main>

<style>
	main {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	main.busy {
		cursor: progress;
	}

	header {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px var(--gutter);
		border-bottom: 1px solid var(--border);
		flex: none;
	}

	.titles {
		display: flex;
		align-items: baseline;
		gap: 6px;
		min-width: 0;
	}

	.title {
		font-weight: 550;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.subtitle {
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.instance {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 20px;
		padding: 0 6px;
		border-radius: 4px;
		background: var(--bg-component);
		color: var(--text-component);
	}

	.limit {
		padding: 8px var(--gutter);
		color: var(--text-secondary);
		border-bottom: 1px solid var(--border);
	}

	.groups {
		flex: 1;
		overflow-y: auto;
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
