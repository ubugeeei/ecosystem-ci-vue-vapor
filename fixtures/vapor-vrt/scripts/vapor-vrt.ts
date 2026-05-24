import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')
const pixelmatch = (await import('pixelmatch')).default
const { chromium } = await import('playwright')

interface VrtState {
	name: string
	interaction?: 'click-primary' | 'focus-field' | 'hover-card'
}

interface VrtPage {
	name: string
	states: VrtState[]
}

interface VrtCase {
	page: string
	state: string
	interaction?: VrtState['interaction']
}

interface Viewport {
	name: string
	width: number
	height: number
}

interface StaticServer {
	url: string
	close: () => Promise<void>
}

const fixtureRoot = fileURLToPath(new URL('..', import.meta.url))
const outputRoot = path.join(fixtureRoot, '.vrt-output')
const stableRoot = path.join(fixtureRoot, '.vrt-cache')
const artifactsRoot = path.join(outputRoot, 'artifacts')

const VRT_PAGES: VrtPage[] = [
	{
		name: 'dashboard',
		states: [
			{ name: 'overview' },
			{ name: 'loading' },
			{ name: 'empty' },
			{ name: 'error' },
			{ name: 'expanded', interaction: 'hover-card' },
		],
	},
	{
		name: 'catalog',
		states: [
			{ name: 'grid' },
			{ name: 'filtered' },
			{ name: 'selected', interaction: 'hover-card' },
			{ name: 'sale' },
			{ name: 'overflow' },
		],
	},
	{
		name: 'form',
		states: [
			{ name: 'pristine' },
			{ name: 'dirty', interaction: 'focus-field' },
			{ name: 'invalid' },
			{ name: 'submitted' },
			{ name: 'disabled' },
		],
	},
	{
		name: 'timeline',
		states: [
			{ name: 'normal' },
			{ name: 'dense' },
			{ name: 'unread' },
			{ name: 'grouped' },
			{ name: 'empty' },
		],
	},
	{
		name: 'modal',
		states: [
			{ name: 'closed' },
			{ name: 'open' },
			{ name: 'nested' },
			{ name: 'menu', interaction: 'click-primary' },
			{ name: 'tooltip', interaction: 'hover-card' },
		],
	},
	{
		name: 'settings',
		states: [
			{ name: 'normal' },
			{ name: 'permissions' },
			{ name: 'saving' },
			{ name: 'conflict' },
			{ name: 'review' },
		],
	},
]

const VIEWPORTS: Viewport[] = [
	{ name: 'desktop', width: 1280, height: 900 },
	{ name: 'mobile', width: 390, height: 844 },
]

const cases: VrtCase[] = VRT_PAGES.flatMap((page) =>
	page.states.map((state) => ({
		page: page.name,
		state: state.name,
		interaction: state.interaction,
	})),
)

const stableVersion =
	process.env.VUE_STABLE_VERSION || (await resolveLatestStableVueVersion())
const stableInstallDir = await ensureStableVueInstall(stableVersion)
const stableRequire = createRequire(path.join(stableInstallDir, 'package.json'))
const candidateRequire = createRequire(import.meta.url)
const stableCompiler = stableRequire('@vue/compiler-sfc')
const candidateCompiler = candidateRequire('@vue/compiler-sfc')
const candidateVuePackage = candidateRequire('vue/package.json')

fs.rmSync(outputRoot, { recursive: true, force: true })
fs.mkdirSync(artifactsRoot, { recursive: true })

const stableDir = path.join(outputRoot, 'stable')
const vaporDir = path.join(outputRoot, 'vapor')
await writeVariant({
	dir: stableDir,
	compiler: stableCompiler,
	runtimeFile: stableRequire.resolve(
		'vue/dist/vue.runtime.esm-browser.prod.js',
	),
	variant: 'stable',
	vapor: false,
})
await writeVariant({
	dir: vaporDir,
	compiler: candidateCompiler,
	runtimeFile: candidateRequire.resolve(
		'vue/dist/vue.runtime-with-vapor.esm-browser.prod.js',
	),
	variant: 'vapor',
	vapor: true,
})

const stableServer = await startStaticServer(stableDir)
const vaporServer = await startStaticServer(vaporDir)
const browser = await chromium.launch()
const failures: string[] = []

try {
	for (const viewport of VIEWPORTS) {
		for (const vrtCase of cases) {
			const stablePng = await captureCase({
				serverUrl: stableServer.url,
				variant: 'stable',
				viewport,
				vrtCase,
			})
			const vaporPng = await captureCase({
				serverUrl: vaporServer.url,
				variant: 'vapor',
				viewport,
				vrtCase,
			})
			const failure = comparePngs({
				stablePng,
				vaporPng,
				viewport,
				vrtCase,
			})
			if (failure) {
				failures.push(failure)
			}
		}
	}
} finally {
	await browser.close()
	await stableServer.close()
	await vaporServer.close()
}

if (failures.length > 0) {
	throw new Error(
		[
			`Vapor VRT failed against Vue stable ${stableVersion}.`,
			`Candidate Vue: ${candidateVuePackage.version}.`,
			`Artifacts: ${artifactsRoot}`,
			...failures,
		].join('\n'),
	)
}

console.log(
	`vapor VRT passed (${cases.length} states x ${VIEWPORTS.length} viewports, stable Vue ${stableVersion}, candidate Vue ${candidateVuePackage.version})`,
)

async function captureCase({
	serverUrl,
	variant,
	viewport,
	vrtCase,
}: {
	serverUrl: string
	variant: 'stable' | 'vapor'
	viewport: Viewport
	vrtCase: VrtCase
}): Promise<Buffer> {
	const page = await browser.newPage({ viewport })
	try {
		const url = new URL(serverUrl)
		url.searchParams.set('page', vrtCase.page)
		url.searchParams.set('state', vrtCase.state)
		await page.goto(url.href, { waitUntil: 'networkidle' })
		await page.waitForSelector('[data-vrt-ready="true"]')
		await applyInteraction(page, vrtCase.interaction)
		await page.emulateMedia({ reducedMotion: 'reduce' })
		const screenshot = await page.screenshot({
			fullPage: true,
			animations: 'disabled',
		})
		fs.writeFileSync(artifactPath(variant, viewport, vrtCase), screenshot)
		return screenshot
	} finally {
		await page.close()
	}
}

async function applyInteraction(
	page: Awaited<ReturnType<typeof browser.newPage>>,
	interaction: VrtState['interaction'],
) {
	if (interaction === 'click-primary') {
		await page.click('[data-vrt-action="primary"]')
		await page.waitForTimeout(40)
	} else if (interaction === 'focus-field') {
		await page.focus('[data-vrt-field="email"]')
		await page.waitForTimeout(40)
	} else if (interaction === 'hover-card') {
		await page.hover('[data-vrt-target="card"]', { force: true })
		await page.waitForTimeout(40)
	}
}

function comparePngs({
	stablePng,
	vaporPng,
	viewport,
	vrtCase,
}: {
	stablePng: Buffer
	vaporPng: Buffer
	viewport: Viewport
	vrtCase: VrtCase
}): string | null {
	const stable = PNG.sync.read(stablePng)
	const vapor = PNG.sync.read(vaporPng)
	if (stable.width !== vapor.width || stable.height !== vapor.height) {
		return `${caseId(viewport, vrtCase)} dimensions changed: stable ${stable.width}x${stable.height}, vapor ${vapor.width}x${vapor.height}`
	}

	const diff = new PNG({ width: stable.width, height: stable.height })
	const diffPixels = pixelmatch(
		stable.data,
		vapor.data,
		diff.data,
		stable.width,
		stable.height,
		{
			includeAA: false,
			threshold: 0.1,
		},
	)
	const totalPixels = stable.width * stable.height
	const ratio = diffPixels / totalPixels
	if (diffPixels > 75 && ratio > 0.0015) {
		const diffPath = artifactPath('diff', viewport, vrtCase)
		fs.writeFileSync(diffPath, PNG.sync.write(diff))
		return `${caseId(viewport, vrtCase)} differs by ${diffPixels} pixels (${(
			ratio * 100
		).toFixed(3)}%); diff: ${diffPath}`
	}
	return null
}

function artifactPath(
	variant: 'stable' | 'vapor' | 'diff',
	viewport: Viewport,
	vrtCase: VrtCase,
) {
	const dir = path.join(artifactsRoot, variant, viewport.name, vrtCase.page)
	fs.mkdirSync(dir, { recursive: true })
	return path.join(dir, `${vrtCase.state}.png`)
}

function caseId(viewport: Viewport, vrtCase: VrtCase) {
	return `${viewport.name}/${vrtCase.page}/${vrtCase.state}`
}

async function writeVariant({
	dir,
	compiler,
	runtimeFile,
	variant,
	vapor,
}: {
	dir: string
	compiler: typeof stableCompiler
	runtimeFile: string
	variant: string
	vapor: boolean
}) {
	fs.mkdirSync(dir, { recursive: true })
	fs.copyFileSync(runtimeFile, path.join(dir, 'vue.js'))
	fs.writeFileSync(path.join(dir, 'index.html'), indexHtml())
	fs.writeFileSync(path.join(dir, 'app.css'), appCss())
	fs.writeFileSync(
		path.join(dir, 'app.js'),
		compileAppModule({ compiler, vapor, variant }),
	)
}

function compileAppModule({
	compiler,
	vapor,
	variant,
}: {
	compiler: typeof stableCompiler
	vapor: boolean
	variant: string
}) {
	const descriptor = compiler.parse(appSfc(vapor), {
		filename: `${variant}-vrt.vue`,
	}).descriptor
	const script = compiler.compileScript(descriptor, {
		id: variant,
		inlineTemplate: true,
		genDefaultAs: '__sfc__',
		isProd: true,
		vapor,
	})
	const appImport = vapor
		? `import { createVaporApp, vaporInteropPlugin } from './vue.js'`
		: `import { createApp } from './vue.js'`
	const mount = vapor
		? `const app = createVaporApp(__sfc__)
app.use(vaporInteropPlugin)
app.mount('#app')`
		: `createApp(__sfc__).mount('#app')`
	return `${appImport}
${script.content.replace(/from ['"]vue['"]/g, "from './vue.js'")}
${mount}
`
}

function appSfc(vapor: boolean) {
	return `
<script${vapor ? ' vapor' : ' setup'}>
import { computed, ref } from 'vue'

const pageNames = ${JSON.stringify(VRT_PAGES.map((page) => page.name))}
const stateNames = ${JSON.stringify(
		Object.fromEntries(
			VRT_PAGES.map((page) => [
				page.name,
				page.states.map((state) => state.name),
			]),
		),
	)}
const labels = {
	dashboard: 'Dashboard',
	catalog: 'Catalog',
	form: 'Intake form',
	timeline: 'Timeline',
	modal: 'Modal lab',
	settings: 'Settings',
}
const params = new URLSearchParams(window.location.search)
const page = params.get('page') || 'dashboard'
const state = params.get('state') || stateNames[page]?.[0] || 'overview'
const clicked = ref(0)
const toggled = ref(false)
const note = ref(state === 'dirty' ? 'Needs review before submit.' : '')
const email = ref(state === 'invalid' ? 'invalid-address' : 'team@example.com')

const scenario = computed(() => makeScenario(page, state))
const navItems = computed(() =>
	pageNames.map((name) => ({
		name,
		label: labels[name],
		active: name === page,
	})),
)
const visibleItems = computed(() =>
	scenario.value.empty ? [] : scenario.value.items,
)

function onPrimary() {
	clicked.value += 1
	toggled.value = !toggled.value
}

function makeScenario(pageName, stateName) {
	const index = Math.max(0, stateNames[pageName]?.indexOf(stateName) ?? 0)
	const seed = pageName.length * 11 + stateName.length * 7 + index
	const loading = stateName === 'loading' || stateName === 'saving'
	const empty =
		stateName === 'empty' ||
		stateName === 'closed' ||
		stateName === 'pristine'
	const error =
		stateName === 'error' ||
		stateName === 'invalid' ||
		stateName === 'conflict'
	const expanded =
		stateName === 'expanded' ||
		stateName === 'selected' ||
		stateName === 'open' ||
		stateName === 'nested' ||
		stateName === 'menu' ||
		stateName === 'tooltip' ||
		stateName === 'permissions' ||
		stateName === 'review'
	const dense = stateName === 'dense' || stateName === 'overflow'
	const count = empty ? 0 : dense ? 9 : expanded ? 7 : 4
	const accent = ['#0f766e', '#7c3aed', '#be123c', '#2563eb', '#a16207', '#15803d'][
		seed % 6
	]

	return {
		page: pageName,
		state: stateName,
		title: labels[pageName],
		subtitle: titleCase(stateName),
		accent,
		loading,
		empty,
		error,
		expanded,
		dense,
		menuOpen: stateName === 'menu' || clicked.value > 0,
		tooltipOpen: stateName === 'tooltip',
		modalOpen: pageName === 'modal' && stateName !== 'closed',
		clicked: clicked.value,
		toggled: toggled.value,
		primaryMetric: loading ? '...' : String(1200 + seed * 13),
		cards: makeCards(count || 3, seed),
		items: makeItems(count, seed, stateName),
		rows: makeRows(count || 4, seed, stateName),
		events: makeEvents(count || 4, seed, stateName),
	}
}

function makeCards(count, seed) {
	return Array.from({ length: Math.min(count, 6) }, (_, index) => ({
		label: ['Revenue', 'Trials', 'Builds', 'Warnings', 'Hydration', 'Interop'][
			index % 6
		],
		value: String(seed * (index + 2) + 17),
		delta: index % 2 === 0 ? '+12%' : '-3%',
		active: index === seed % Math.max(1, Math.min(count, 6)),
	}))
}

function makeItems(count, seed, stateName) {
	return Array.from({ length: count }, (_, index) => ({
		name: \`Component \${index + 1}\`,
		meta: ['stable', 'candidate', 'hydrated', 'queued'][index % 4],
		price: \`$\${(seed + index * 19).toFixed(0)}\`,
		selected: stateName === 'selected' && index === 1,
		hot: stateName === 'sale' && index % 2 === 0,
	}))
}

function makeRows(count, seed, stateName) {
	return Array.from({ length: count }, (_, index) => ({
		name: \`Route /page-\${index + 1}\`,
		status:
			stateName === 'error' && index === 1
				? 'failed'
				: index % 3 === 0
					? 'ready'
					: 'pending',
		score: seed + index * 4,
	}))
}

function makeEvents(count, seed, stateName) {
	return Array.from({ length: count }, (_, index) => ({
		title: \`Render checkpoint \${index + 1}\`,
		body: \`Snapshot group \${seed + index}\`,
		unread: stateName === 'unread' && index < 3,
		group: index < count / 2 ? 'Morning' : 'Afternoon',
	}))
}

function titleCase(value) {
	return value
		.split('-')
		.map((part) => part[0].toUpperCase() + part.slice(1))
		.join(' ')
}
</script>

<template${vapor ? ' vapor' : ''}>
	<main
		class="app-shell"
		:class="[
			\`page-\${page}\`,
			\`state-\${state}\`,
			{
				'is-loading': scenario.loading,
				'has-error': scenario.error,
				'is-expanded': scenario.expanded,
			},
		]"
		:style="{ '--accent': scenario.accent }"
		data-vrt-ready="true"
	>
		<header class="topbar">
			<div>
				<p class="eyebrow">Vue stable baseline VRT</p>
				<h1>{{ scenario.title }}</h1>
			</div>
			<nav>
				<a
					v-for="item in navItems"
					:key="item.name"
					:class="{ active: item.active }"
					:href="\`?page=\${item.name}&state=\${stateNames[item.name][0]}\`"
				>
					{{ item.label }}
				</a>
			</nav>
		</header>

		<section class="page-title">
			<div>
				<span class="pill">{{ page }}</span>
				<h2>{{ scenario.subtitle }}</h2>
			</div>
			<button type="button" data-vrt-action="primary" @click="onPrimary">
				Toggle {{ scenario.clicked }}
			</button>
		</section>

		<section v-if="page === 'dashboard'" class="dashboard-grid">
			<article class="metric hero" data-vrt-target="card">
				<span>Primary metric</span>
				<strong>{{ scenario.primaryMetric }}</strong>
				<p v-if="scenario.loading" class="skeleton">Preparing data</p>
				<p v-else-if="scenario.error" class="error-text">Hydration drift detected</p>
				<p v-else>{{ scenario.cards.length }} tracked panels</p>
			</article>
			<article
				v-for="card in scenario.cards"
				:key="card.label"
				class="metric"
				:class="{ selected: card.active }"
			>
				<span>{{ card.label }}</span>
				<strong>{{ card.value }}</strong>
				<small>{{ card.delta }}</small>
			</article>
			<div v-if="scenario.empty" class="empty-state">No dashboard panels.</div>
		</section>

		<section v-else-if="page === 'catalog'" class="catalog-layout">
			<aside>
				<h3>Filters</h3>
				<label v-for="card in scenario.cards" :key="card.label">
					<input type="checkbox" :checked="card.active" />
					{{ card.label }}
				</label>
			</aside>
			<div class="catalog-grid">
				<article
					v-for="item in visibleItems"
					:key="item.name"
					class="product-card"
					:class="{ selected: item.selected, hot: item.hot }"
					data-vrt-target="card"
				>
					<span>{{ item.meta }}</span>
					<h3>{{ item.name }}</h3>
					<strong>{{ item.price }}</strong>
				</article>
				<div v-if="scenario.empty" class="empty-state">No catalog results.</div>
			</div>
		</section>

		<section v-else-if="page === 'form'" class="form-panel">
			<label>
				Email
				<input
					data-vrt-field="email"
					type="email"
					:value="email"
					:disabled="state === 'disabled'"
					:aria-invalid="scenario.error"
				/>
			</label>
			<label>
				Role
				<select :disabled="state === 'disabled'">
					<option>Reviewer</option>
					<option>Maintainer</option>
					<option>Observer</option>
				</select>
			</label>
			<label class="wide">
				Notes
				<textarea :value="note" :disabled="state === 'disabled'" />
			</label>
			<p v-if="scenario.error" class="error-text">Please enter a valid email.</p>
			<p v-if="state === 'submitted'" class="success-text">Submission captured.</p>
		</section>

		<section v-else-if="page === 'timeline'" class="timeline-panel">
			<div v-if="scenario.empty" class="empty-state">No timeline events.</div>
			<ol v-else>
				<li
					v-for="event in scenario.events"
					:key="event.title"
					:class="{ unread: event.unread }"
					data-vrt-target="card"
				>
					<span v-if="state === 'grouped'" class="group-label">{{ event.group }}</span>
					<h3>{{ event.title }}</h3>
					<p>{{ event.body }}</p>
				</li>
			</ol>
		</section>

		<section v-else-if="page === 'modal'" class="modal-stage">
			<div class="document-card" data-vrt-target="card">
				<h3>Release notes</h3>
				<p>Compare modal layering, overlay color, menus, and tooltips.</p>
			</div>
			<div v-if="scenario.modalOpen" class="scrim">
				<aside class="modal-card">
					<h3>{{ scenario.subtitle }}</h3>
					<p>Candidate UI should match the stable non-Vapor baseline.</p>
					<div v-if="state === 'nested'" class="nested-card">Nested panel</div>
					<div v-if="scenario.menuOpen" class="menu-card">Menu option selected</div>
					<div v-if="scenario.tooltipOpen" class="tooltip-card">Tooltip text</div>
				</aside>
			</div>
		</section>

		<section v-else class="settings-panel">
			<article
				v-for="row in scenario.rows"
				:key="row.name"
				class="setting-row"
				:class="row.status"
				data-vrt-target="card"
			>
				<div>
					<h3>{{ row.name }}</h3>
					<p>{{ row.status }} / score {{ row.score }}</p>
				</div>
				<input type="checkbox" :checked="row.status === 'ready' || scenario.toggled" />
			</article>
			<p v-if="state === 'saving'" class="skeleton">Saving permissions</p>
			<p v-if="state === 'conflict'" class="error-text">Concurrent edit conflict.</p>
		</section>
	</main>
</template>
`
}

function indexHtml() {
	return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Vapor VRT</title>
		<link rel="stylesheet" href="./app.css" />
	</head>
	<body>
		<div id="app"></div>
		<script type="module" src="./app.js"></script>
	</body>
</html>
`
}

function appCss() {
	return `
:root {
	color-scheme: light;
	font-family:
		Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
		sans-serif;
	background: #f4f7f9;
	color: #18202a;
}

* {
	box-sizing: border-box;
}

body {
	margin: 0;
	min-height: 100vh;
	background:
		linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(244, 247, 249, 0.96)),
		#f4f7f9;
}

button,
input,
select,
textarea {
	font: inherit;
}

.app-shell {
	width: min(1120px, calc(100vw - 32px));
	margin: 0 auto;
	padding: 24px 0 36px;
}

.topbar,
.page-title,
.metric,
.catalog-layout,
.form-panel,
.timeline-panel,
.modal-stage,
.settings-panel,
.product-card,
.setting-row,
.document-card,
.modal-card {
	border: 1px solid #d9e1e8;
	background: rgba(255, 255, 255, 0.94);
	box-shadow: 0 12px 28px rgba(28, 43, 58, 0.08);
}

.topbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
	border-radius: 8px;
	padding: 18px;
}

.eyebrow,
.pill,
small,
.product-card span,
.group-label {
	color: #64748b;
	font-size: 12px;
	font-weight: 700;
	text-transform: uppercase;
}

h1,
h2,
h3,
p {
	margin: 0;
}

h1 {
	font-size: 28px;
}

h2 {
	margin-top: 6px;
	font-size: 24px;
}

h3 {
	font-size: 15px;
}

nav {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	justify-content: flex-end;
}

nav a,
button,
.pill {
	border-radius: 999px;
	border: 1px solid #d9e1e8;
	background: #fff;
	color: #334155;
	padding: 8px 12px;
	text-decoration: none;
}

nav a.active,
button {
	border-color: var(--accent);
	background: color-mix(in srgb, var(--accent) 12%, white);
	color: #0f172a;
}

button:hover,
.metric:hover,
.product-card:hover,
.setting-row:hover,
.timeline-panel li:hover,
.document-card:hover {
	outline: 3px solid color-mix(in srgb, var(--accent) 28%, transparent);
}

.page-title {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 16px 0;
	border-radius: 8px;
	padding: 16px;
}

.dashboard-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 14px;
}

.metric {
	min-height: 132px;
	border-radius: 8px;
	padding: 16px;
}

.metric.hero {
	grid-column: span 2;
}

.metric strong {
	display: block;
	margin-top: 16px;
	font-size: 34px;
}

.metric.selected,
.product-card.selected,
.setting-row.ready {
	border-color: var(--accent);
}

.catalog-layout {
	display: grid;
	grid-template-columns: 220px 1fr;
	gap: 16px;
	border-radius: 8px;
	padding: 16px;
}

.catalog-layout aside {
	display: grid;
	align-content: start;
	gap: 10px;
}

.catalog-layout label {
	display: flex;
	gap: 8px;
	align-items: center;
}

.catalog-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 12px;
}

.product-card {
	min-height: 126px;
	border-radius: 8px;
	padding: 14px;
}

.product-card.hot {
	background: #fff7ed;
	border-color: #fdba74;
}

.product-card strong {
	display: block;
	margin-top: 18px;
	font-size: 22px;
}

.form-panel {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 14px;
	border-radius: 8px;
	padding: 18px;
}

.form-panel label {
	display: grid;
	gap: 8px;
	font-weight: 700;
}

.form-panel .wide {
	grid-column: 1 / -1;
}

input,
select,
textarea {
	width: 100%;
	border: 1px solid #cbd5e1;
	border-radius: 8px;
	padding: 11px;
	background: #fff;
	color: #18202a;
}

input:focus,
select:focus,
textarea:focus {
	outline: 3px solid color-mix(in srgb, var(--accent) 24%, transparent);
	border-color: var(--accent);
}

textarea {
	min-height: 128px;
	resize: vertical;
}

.timeline-panel,
.modal-stage,
.settings-panel {
	border-radius: 8px;
	padding: 18px;
}

.timeline-panel ol {
	display: grid;
	gap: 12px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.timeline-panel li {
	border-left: 4px solid #cbd5e1;
	border-radius: 8px;
	background: #f8fafc;
	padding: 14px 14px 14px 18px;
}

.timeline-panel li.unread {
	border-left-color: var(--accent);
	background: color-mix(in srgb, var(--accent) 9%, white);
}

.modal-stage {
	position: relative;
	min-height: 480px;
	overflow: hidden;
}

.document-card {
	width: min(560px, 100%);
	border-radius: 8px;
	padding: 20px;
}

.scrim {
	position: absolute;
	inset: 0;
	display: grid;
	place-items: center;
	background: rgba(15, 23, 42, 0.42);
}

.modal-card {
	width: min(460px, calc(100% - 32px));
	border-radius: 8px;
	padding: 20px;
}

.nested-card,
.menu-card,
.tooltip-card {
	margin-top: 12px;
	border-radius: 8px;
	background: color-mix(in srgb, var(--accent) 12%, white);
	padding: 12px;
}

.settings-panel {
	display: grid;
	gap: 12px;
}

.setting-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	border-radius: 8px;
	padding: 14px;
}

.setting-row.failed,
.has-error .page-title {
	border-color: #fb7185;
	background: #fff1f2;
}

.empty-state,
.error-text,
.success-text,
.skeleton {
	border-radius: 8px;
	padding: 12px;
}

.empty-state {
	grid-column: 1 / -1;
	background: #eef2ff;
	color: #3730a3;
}

.error-text {
	background: #fff1f2;
	color: #be123c;
}

.success-text {
	background: #ecfdf5;
	color: #047857;
}

.skeleton {
	background: repeating-linear-gradient(
		90deg,
		#e2e8f0 0,
		#e2e8f0 16px,
		#f8fafc 16px,
		#f8fafc 32px
	);
	color: #475569;
}

@media (max-width: 720px) {
	.app-shell {
		width: min(100vw - 20px, 460px);
		padding-top: 10px;
	}

	.topbar,
	.page-title {
		align-items: stretch;
		flex-direction: column;
	}

	nav {
		justify-content: flex-start;
	}

	.dashboard-grid,
	.catalog-layout,
	.form-panel,
	.catalog-grid {
		grid-template-columns: 1fr;
	}

	.metric.hero {
		grid-column: span 1;
	}
}
`
}

async function ensureStableVueInstall(stableVersion: string) {
	const stableInstallDir = path.join(stableRoot, `vue-${stableVersion}`)
	const vuePackageJson = path.join(
		stableInstallDir,
		'node_modules/vue/package.json',
	)
	const compilerPackageJson = path.join(
		stableInstallDir,
		'node_modules/@vue/compiler-sfc/package.json',
	)
	if (
		packageVersion(vuePackageJson) === stableVersion &&
		packageVersion(compilerPackageJson) === stableVersion
	) {
		return stableInstallDir
	}

	fs.rmSync(stableInstallDir, { recursive: true, force: true })
	fs.mkdirSync(stableInstallDir, { recursive: true })
	fs.writeFileSync(
		path.join(stableInstallDir, 'package.json'),
		JSON.stringify(
			{
				private: true,
				type: 'module',
				dependencies: {
					'@vue/compiler-sfc': stableVersion,
					vue: stableVersion,
				},
			},
			null,
			2,
		) + '\n',
	)
	await run('pnpm', [
		'install',
		'--dir',
		stableInstallDir,
		'--no-frozen-lockfile',
		'--ignore-scripts',
	])
	return stableInstallDir
}

function packageVersion(packageJson: string): string | undefined {
	if (!fs.existsSync(packageJson)) {
		return undefined
	}
	return JSON.parse(fs.readFileSync(packageJson, 'utf-8')).version
}

async function resolveLatestStableVueVersion() {
	const response = await fetch('https://registry.npmjs.org/vue')
	if (!response.ok) {
		throw new Error(
			`Failed to resolve latest stable Vue: ${response.status} ${await response.text()}`,
		)
	}
	const metadata = (await response.json()) as {
		versions: Record<string, unknown>
	}
	const stableVersions = Object.keys(metadata.versions).filter((version) =>
		/^\d+\.\d+\.\d+$/.test(version),
	)
	stableVersions.sort(compareVersions)
	const latest = stableVersions.at(-1)
	if (!latest) {
		throw new Error('No stable Vue version found in npm registry metadata')
	}
	return latest
}

function compareVersions(a: string, b: string) {
	const aa = a.split('.').map(Number)
	const bb = b.split('.').map(Number)
	for (let i = 0; i < 3; i++) {
		const diff = aa[i] - bb[i]
		if (diff !== 0) {
			return diff
		}
	}
	return 0
}

function run(command: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: fixtureRoot,
			stdio: 'inherit',
		})
		child.on('error', reject)
		child.on('exit', (code) => {
			if (code === 0) {
				resolve()
			} else {
				reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
			}
		})
	})
}

function startStaticServer(root: string): Promise<StaticServer> {
	return new Promise((resolve, reject) => {
		const server = http.createServer((request, response) => {
			try {
				const requestUrl = new URL(request.url || '/', 'http://localhost')
				const pathname =
					requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname
				const filePath = path.resolve(root, `.${decodeURIComponent(pathname)}`)
				if (!filePath.startsWith(root)) {
					response.writeHead(403)
					response.end('Forbidden')
					return
				}
				const content = fs.readFileSync(filePath)
				response.writeHead(200, {
					'content-type': contentType(filePath),
				})
				response.end(content)
			} catch (error) {
				response.writeHead(404)
				response.end(String(error))
			}
		})
		server.on('error', reject)
		server.listen(0, '127.0.0.1', () => {
			const address = server.address()
			if (!address || typeof address === 'string') {
				reject(new Error('Could not resolve static server address'))
				return
			}
			resolve({
				url: `http://127.0.0.1:${address.port}/`,
				close: () =>
					new Promise<void>((closeResolve, closeReject) => {
						server.close((error) => {
							if (error) {
								closeReject(error)
							} else {
								closeResolve()
							}
						})
					}),
			})
		})
	})
}

function contentType(filePath: string) {
	if (filePath.endsWith('.js')) {
		return 'text/javascript'
	}
	if (filePath.endsWith('.css')) {
		return 'text/css'
	}
	if (filePath.endsWith('.html')) {
		return 'text/html'
	}
	return 'application/octet-stream'
}
