import path from 'node:path'
import { runInRepo } from '../utils.ts'
import type { RunOptions } from '../types.ts'
import {
	excludeVueFromMinimumReleaseAge,
	installVueJsxVaporPackage,
	patchVuetifyForVueJsxVapor,
} from './vapor-mode-utils.ts'

export async function test(options: RunOptions) {
	await runInRepo({
		...options,
		repo: 'vuetifyjs/vuetify',
		branch: 'master',
		verify: false,
		patchFiles: {
			'packages/vuetify/package.json': installVueJsxVaporPackage,
			'pnpm-workspace.yaml': excludeVueFromMinimumReleaseAge,
		},
		async beforeBuild() {
			patchVuetifyForVueJsxVapor(path.join(options.workspace, 'vuetify'))
		},
		build: [
			'pnpm exec playwright install chromium',
			'pnpm --filter vuetify run test:browser -- --run',
		],
	})
}
