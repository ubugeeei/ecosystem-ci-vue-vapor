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
		repo: 'elk-zone/elk',
		branch: 'main',
		verify: false,
		patchFiles: {
			'pnpm-workspace.yaml': excludeVueFromMinimumReleaseAge,
		},
		async beforeBuild() {
			const dir = path.resolve(options.workspace, 'elk')
			installNuxtVaporInterop(dir)
			enableVaporModeForVueFiles(dir)
		},
		build: ['test:typecheck', 'build'],
		test: 'test:ci',
	})
}
