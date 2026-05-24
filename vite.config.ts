import { defineConfig } from 'vite-plus'

export default defineConfig({
	lint: {
		ignorePatterns: [
			'workspace/**',
			'built-packages/**',
			'.verdaccio-cache/**',
			'fixtures/**/scripts/*.ts',
		],
		options: {
			typeAware: true,
			typeCheck: true,
		},
		rules: {
			eqeqeq: ['warn', 'always', { null: 'never' }],
			'no-debugger': 'error',
			'no-empty': ['warn', { allowEmptyCatch: true }],
			'prefer-const': ['warn', { destructuring: 'all' }],
		},
	},
	fmt: {
		ignorePatterns: [
			'workspace/**',
			'built-packages/**',
			'.verdaccio-cache/**',
			'node_modules/**',
			'pnpm-lock.yaml',
		],
		useTabs: true,
		tabWidth: 2,
		singleQuote: true,
		printWidth: 80,
		semi: false,
		trailingComma: 'all',
		overrides: [
			{
				files: ['**/*.json', '**/package.json'],
				options: {
					useTabs: false,
					tabWidth: 2,
				},
			},
			{
				files: ['**/*.json5'],
				options: {
					singleQuote: false,
					quoteProps: 'preserve',
				},
			},
			{
				files: ['**/*.{yml,yaml}'],
				options: {
					singleQuote: false,
				},
			},
		],
	},
	staged: {
		'*.{js,ts,tsx,vue,svelte,json,json5,yml,yaml,md}': 'vp check --fix',
	},
})
