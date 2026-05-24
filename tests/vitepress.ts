import { runInRepo } from '../utils.ts'
import type { RunOptions } from '../types.ts'

export async function test(options: RunOptions) {
	await runInRepo({
		...options,
		repo: 'vuejs/vitepress',
		branch: 'main',
		build: 'build',
		test: 'test',
	})
}
