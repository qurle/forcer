<script lang="ts">
	type Name = 'chevron' | 'detach' | 'close' | 'search' | 'style' | 'instance' | 'refresh' | 'check'
	let { name, size = 16 }: { name: Name; size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
	{#if name === 'chevron'}
		<path d="M6 4.5 9.5 8 6 11.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
	{:else if name === 'detach'}
		<path
			d="M7 4.5 8.4 3.1a2.5 2.5 0 0 1 3.5 3.5L10.5 8M9 11.5l-1.4 1.4a2.5 2.5 0 0 1-3.5-3.5L5.5 8M3 3l10 10"
			stroke="currentColor"
			stroke-linecap="round"
		/>
	{:else if name === 'close'}
		<path d="m4.5 4.5 7 7m0-7-7 7" stroke="currentColor" stroke-linecap="round" />
	{:else if name === 'search'}
		<circle cx="7" cy="7" r="3.5" stroke="currentColor" />
		<path d="m9.6 9.6 2.9 2.9" stroke="currentColor" stroke-linecap="round" />
	{:else if name === 'style'}
		<circle cx="5.5" cy="5.5" r="1.5" fill="currentColor" />
		<circle cx="10.5" cy="5.5" r="1.5" fill="currentColor" />
		<circle cx="5.5" cy="10.5" r="1.5" fill="currentColor" />
		<circle cx="10.5" cy="10.5" r="1.5" fill="currentColor" />
	{:else if name === 'instance'}
		<path d="M8 3.5 12.5 8 8 12.5 3.5 8Z" stroke="currentColor" stroke-linejoin="round" />
	{:else if name === 'refresh'}
		<path d="M12 8a4 4 0 1 1-1.2-2.85M12 3.5v2.5H9.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
	{:else if name === 'check'}
		<path d="m4.5 8.5 2.2 2.2 4.8-5.2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" />
	{/if}
</svg>

<style>
	svg {
		display: block;
		flex: none;
	}
</style>
