import path from 'node:path'
import { runInRepo } from '../utils.ts'
import type { RunOptions } from '../types.ts'
import {
	installVueJsxVaporPackage,
	patchNaiveUiForVueJsxVapor,
} from './vapor-mode-utils.ts'

export async function test(options: RunOptions) {
	await runInRepo({
		...options,
		repo: 'tusen-ai/naive-ui',
		branch: 'main',
		verify: false,
		patchFiles: {
			'package.json': installVueJsxVaporPackage,
		},
		async beforeBuild() {
			patchNaiveUiForVueJsxVapor(path.join(options.workspace, 'naive-ui'))
		},
		build: 'test:cov',
	})
}
