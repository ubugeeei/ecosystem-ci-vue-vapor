export type TestbedLicenseClass =
	| 'permissive'
	| 'copyleft'
	| 'content'
	| 'no-license'

export interface TestbedProject {
	suite: string
	repo: string
	license: string
	licenseClass: TestbedLicenseClass
	licenseUrl: string
	usage: string
	policy: string
	redistributesArtifacts: boolean
}

export const TESTBED_PROJECTS: TestbedProject[] = [
	{
		suite: 'elk',
		repo: 'elk-zone/elk',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/elk-zone/elk/blob/main/LICENSE',
		usage: 'Nuxt SSR/downstream app probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'language-tools',
		repo: 'vuejs/language-tools',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/vuejs/language-tools/blob/master/LICENSE',
		usage: 'Vue language tooling compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'misskey',
		repo: 'misskey-dev/misskey',
		license: 'AGPL-3.0',
		licenseClass: 'copyleft',
		licenseUrl: 'https://github.com/misskey-dev/misskey/blob/develop/LICENSE',
		usage: 'Large Vue application probe',
		policy:
			'Allowed only as an external testbed: clone ephemerally, patch in workspace only, never vendor code, never redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'naive-ui',
		repo: 'tusen-ai/naive-ui',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/tusen-ai/naive-ui/blob/main/LICENSE',
		usage: 'Component library compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'naive-ui-jsx-vapor',
		repo: 'tusen-ai/naive-ui',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/tusen-ai/naive-ui/blob/main/LICENSE',
		usage: 'Component library JSX/TSX Vapor compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'npmx',
		repo: 'npmx-dev/npmx.dev',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/npmx-dev/npmx.dev/blob/main/LICENSE',
		usage: 'Nuxt SSR/downstream app probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'nuxt',
		repo: 'nuxt/nuxt',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/nuxt/nuxt/blob/main/LICENSE',
		usage: 'Nuxt framework SSR probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'pinia',
		repo: 'vuejs/pinia',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/vuejs/pinia/blob/v3/LICENSE',
		usage: 'State management compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'primevue',
		repo: 'primefaces/primevue',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/primefaces/primevue/blob/master/LICENSE.md',
		usage: 'Component library compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'quasar',
		repo: 'quasarframework/quasar',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/quasarframework/quasar/blob/dev/LICENSE',
		usage: 'Framework/component suite compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'radix-vue',
		repo: 'radix-vue/radix-vue',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/radix-vue/radix-vue/blob/main/LICENSE',
		usage: 'Component primitive compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'router',
		repo: 'vuejs/router',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/vuejs/router/blob/main/LICENSE',
		usage: 'Router compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'test-utils',
		repo: 'vuejs/test-utils',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/vuejs/test-utils/blob/main/LICENSE',
		usage: 'Test utility compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'vant',
		repo: 'youzan/vant',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/youzan/vant/blob/main/LICENSE',
		usage: 'Component library compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'vite-plugin-vue',
		repo: 'vitejs/vite-plugin-vue',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/vitejs/vite-plugin-vue/blob/main/LICENSE',
		usage: 'Vite Vue plugin compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'vitepress',
		repo: 'vuejs/vitepress',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/vuejs/vitepress/blob/main/LICENSE',
		usage: 'SSG framework compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'vue-i18n',
		repo: 'intlify/vue-i18n',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/intlify/vue-i18n/blob/master/LICENSE',
		usage: 'I18n compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'vue-jsx-vapor',
		repo: 'vuejs/vue-jsx-vapor',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/vuejs/vue-jsx-vapor/blob/main/LICENSE',
		usage: 'JSX/TSX Vapor implementation probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'vue-macros',
		repo: 'vue-macros/vue-macros',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/vue-macros/vue-macros/blob/main/LICENSE',
		usage: 'Macro ecosystem compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'vue-simple-compiler',
		repo: 'jinjiang/vue-simple-compiler',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl:
			'https://github.com/jinjiang/vue-simple-compiler/blob/main/LICENSE',
		usage: 'Compiler behavior compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'vuefes-2025-website',
		repo: 'vuejs-jp/vuefes-2025-website',
		license: 'No license detected by GitHub API',
		licenseClass: 'no-license',
		licenseUrl: 'https://github.com/vuejs-jp/vuefes-2025-website',
		usage: 'Nuxt SSG/downstream website probe',
		policy:
			'Allowed only as an external testbed: clone ephemerally, patch in workspace only, never vendor code, never redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'vuejs-docs',
		repo: 'vuejs/docs',
		license:
			'CC-BY-4.0 for repository contents except images; images retain owner terms',
		licenseClass: 'content',
		licenseUrl: 'https://github.com/vuejs/docs/blob/main/LICENSE',
		usage: 'VitePress SSG documentation probe',
		policy:
			'Allowed only as an external content testbed: clone ephemerally, patch in workspace only, never redistribute built site artifacts or images.',
		redistributesArtifacts: false,
	},
	{
		suite: 'vuetify',
		repo: 'vuetifyjs/vuetify',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/vuetifyjs/vuetify/blob/master/LICENSE.md',
		usage: 'Component framework compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'vuetify-jsx-vapor',
		repo: 'vuetifyjs/vuetify',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/vuetifyjs/vuetify/blob/master/LICENSE.md',
		usage: 'Component framework JSX/TSX Vapor compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
	{
		suite: 'vueuse',
		repo: 'vueuse/vueuse',
		license: 'MIT',
		licenseClass: 'permissive',
		licenseUrl: 'https://github.com/vueuse/vueuse/blob/main/LICENSE',
		usage: 'Composable utility compatibility probe',
		policy:
			'Clone ephemerally, patch in workspace only, do not redistribute build artifacts.',
		redistributesArtifacts: false,
	},
]
