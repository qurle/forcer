import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { viteSingleFile } from 'vite-plugin-singlefile'

// UI iframe: Figma loads it from the __html__ string, so everything must be inlined into one HTML file
export default defineConfig({
	root: 'src/ui',
	plugins: [svelte(), viteSingleFile()],
	build: {
		target: 'es2020',
		outDir: '../../dist/ui',
		emptyOutDir: true,
	},
})
