// @ts-nocheck
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

installDom()

const Vue = await import('vue/dist/vue.runtime-with-vapor.esm-browser.js')
const compilerSfc = await import('@vue/compiler-sfc')
const serverRenderer = await import('@vue/server-renderer')

const {
	createApp,
	createSSRApp,
	defineComponent,
	h,
	markRaw,
	nextTick,
	ref,
	Teleport,
	createVaporApp,
	vaporInteropPlugin,
} = Vue
const { renderToString } = serverRenderer

const cases = [
	{ seed: 7, steps: 14 },
	{ seed: 42, steps: 16 },
	{ seed: 314159, steps: 18 },
	{ seed: 271828, steps: 12 },
]
const scriptSetupVaporStats = {
	enabled: 0,
	disabled: 0,
}

for (const fuzzCase of cases) {
	await runClientInteropCase(fuzzCase, 'vdom-root')
	await runClientInteropCase(fuzzCase, 'vapor-root')
	await runSsrHydrationCase(fuzzCase)
}
assert.ok(
	scriptSetupVaporStats.enabled > 0,
	'fuzz did not compile any <script setup vapor> SFCs',
)
assert.ok(
	scriptSetupVaporStats.disabled > 0,
	'fuzz did not compile any plain <script setup> SFCs',
)

console.log(
	`vapor interop fuzz passed (${cases.length} seeds, VDOM/Vapor roots, SSR hydration, ${scriptSetupVaporStats.enabled} script setup vapor variants)`,
)

async function runClientInteropCase({ seed, steps }, rootMode) {
	const random = mulberry32(seed)
	const data = ref(makeState(random, seed, 0))
	const warnings = captureConsole()
	const host = document.createElement('div')
	document.body.appendChild(host)
	const target = document.createElement('div')
	target.id = `teleport-${rootMode}-${seed}`
	document.body.appendChild(target)

	try {
		const sfcVariants = makeSfcVariants(seed, rootMode)
		const components = makeComponents(data, target.id, sfcVariants)
		data.value.current = components.VaporCard

		const Root =
			rootMode === 'vapor-root'
				? makeVaporRoot(data, sfcVariants.root)
				: makeVdomRoot(data, components)
		const app = createClientAppWithInterop(Root, rootMode)
		app.mount(host)

		for (let step = 0; step < steps; step++) {
			mutateState(data, random, components, step)
			await nextTick()
			const button = host.querySelector('button')
			if (button) {
				button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
				await nextTick()
			}
			assertRendered(host, target, data.value, rootMode, seed, step)
		}

		app.unmount()
		assert.equal(host.textContent, '', `${rootMode} unmounted cleanly`)
	} finally {
		warnings.restore()
		host.remove()
		target.remove()
	}
	assertNoVueInteropWarnings(warnings.messages, rootMode, seed)
}

async function runSsrHydrationCase({ seed }) {
	const random = mulberry32(seed)
	const serverData = ref(makeState(random, seed, 0))
	const clientData = ref(cloneState(serverData.value))
	const warnings = captureConsole()
	const host = document.createElement('div')
	document.body.appendChild(host)

	try {
		const sfcVariants = makeSfcVariants(seed, 'ssr-hydration')
		const ServerChild = compileSfc(
			vaporCardSfc(sfcVariants.serverChild),
			serverData,
			{},
			{
				ssr: true,
				name: `ServerChild${seed}`,
			},
		)
		const ClientChild = compileSfc(
			vaporCardSfc(sfcVariants.clientChild),
			clientData,
			{},
			{
				name: `ClientChild${seed}`,
			},
		)
		const ServerRoot = makeSsrVdomRoot(serverData, ServerChild)
		const ClientRoot = makeSsrVdomRoot(clientData, ClientChild)

		const serverApp = createSsrAppWithInterop(ServerRoot)
		host.innerHTML = await renderToString(serverApp)

		const clientApp = createSsrAppWithInterop(ClientRoot)
		clientApp.mount(host)
		assertSsrHydrated(host, clientData.value, seed)

		clientData.value.step += 1
		clientData.value.label = `hydrated-${seed}`
		await nextTick()
		assertSsrHydrated(host, clientData.value, seed)
		clientApp.unmount()
	} finally {
		warnings.restore()
		host.remove()
	}
	assertNoVueInteropWarnings(warnings.messages, 'ssr-hydration', seed)
}

function makeComponents(data, teleportTarget, sfcVariants) {
	const components = {}

	components.VaporCard = markRaw(
		compileSfc(vaporCardSfc(sfcVariants.card), data, components, {
			name: 'VaporCard',
		}),
	)

	components.VaporFragment = markRaw(
		compileSfc(
			`
				${scriptSetupOpenTag(sfcVariants.fragment)}
				defineProps({ mode: String })
				const data = _data
				</script>
				<template>
					<strong class="vapor-fragment" :data-step="data.step">
						{{ data.label }}
					</strong>
					<small v-if="data.flag">fragment-on</small>
					<slot :label="data.label" :step="data.step" />
				</template>
			`,
			data,
			components,
			{ name: 'VaporFragment' },
		),
	)

	components.VDomCard = markRaw(
		defineComponent({
			name: 'VDomCard',
			props: {
				mode: String,
			},
			setup(props, { slots }) {
				return () =>
					h(
						'section',
						{
							class: ['case-card', 'vdom-card', data.value.flag && 'is-on'],
							'data-mode': props.mode,
							'data-step': data.value.step,
						},
						[
							h('header', `${data.value.label}:${data.value.step}`),
							h(
								'button',
								{
									type: 'button',
									onClick: () => {
										data.value.clicks += 1
									},
								},
								`click-${data.value.clicks}`,
							),
							h(
								'ul',
								data.value.items.map((item) =>
									h(
										'li',
										{
											key: item.id,
											class: item.active ? 'active' : undefined,
										},
										item.label,
									),
								),
							),
							slots.default?.({
								label: data.value.label,
								step: data.value.step,
							}) ?? h('em', 'fallback'),
							data.value.flag
								? h('p', { class: 'branch' }, 'on')
								: h('p', { class: 'branch' }, 'off'),
							h(Teleport, { to: `#${teleportTarget}` }, [
								h('span', { class: 'teleported' }, data.value.label),
							]),
						],
					)
			},
		}),
	)

	components.VaporCard.__ecosystemCiKind = 'list'
	components.VaporFragment.__ecosystemCiKind = 'fragment'
	components.VDomCard.__ecosystemCiKind = 'list'

	return components
}

function vaporCardSfc(scriptSetupVariant) {
	return `
		${scriptSetupOpenTag(scriptSetupVariant)}
		defineProps({ mode: String })
		const data = _data
		</script>
		<template>
			<section
				class="case-card vapor-card"
				:class="{ 'is-on': data.flag }"
				:data-mode="data.mode"
				:data-step="data.step"
			>
				<header>{{ data.label }}:{{ data.step }}</header>
				<button type="button" @click="data.clicks++">click-{{ data.clicks }}</button>
				<ul>
					<li
						v-for="item in data.items"
						:key="item.id"
						:class="{ active: item.active }"
					>
						{{ item.label }}
					</li>
				</ul>
				<slot :label="data.label" :step="data.step">
					<em>fallback</em>
				</slot>
				<p class="branch" v-if="data.flag">on</p>
				<p class="branch" v-else>off</p>
			</section>
		</template>
	`
}

function makeVdomRoot(data, components) {
	return defineComponent({
		name: 'InteropVdomRoot',
		setup() {
			return () =>
				h(
					'main',
					{
						class: 'root vdom-root',
						'data-case': data.value.seed,
						'data-step': data.value.step,
					},
					[
						h(
							data.value.current,
							{ mode: data.value.mode },
							{
								default: ({ label, step }) => [
									h(
										'span',
										{ class: 'slot-probe' },
										`slot-${label}-${step}-${data.value.items.length}`,
									),
								],
							},
						),
						h(components.VDomCard, { mode: 'shadow' }),
					],
				)
		},
	})
}

function makeVaporRoot(data, scriptSetupVariant) {
	return compileSfc(
		`
			${scriptSetupOpenTag(scriptSetupVariant)}
			const data = _data
			</script>
			<template>
				<main class="root vapor-root" :data-case="data.seed" :data-step="data.step">
					<component :is="data.current" :mode="data.mode">
						<template #default="{ label, step }">
							<span class="slot-probe">
								slot-{{ label }}-{{ step }}-{{ data.items.length }}
							</span>
						</template>
					</component>
				</main>
			</template>
		`,
		data,
		{},
		{ name: 'InteropVaporRoot' },
	)
}

function createClientAppWithInterop(Root, rootMode) {
	const app = rootMode === 'vapor-root' ? createVaporApp(Root) : createApp(Root)
	app.use(vaporInteropPlugin)
	return app
}

function createSsrAppWithInterop(Root) {
	const app = createSSRApp(Root)
	app.use(vaporInteropPlugin)
	return app
}

function makeSfcVariants(seed, scope) {
	const random = mulberry32(hashSeed(seed, scope))
	return {
		card: makeScriptSetupVariant(random),
		fragment: makeScriptSetupVariant(random),
		root: makeScriptSetupVariant(random, true),
		serverChild: makeScriptSetupVariant(random),
		clientChild: makeScriptSetupVariant(random),
	}
}

function makeScriptSetupVariant(random, forceVapor = false) {
	const vapor = forceVapor || random() > 0.5
	if (vapor) {
		scriptSetupVaporStats.enabled++
	} else {
		scriptSetupVaporStats.disabled++
	}
	return { vapor }
}

function scriptSetupOpenTag({ vapor }) {
	return `<script setup${vapor ? ' vapor' : ''}>`
}

function hashSeed(seed, scope) {
	let hash = seed >>> 0
	for (let index = 0; index < scope.length; index++) {
		hash = Math.imul(hash ^ scope.charCodeAt(index), 16777619) >>> 0
	}
	return hash
}

function makeSsrVdomRoot(data, Child) {
	return defineComponent({
		name: 'InteropSsrVdomRoot',
		setup() {
			return () =>
				h('main', { class: 'ssr-root', 'data-seed': data.value.seed }, [
					h(
						Child,
						{ mode: data.value.mode },
						{
							default: ({ label, step }) => [
								h(
									'span',
									{ class: 'slot-probe' },
									`slot-${label}-${step}-${data.value.items.length}`,
								),
							],
						},
					),
				])
		},
	})
}

function compileSfc(source, data, components, options = {}) {
	const { ssr = false, name = 'AnonymousCompiled' } = options
	const descriptor = compilerSfc.parse(source, {
		filename: `${name}.vue`,
	}).descriptor
	const vapor = hasVaporScriptSetup(descriptor)
	const script = compilerSfc.compileScript(descriptor, {
		id: name,
		isProd: true,
		inlineTemplate: true,
		genDefaultAs: '__sfc__',
		vapor,
		templateOptions: {
			ssr,
		},
	})
	const code =
		script.content
			.replace(/\bimport\s*{/g, 'const {')
			.replace(/ as _/g, ': _')
			.replace(/}\s+from\s+['"]vue['"];?/g, '} = Vue;')
			.replace(
				/}\s+from\s+['"]vue\/server-renderer['"];?/g,
				'} = VueServerRenderer;',
			) + '\nreturn __sfc__'

	return new Function('Vue', 'VueServerRenderer', '_data', '_components', code)(
		Vue,
		serverRenderer,
		data,
		components,
	)
}

function hasVaporScriptSetup(descriptor) {
	return Boolean(
		descriptor.scriptSetup?.attrs &&
		Object.prototype.hasOwnProperty.call(descriptor.scriptSetup.attrs, 'vapor'),
	)
}

function mutateState(data, random, components, step) {
	const variants = [
		{ component: components.VaporCard, kind: 'list' },
		{ component: components.VaporFragment, kind: 'fragment' },
		{ component: components.VDomCard, kind: 'list' },
	]
	const selected = variants[Math.floor(random() * variants.length)]
	data.value = {
		...data.value,
		step,
		label: `case-${data.value.seed}-${step}`,
		mode: step % 2 === 0 ? 'even' : 'odd',
		flag: random() > 0.45,
		items: makeItems(random, step),
		current: selected.component,
		currentKind: selected.kind,
	}
}

function makeState(random, seed, step) {
	return {
		seed,
		step,
		label: `case-${seed}-${step}`,
		mode: 'initial',
		flag: true,
		clicks: 0,
		items: makeItems(random, step),
		current: null,
		currentKind: 'list',
	}
}

function cloneState(state) {
	return {
		...state,
		items: state.items.map((item) => ({ ...item })),
	}
}

function makeItems(random, step) {
	const count = step % 5
	return Array.from({ length: count }, (_, index) => ({
		id: `${step}-${index}-${Math.floor(random() * 1000)}`,
		label: `item-${step}-${index}`,
		active: random() > 0.5,
	}))
}

function assertRendered(host, target, state, rootMode, seed, step) {
	const text = host.textContent || ''
	const currentHasList = state.currentKind !== 'fragment'
	if (rootMode === 'vapor-root' && !currentHasList) {
		assert.ok(text.includes(state.label), message(rootMode, seed, step))
	} else {
		assert.ok(
			text.includes(`${state.label}:${state.step}`),
			message(rootMode, seed, step),
		)
	}
	assert.ok(
		text.includes(`slot-${state.label}-${state.step}-${state.items.length}`),
		message(rootMode, seed, step, 'slot content'),
	)
	const expectedListCount =
		(rootMode === 'vdom-root' ? state.items.length : 0) +
		(currentHasList ? state.items.length : 0)
	assert.equal(
		host.querySelectorAll('li').length,
		expectedListCount,
		message(rootMode, seed, step, 'list length'),
	)
	if (expectedListCount > 0) {
		for (const item of state.items) {
			assert.ok(
				text.includes(item.label),
				message(rootMode, seed, step, item.label),
			)
		}
	}
	if (rootMode === 'vdom-root' || currentHasList) {
		assert.equal(
			host.querySelector('.branch')?.textContent,
			state.flag ? 'on' : 'off',
			message(rootMode, seed, step, 'branch'),
		)
	}
	const button = host.querySelector('button')
	if (button) {
		assert.ok(
			Number(button.textContent?.replace('click-', '')) >= 1,
			message(rootMode, seed, step, 'click event'),
		)
	}
	if (rootMode === 'vdom-root') {
		assert.ok(
			target.textContent?.includes(state.label),
			message(rootMode, seed, step, 'teleport'),
		)
	}
}

function assertSsrHydrated(host, state, seed) {
	const text = host.textContent || ''
	assert.ok(text.includes(`${state.label}:${state.step}`), `ssr seed ${seed}`)
	assert.ok(
		text.includes(`slot-${state.label}-${state.step}-${state.items.length}`),
		`ssr slot seed ${seed}`,
	)
	assert.equal(host.querySelectorAll('li').length, state.items.length)
}

function message(rootMode, seed, step, detail = 'render') {
	return `${detail} failed for ${rootMode} seed ${seed} step ${step}`
}

function captureConsole() {
	const messages = []
	const originalWarn = console.warn
	const originalError = console.error
	console.warn = (...args) => {
		messages.push(args.join(' '))
		originalWarn(...args)
	}
	console.error = (...args) => {
		messages.push(args.join(' '))
		originalError(...args)
	}
	return {
		messages,
		restore() {
			console.warn = originalWarn
			console.error = originalError
		},
	}
}

function assertNoVueInteropWarnings(messages, rootMode, seed) {
	const actionable = messages.filter((message) =>
		/(Vapor component found|hydration|mismatch|Unhandled|TypeError|ReferenceError)/i.test(
			message,
		),
	)
	assert.deepEqual(actionable, [], `${rootMode} seed ${seed} emitted warnings`)
}

function installDom() {
	const dom = new JSDOM('<!doctype html><html><body></body></html>', {
		url: 'http://localhost/',
	})
	const win = dom.window
	const globals = [
		'window',
		'document',
		'Node',
		'Element',
		'HTMLElement',
		'HTMLButtonElement',
		'SVGElement',
		'Comment',
		'Text',
		'Event',
		'MouseEvent',
		'CustomEvent',
		'MutationObserver',
	]
	for (const key of globals) {
		globalThis[key] = win[key]
	}
	Object.defineProperty(globalThis, 'navigator', {
		value: win.navigator,
		configurable: true,
	})
}

function mulberry32(seed) {
	return function nextRandom() {
		let t = (seed += 0x6d2b79f5)
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}
