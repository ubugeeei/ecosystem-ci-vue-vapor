import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

const VAPOR_RUNTIME_ALIAS = 'vue/dist/vue.runtime-with-vapor.esm-bundler.js'

const ignoredDirectories = new Set([
	'.git',
	'.nuxt',
	'.output',
	'.vitepress/cache',
	'coverage',
	'dist',
	'node_modules',
	'storybook-static',
])

export function enableVaporModeForVueFiles(rootDir: string): number {
	let patched = 0
	for (const file of listVueFiles(rootDir)) {
		const source = fs.readFileSync(file, 'utf-8')
		const next = source.replace(
			/<template\b(?![^>]*\bvapor\b)/,
			'<template vapor',
		)
		if (next !== source) {
			fs.writeFileSync(file, next)
			patched++
		}
	}
	console.log(`enabled Vapor mode for ${patched} Vue SFC(s) in ${rootDir}`)
	return patched
}

export function installNuxtVaporInterop(rootDir: string) {
	const moduleDir = path.join(rootDir, 'ecosystem-ci-vapor')
	const runtimeDir = path.join(moduleDir, 'runtime')
	fs.mkdirSync(runtimeDir, { recursive: true })
	fs.writeFileSync(
		path.join(moduleDir, 'module.ts'),
		`import { addPlugin, createResolver, defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
\tmeta: {
\t\tname: 'ecosystem-ci-vapor',
\t},
\tsetup(_options, nuxt) {
\t\tconst resolver = createResolver(import.meta.url)
\t\tnuxt.options.vite ||= {}
\t\tnuxt.options.vite.resolve ||= {}
\t\tnuxt.options.vite.resolve.alias ||= {}
\t\tconst alias = nuxt.options.vite.resolve.alias as any
\t\tif (Array.isArray(alias)) {
\t\t\talias.unshift({
\t\t\t\tfind: 'vue',
\t\t\t\treplacement: '${VAPOR_RUNTIME_ALIAS}',
\t\t\t})
\t\t} else {
\t\t\talias.vue = '${VAPOR_RUNTIME_ALIAS}'
\t\t}
\t\taddPlugin(resolver.resolve('./runtime/plugin'))
\t},
})
`,
	)
	fs.writeFileSync(
		path.join(runtimeDir, 'plugin.ts'),
		`import { defineNuxtPlugin } from '#app'
import { vaporInteropPlugin } from 'vue'

export default defineNuxtPlugin(nuxtApp => {
\tnuxtApp.vueApp.use(vaporInteropPlugin)
})
`,
	)
	patchNuxtConfigModules(path.join(rootDir, 'nuxt.config.ts'))
}

export function patchViteConfigVueAlias(configFile: string) {
	const source = fs.readFileSync(configFile, 'utf-8')
	if (source.includes(VAPOR_RUNTIME_ALIAS)) {
		return
	}
	const next = source.replace(
		/alias:\s*\{/,
		`alias: {\n\t\t\t\tvue: '${VAPOR_RUNTIME_ALIAS}',`,
	)
	if (next === source) {
		throw new Error(`failed to patch Vite alias in ${configFile}`)
	}
	fs.writeFileSync(configFile, next)
}

export function patchVitePressConfigForVapor(configFile: string) {
	const source = fs.readFileSync(configFile, 'utf-8')
	if (source.includes(VAPOR_RUNTIME_ALIAS)) {
		return
	}
	const next = source.replace(
		/vite:\s*\{/,
		`vite: {\n    resolve: {\n      alias: {\n        vue: '${VAPOR_RUNTIME_ALIAS}'\n      }\n    },`,
	)
	if (next === source) {
		throw new Error(`failed to patch VitePress config in ${configFile}`)
	}
	fs.writeFileSync(configFile, next)
}

export function patchVitePressThemeForVapor(themeFile: string) {
	let source = fs.readFileSync(themeFile, 'utf-8')
	if (!source.includes('vaporInteropPlugin')) {
		source = source.replace(
			/import \{ h, App \} from 'vue'/,
			`import { h, App, vaporInteropPlugin } from 'vue'`,
		)
		source = source.replace(
			/enhanceApp\(\{ app \}: \{ app: App \}\) \{/,
			`enhanceApp({ app }: { app: App }) {\n    app.use(vaporInteropPlugin)`,
		)
	}
	fs.writeFileSync(themeFile, source)
}

export function patchMisskeyForVapor(rootDir: string) {
	const frontendDir = path.join(rootDir, 'packages/frontend')
	patchViteConfigVueAlias(path.join(frontendDir, 'vite.config.ts'))
	const commonFile = path.join(frontendDir, 'src/boot/common.ts')
	let common = fs.readFileSync(commonFile, 'utf-8')
	if (!common.includes('vaporInteropPlugin')) {
		common = common.replace(
			/import \{ watch, version as vueVersion \} from 'vue';/,
			`import { vaporInteropPlugin, watch, version as vueVersion } from 'vue';`,
		)
		common = common.replace(
			/const app = await createVue\(\);/,
			`const app = await createVue();\n\tapp.use(vaporInteropPlugin);`,
		)
	}
	fs.writeFileSync(commonFile, common)
}

export function excludeVueFromMinimumReleaseAge(content: string) {
	const data = YAML.parse(content) ?? {}
	const exclude: string[] = Array.isArray(data.minimumReleaseAgeExclude)
		? data.minimumReleaseAgeExclude
		: []
	for (const name of ['@vue/*', 'vue']) {
		if (!exclude.includes(name)) {
			exclude.unshift(name)
		}
	}
	data.minimumReleaseAgeExclude = exclude
	return YAML.stringify(data)
}

function patchNuxtConfigModules(configFile: string) {
	const source = fs.readFileSync(configFile, 'utf-8')
	if (source.includes('./ecosystem-ci-vapor/module')) {
		return
	}
	const next = source.replace(
		/modules:\s*\[/,
		`modules: [\n    './ecosystem-ci-vapor/module',`,
	)
	if (next === source) {
		throw new Error(`failed to patch Nuxt modules in ${configFile}`)
	}
	fs.writeFileSync(configFile, next)
}

function listVueFiles(rootDir: string): string[] {
	const result: string[] = []
	const walk = (dir: string) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const fullPath = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				if (!ignoredDirectories.has(entry.name)) {
					walk(fullPath)
				}
			} else if (entry.isFile() && entry.name.endsWith('.vue')) {
				result.push(fullPath)
			}
		}
	}
	walk(rootDir)
	return result
}
