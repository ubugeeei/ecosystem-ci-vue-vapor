import path from 'node:path'
import { runInRepo } from '../utils.ts'
import type { RunOptions } from '../types.ts'
import {
	enableVaporModeForVueFiles,
	excludeVueFromMinimumReleaseAge,
	patchMisskeyForVapor,
} from './vapor-mode-utils.ts'

export async function test(options: RunOptions) {
	await runInRepo({
		...options,
		repo: 'misskey-dev/misskey',
		branch: 'develop',
		verify: false,
		patchFiles: {
			'pnpm-workspace.yaml': excludeVueFromMinimumReleaseAge,
		},
		async beforeBuild() {
			const dir = path.resolve(options.workspace, 'misskey')
			patchMisskeyForVapor(dir)
			enableVaporModeForVueFiles(path.join(dir, 'packages/frontend/src'))
		},
		build: [
			'build-pre',
			'pnpm --filter frontend typecheck',
			'pnpm --filter frontend build',
		],
		test: 'pnpm --filter frontend test',
	})
}
