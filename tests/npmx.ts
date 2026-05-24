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
		repo: 'npmx-dev/npmx.dev',
		branch: 'main',
		verify: false,
		patchFiles: {
			'pnpm-workspace.yaml': excludeVueFromMinimumReleaseAge,
		},
		async beforeBuild() {
			const dir = path.resolve(options.workspace, 'npmx.dev')
			installNuxtVaporInterop(dir)
			enableVaporModeForVueFiles(path.join(dir, 'app'))
		},
		build: ['test:types', 'build:test'],
		test: 'test:unit',
	})
}
