import path from 'node:path'
import { runInRepo } from '../utils.ts'
import type { RunOptions } from '../types.ts'
import {
	enableVaporModeForVueFiles,
	patchVitePressConfigForVapor,
	patchVitePressThemeForVapor,
} from './vapor-mode-utils.ts'

export async function test(options: RunOptions) {
	await runInRepo({
		...options,
		repo: 'vuejs/docs',
		branch: 'main',
		verify: false,
		async beforeBuild() {
			const dir = path.resolve(options.workspace, 'docs')
			patchVitePressConfigForVapor(path.join(dir, '.vitepress/config.ts'))
			patchVitePressThemeForVapor(path.join(dir, '.vitepress/theme/index.ts'))
			enableVaporModeForVueFiles(path.join(dir, '.vitepress/theme'))
		},
		build: ['type', 'build'],
	})
}
