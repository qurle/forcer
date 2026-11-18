import { defineConfig } from 'vite'

// Main thread (Figma sandbox): a single IIFE file, no DOM, conservative syntax target
export default defineConfig({
	build: {
		target: 'es2017',
		outDir: 'dist/code',
		emptyOutDir: true,
		lib: {
			entry: 'src/code/main.ts',
			name: 'forcer',
			formats: ['iife'],
			fileName: () => 'code.js',
		},
	},
})
