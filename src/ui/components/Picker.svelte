<script lang="ts">
	import { tick, untrack } from 'svelte'
	import type { CollectionInfo, FieldState, VarItem } from '../../shared/types'
	import { app, formatNum, inScope, isBoundTo, leaf, path, post } from '../state.svelte'
	import Icon from './Icon.svelte'
	import Swatch from './Swatch.svelte'

	let { field }: { field: FieldState } = $props()

	const TYPE_NAME = { COLOR: 'color', FLOAT: 'number', BOOLEAN: 'boolean' } as const

	function initialCollection(): string {
		const cols = app.collections
		const b = field.bound
		if (b && b !== 'mixed' && b.collection) {
			const c = cols.find(c => c.name === b.collection && (c.source === 'library') === b.remote)
			if (c) return c.id
		}
		const last = app.prefs.lastCollection[field.type]
		if (last && cols.some(c => c.id === last)) return last
		return cols[0]?.id ?? ''
	}

	let collectionId = $state(untrack(initialCollection))
	let query = $state('')
	let active = $state(0)
	let listEl: HTMLDivElement | undefined = $state()

	// Collections may arrive after the picker opened
	$effect(() => {
		if (!collectionId && app.collections.length) collectionId = untrack(initialCollection)
	})

	// Request variables when the collection changes (or resume an unfinished load)
	$effect(() => {
		const id = collectionId
		if (!id) return
		const entry = untrack(() => app.vars[id])
		if (!entry || entry.pending > 0 || entry.error) post({ type: 'load-variables', collectionId: id })
	})

	const libraries = $derived.by(() => {
		const map = new Map<string, CollectionInfo[]>()
		for (const c of app.collections) {
			if (!map.has(c.library)) map.set(c.library, [])
			map.get(c.library)!.push(c)
		}
		return [...map]
	})

	const entry = $derived(app.vars[collectionId])
	const ofType = $derived((entry?.items ?? []).filter(i => i.type === field.type))
	const tokens = $derived(query.trim().toLowerCase().split(/\s+/).filter(Boolean))
	const matches = $derived(ofType.filter(i => tokens.every(t => i.name.toLowerCase().includes(t))))
	const loadingScopes = $derived(!!entry && entry.pending > 0)

	const sections = $derived.by(() => {
		if (!field.scopeReq.length) return [{ title: '', items: matches }]
		if (loadingScopes) return [{ title: '', items: matches }]
		const out: VarItem[] = []
		const inside: VarItem[] = []
		const unknown: VarItem[] = []
		for (const i of matches) (i.scopes === null ? unknown : inScope(i.scopes, field.scopeReq) ? inside : out).push(i)
		return [
			{ title: 'Out of scope', items: out },
			{ title: 'In scope', items: inside },
			{ title: 'Scope unknown', items: unknown },
		].filter(s => s.items.length)
	})

	const flat = $derived(sections.flatMap(s => s.items))

	$effect(() => {
		// Reset keyboard focus when the list changes shape
		void collectionId
		void query
		active = 0
	})

	function choose(item: VarItem) {
		post({ type: 'bind', field: field.key, ref: item.ref })
		app.prefs.lastCollection[field.type] = collectionId
		post({ type: 'save-prefs', prefs: $state.snapshot(app.prefs) })
		app.picker = null
	}

	async function move(delta: number) {
		if (!flat.length) return
		active = (active + delta + flat.length) % flat.length
		await tick()
		listEl?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
		else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
		else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); choose(flat[active]) }
		else if (e.key === 'Escape') { e.preventDefault(); app.picker = null }
	}

	const focus = (el: HTMLElement) => el.focus()
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="picker" role="dialog" aria-label="Choose variable" tabindex="-1" {onkeydown}>
	<header>
		<div class="titles">
			<span class="title">{app.pickerContext || field.label}</span>
			<span class="subtitle">{TYPE_NAME[field.type]} variables</span>
		</div>
		<button class="icon-button" title="Close" aria-label="Close" onclick={() => (app.picker = null)}>
			<Icon name="close" />
		</button>
	</header>

	{#if app.selection?.instance}
		<p class="warning"><Icon name="instance" size={12} /> Overriding the instance</p>
	{/if}

	<div class="controls">
		<div class="select-row">
			<select bind:value={collectionId} aria-label="Collection">
				{#each libraries as [library, cols] (library)}
					<optgroup label={library}>
						{#each cols as c (c.id)}
							<option value={c.id}>{c.name}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
			<button
				class="icon-button"
				class:spinning={app.collectionsLoading}
				title="Reload libraries"
				aria-label="Reload libraries"
				onclick={() => post({ type: 'refresh-collections' })}
			>
				<Icon name="refresh" />
			</button>
		</div>
		<label class="search">
			<Icon name="search" />
			<input use:focus bind:value={query} placeholder="Search" spellcheck="false" />
		</label>
		{#if app.collectionsError}<p class="hint error">{app.collectionsError}</p>{/if}
	</div>

	{#if loadingScopes && entry}
		<div class="progress" title="Importing variables to read their scopes">
			<span>Reading scopes {entry.items.length - entry.pending}/{entry.items.length}</span>
			<span class="bar"><span style:width={`${((entry.items.length - entry.pending) / Math.max(1, entry.items.length)) * 100}%`}></span></span>
		</div>
	{/if}

	<div class="list" bind:this={listEl}>
		{#if !collectionId}
			<p class="hint">{app.collectionsLoading ? 'Loading libraries…' : 'No variable collections available'}</p>
		{:else if !entry}
			<p class="hint">Loading variables…</p>
		{:else if entry.error}
			<p class="hint error">{entry.error}</p>
		{:else if !matches.length}
			<p class="hint">{query ? 'No matches' : `No ${TYPE_NAME[field.type]} variables in this collection`}</p>
		{:else}
			{#each sections as section (section.title)}
				{#if section.title}<h3 class="section">{section.title}</h3>{/if}
				{#each section.items as item (item.ref)}
					{@const index = flat.indexOf(item)}
					<button
						class="item"
						class:active={index === active}
						class:current={isBoundTo(field, item)}
						data-index={index}
						title={item.name}
						onmouseenter={() => (active = index)}
						onclick={() => choose(item)}
					>
						{#if item.type === 'COLOR'}
							{#if item.preview?.t === 'color'}<Swatch hex={item.preview.hex} a={item.preview.a} />{:else}<span class="swatch-placeholder"></span>{/if}
						{/if}
						<span class="name"><span class="path">{path(item.name)}</span>{leaf(item.name)}</span>
						{#if item.preview?.t === 'num'}<span class="value">{formatNum(item.preview.v)}</span>{/if}
						{#if item.preview?.t === 'bool'}<span class="value">{item.preview.v ? 'True' : 'False'}</span>{/if}
						{#if isBoundTo(field, item)}<span class="check"><Icon name="check" /></span>{/if}
					</button>
				{/each}
			{/each}
		{/if}
	</div>
</div>

<style>
	.picker {
		position: fixed;
		inset: 0;
		z-index: 10;
		display: flex;
		flex-direction: column;
		background: var(--bg);
		outline: none;
		animation: enter 140ms cubic-bezier(0.2, 0, 0, 1);
	}

	@keyframes enter {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.picker {
			animation: none;
		}
	}

	header {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 40px;
		padding: 0 8px 0 var(--gutter);
		border-bottom: 1px solid var(--border);
		flex: none;
	}

	.titles {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: 6px;
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

	.warning {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 8px 8px 0 var(--gutter);
		padding: 4px 8px;
		border-radius: var(--radius);
		background: var(--bg-component);
		color: var(--text-component);
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 8px 8px 8px var(--gutter);
		flex: none;
	}

	.select-row {
		display: flex;
		gap: 4px;
	}

	select {
		flex: 1;
		min-width: 0;
		height: var(--control);
		padding: 0 6px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg);
	}

	.search {
		display: flex;
		align-items: center;
		gap: 4px;
		height: var(--control);
		margin-right: 28px;
		padding: 0 8px 0 4px;
		border-radius: var(--radius);
		background: var(--bg-secondary);
		color: var(--icon-secondary);
	}

	.search:focus-within {
		box-shadow: inset 0 0 0 1px var(--border-selected);
	}

	.search input {
		flex: 1;
		min-width: 0;
		border: none;
		outline: none;
		background: none;
		color: var(--text);
	}

	.search input::placeholder {
		color: var(--text-tertiary);
	}

	.spinning :global(svg) {
		animation: spin 900ms linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.progress {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0 var(--gutter) 6px;
		color: var(--text-secondary);
		flex: none;
	}

	.bar {
		flex: 1;
		height: 2px;
		border-radius: 1px;
		background: var(--bg-tertiary);
		overflow: hidden;
	}

	.bar span {
		display: block;
		height: 100%;
		background: var(--bg-brand);
		transition: width 200ms ease-out;
	}

	.list {
		flex: 1;
		overflow-y: auto;
		padding: 0 0 8px;
		border-top: 1px solid var(--border);
	}

	.section {
		position: sticky;
		top: 0;
		padding: 10px var(--gutter) 4px;
		background: var(--bg);
		font-size: 11px;
		font-weight: 550;
		color: var(--text-secondary);
	}

	.item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 28px;
		padding: 0 var(--gutter);
		text-align: left;
	}

	.item.active {
		background: var(--bg-hover);
	}

	.item.current {
		background: var(--bg-selected);
	}

	.swatch-placeholder {
		width: 14px;
		height: 14px;
		border-radius: 3px;
		background: var(--bg-tertiary);
		flex: none;
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.path {
		color: var(--text-secondary);
	}

	.value {
		color: var(--text-secondary);
		font-variant-numeric: tabular-nums;
	}

	.check {
		color: var(--text-brand);
	}

	.hint {
		padding: 16px var(--gutter);
		color: var(--text-secondary);
	}

	.controls .hint {
		padding: 0;
	}

	.error {
		color: var(--text-warning);
	}
</style>
