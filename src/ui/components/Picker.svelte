<script lang="ts">
	import { onMount, tick, untrack } from 'svelte'
	import type { CollectionInfo, FieldState, VarItem } from '../../shared/types'
	import { app, closePicker, formatNum, inScope, isBoundTo, leaf, path, post } from '../state.svelte'
	import Icon from './Icon.svelte'
	import Swatch from './Swatch.svelte'

	// Variable picker as a popover anchored to the input, styled after Figma's variable picker
	let { field, anchor }: { field: FieldState; anchor: HTMLElement } = $props()

	const TYPE_NAME = { COLOR: 'Color', FLOAT: 'Number', BOOLEAN: 'Boolean' } as const
	const MARGIN = 8
	const MAX_WIDTH = 240
	const MAX_HEIGHT = 420
	const MIN_HEIGHT = 200

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
	let active = $state(-1)
	let listEl: HTMLDivElement | undefined = $state()
	let searchEl: HTMLInputElement | undefined = $state()

	// ---------- Placement: below the input, or above when there's more room, clamped to the iframe ----------

	let pos = $state({ left: 0, top: 0, width: 0, maxHeight: 0, above: false })

	function place() {
		const r = anchor.getBoundingClientRect()
		const vw = window.innerWidth
		const vh = window.innerHeight
		const width = Math.min(vw - MARGIN * 2, MAX_WIDTH)
		const left = Math.max(MARGIN, Math.min(r.left, vw - width - MARGIN))
		const below = vh - r.bottom - MARGIN - 4
		const aboveSpace = r.top - MARGIN - 4
		if (below >= Math.min(MAX_HEIGHT, MIN_HEIGHT * 1.5) || below >= aboveSpace) {
			pos = { left, width, top: r.bottom + 4, maxHeight: Math.min(MAX_HEIGHT, Math.max(below, MIN_HEIGHT)), above: false }
		} else {
			const maxHeight = Math.min(MAX_HEIGHT, aboveSpace)
			pos = { left, width, top: r.top - 4, maxHeight, above: true }
		}
		// Not enough room on either side: cover the window
		if (pos.maxHeight > vh - MARGIN * 2) pos = { ...pos, top: MARGIN, maxHeight: vh - MARGIN * 2, above: false }
		else if (!pos.above && pos.top + pos.maxHeight > vh - MARGIN) pos = { ...pos, top: vh - MARGIN - pos.maxHeight }
	}

	onMount(() => {
		// A partly scrolled-out input (keyboard focus) would push the popover off-screen
		anchor.scrollIntoView({ block: 'nearest' })
		place()
		searchEl?.focus()
		const onResize = () => place()
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	})

	// ---------- Data ----------

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

	/** Keeps folders together, root-level variables first, as Figma's picker lists them */
	function byFolder(items: VarItem[]) {
		const groups = new Map<string, VarItem[]>([['', []]])
		for (const i of items) {
			const f = path(i.name)
			if (!groups.has(f)) groups.set(f, [])
			groups.get(f)!.push(i)
		}
		return [...groups.values()].flat()
	}

	const sections = $derived.by(() => {
		if (!field.scopeReq.length || loadingScopes) return [{ title: '', items: byFolder(matches) }]
		const out: VarItem[] = []
		const inside: VarItem[] = []
		const unknown: VarItem[] = []
		for (const i of matches) (i.scopes === null ? unknown : inScope(i.scopes, field.scopeReq) ? inside : out).push(i)
		return [
			{ title: 'Out of scope', items: byFolder(out) },
			{ title: 'In scope', items: byFolder(inside) },
			{ title: 'Scope unknown', items: byFolder(unknown) },
		].filter(s => s.items.length)
	})

	const flat = $derived(sections.flatMap(s => s.items))

	$effect(() => {
		// Reset keyboard focus when the list changes shape
		void collectionId
		void query
		active = -1
	})

	// ---------- Actions ----------

	function choose(item: VarItem) {
		post({ type: 'bind', field: field.key, ref: item.ref })
		app.prefs.lastCollection[field.type] = collectionId
		post({ type: 'save-prefs', prefs: $state.snapshot(app.prefs) })
		closePicker()
	}

	async function move(delta: number) {
		if (!flat.length) return
		active = active < 0 ? (delta > 0 ? 0 : flat.length - 1) : (active + delta + flat.length) % flat.length
		await tick()
		listEl?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
		else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
		else if (e.key === 'Enter' && flat[Math.max(0, active)]) { e.preventDefault(); choose(flat[Math.max(0, active)]) }
		else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker() }
	}
</script>

<div class="backdrop" role="presentation" onpointerdown={closePicker}></div>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="menu"
	class:above={pos.above}
	role="dialog"
	aria-label="Choose a variable for {field.label}"
	tabindex="-1"
	style:left="{pos.left}px"
	style:top="{pos.top}px"
	style:width="{pos.width}px"
	style:max-height="{pos.maxHeight}px"
	{onkeydown}
>
	<header>
		<div class="titles">
			<span class="title ellipsis" title={field.label}>{field.label}</span>
			<span class="subtitle">{TYPE_NAME[field.type]}</span>
		</div>
		<button
			class="icon-button"
			class:spinning={app.collectionsLoading}
			title="Reload libraries"
			aria-label="Reload libraries"
			onclick={() => post({ type: 'refresh-collections' })}
		>
			<Icon name="refresh" />
		</button>
		<button class="icon-button" title="Close" aria-label="Close" onclick={closePicker}>
			<Icon name="close" />
		</button>
	</header>

	<label class="search">
		<span class="search-icon"><Icon name="search" /></span>
		<input bind:this={searchEl} bind:value={query} placeholder="Search" spellcheck="false" aria-label="Search variables" />
	</label>

	<div class="filter">
		<span class="select">
			<select bind:value={collectionId} aria-label="Collection">
				{#each libraries as [library, cols] (library)}
					<optgroup label={library}>
						{#each cols as c (c.id)}
							<option value={c.id}>{c.name}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
			<span class="select-chevron"><Icon name="chevron-down" size={16} /></span>
		</span>
		{#if loadingScopes && entry}
			<span class="progress tabular" title="Importing variables to read their scopes">
				{entry.items.length - entry.pending}/{entry.items.length}
			</span>
		{/if}
	</div>

	{#if loadingScopes && entry}
		<span class="bar" aria-hidden="true">
			<span style:width={`${((entry.items.length - entry.pending) / Math.max(1, entry.items.length)) * 100}%`}></span>
		</span>
	{/if}

	<div class="list" bind:this={listEl}>
		{#if app.collectionsError}<p class="hint error">{app.collectionsError}</p>{/if}
		{#if !collectionId}
			<p class="hint">{app.collectionsLoading ? 'Loading libraries…' : 'No variable collections available'}</p>
		{:else if !entry}
			<p class="hint">Loading variables…</p>
		{:else if entry.error}
			<p class="hint error">{entry.error}</p>
		{:else if !matches.length}
			<p class="hint">{query ? 'No matches' : `No ${TYPE_NAME[field.type].toLowerCase()} variables in this collection`}</p>
		{:else}
			{#each sections as section (section.title)}
				{#if section.title}<h3 class="section">{section.title}</h3>{/if}
				{#each section.items as item, j (item.ref)}
					{@const index = flat.indexOf(item)}
					{@const folder = path(item.name)}
					{#if folder && folder !== path(section.items[j - 1]?.name ?? '')}
						<p class="folder ellipsis" title={folder.slice(0, -1)}>{folder.slice(0, -1)}</p>
					{/if}
					<button
						class="item"
						class:active={index === active}
						class:current={isBoundTo(field, item)}
						data-index={index}
						title={item.name}
						onpointermove={() => (active = index)}
						onclick={() => choose(item)}
					>
						<span class="chit">
							{#if item.type === 'COLOR'}
								{#if item.preview?.t === 'color'}<Swatch hex={item.preview.hex} a={item.preview.a} size={16} />{:else}<span class="chit-empty"></span>{/if}
							{:else}
								<Icon name={item.type === 'BOOLEAN' ? 'boolean' : 'number'} />
							{/if}
						</span>
						<span class="name ellipsis">{leaf(item.name)}</span>
						{#if item.preview?.t === 'num'}<span class="value tabular">{formatNum(item.preview.v)}</span>{/if}
						{#if item.preview?.t === 'bool'}<span class="value">{item.preview.v ? 'True' : 'False'}</span>{/if}
						{#if isBoundTo(field, item)}<span class="check"><Icon name="check" /></span>{/if}
					</button>
				{/each}
			{/each}
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
	}

	.menu {
		position: fixed;
		z-index: 21;
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-radius: var(--radius-large);
		background: var(--bg);
		box-shadow: var(--elevation-popover);
		overflow: hidden;
		outline: none;
		transform-origin: top left;
		animation: enter 120ms cubic-bezier(0.2, 0, 0, 1);
	}

	.menu.above {
		transform: translateY(-100%);
		transform-origin: bottom left;
		animation-name: enter-above;
	}

	@keyframes enter {
		from {
			opacity: 0;
			transform: scale(0.97);
		}
	}

	@keyframes enter-above {
		from {
			opacity: 0;
			transform: translateY(-100%) scale(0.97);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.menu {
			animation: none;
		}
	}

	header {
		display: flex;
		align-items: center;
		gap: 4px;
		height: var(--title-row);
		padding: 0 8px 0 16px;
		flex: none;
		box-shadow: inset 0 -1px 0 var(--border);
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
		letter-spacing: 0.01em;
	}

	.subtitle {
		flex: none;
		color: var(--text-secondary);
	}

	.search {
		display: flex;
		align-items: center;
		height: 41px;
		padding: 0 16px 0 8px;
		border-bottom: 1px solid var(--border);
		flex: none;
	}

	.search-icon {
		width: var(--control);
		display: grid;
		place-items: center;
		color: var(--icon-secondary);
		flex: none;
	}

	.search input {
		flex: 1;
		min-width: 0;
		height: var(--control);
		padding-left: 4px;
		border: none;
		outline: none;
		background: none;
		color: var(--text);
	}

	.search input::placeholder {
		color: var(--text-tertiary);
	}

	.filter {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 41px;
		padding: 0 16px 0 8px;
		border-bottom: 1px solid var(--border);
		flex: none;
	}

	/* Figma's dropdown button: bordered, white, chevron at the end */
	.select {
		position: relative;
		display: flex;
		min-width: 0;
		max-width: 100%;
	}

	select {
		appearance: none;
		min-width: 0;
		max-width: 100%;
		height: var(--control);
		padding: 0 24px 0 8px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg);
		color: var(--text);
		text-overflow: ellipsis;
		outline: none;
	}

	select:focus-visible {
		border-color: var(--border-selected);
	}

	.select-chevron {
		position: absolute;
		right: 4px;
		top: 4px;
		color: var(--icon);
		pointer-events: none;
	}

	.progress {
		margin-left: auto;
		color: var(--text-secondary);
		flex: none;
	}

	.bar {
		display: block;
		height: 2px;
		margin-top: -2px;
		background: transparent;
		flex: none;
		position: relative;
	}

	.bar span {
		display: block;
		height: 100%;
		background: var(--bg-brand);
		transition: width 200ms ease-out;
	}

	.spinning :global(svg) {
		animation: spin 900ms linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 8px 0;
	}

	.section {
		position: sticky;
		top: -8px;
		z-index: 1;
		display: flex;
		align-items: center;
		height: var(--row);
		padding: 0 16px;
		background: var(--bg);
		font-size: 11px;
		font-weight: 550;
		letter-spacing: 0.01em;
		color: var(--text-secondary);
	}

	.folder {
		height: var(--row);
		padding: 8px 16px;
		color: var(--text);
	}

	.item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		height: var(--row);
		padding: 0 16px 0 20px;
	}

	.item.active {
		background: var(--bg-hover);
	}

	.item.current {
		background: var(--bg-selected);
	}

	.chit {
		width: 16px;
		height: 16px;
		display: grid;
		place-items: center;
		flex: none;
		color: var(--icon-secondary);
	}

	.chit :global(svg) {
		margin: -4px;
	}

	.chit-empty {
		width: 16px;
		height: 16px;
		border-radius: 20%;
		background: var(--bg-tertiary);
	}

	.name {
		flex: 1;
	}

	.value {
		flex: none;
		color: var(--text-secondary);
	}

	.check {
		flex: none;
		margin: 0 -4px;
		color: var(--icon-brand);
	}

	.hint {
		padding: 8px 16px;
		color: var(--text-secondary);
	}

	.error {
		color: var(--text-danger);
	}
</style>
