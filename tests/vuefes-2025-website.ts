import path from 'node:path'
import { runInRepo } from '../utils.ts'
import type { RunOptions } from '../types.ts'
import {
	enableVaporModeForVueFiles,
	excludeVueFromMinimumReleaseAge,
	installNuxtVaporInterop,
} from './vapor-mode-utils.ts'

export async function test(options: RunOptions) {
	await runInRepo({
		...options,
		repo: 'vuejs-jp/vuefes-2025-website',
		branch: 'main',
		verify: false,
		patchFiles: {
			'package.json': (content) => {
				const pkg = JSON.parse(content)
				pkg.scripts.postinstall = 'nuxt prepare'
				return JSON.stringify(pkg, null, 2) + '\n'
			},
			'pnpm-workspace.yaml': excludeVueFromMinimumReleaseAge,
		},
		async beforeBuild() {
			const dir = path.resolve(options.workspace, 'vuefes-2025-website')
			installNuxtVaporInterop(dir)
			enableVaporModeForVueFiles(dir)
		},
		build: ['check', 'generate'],
	})
}
