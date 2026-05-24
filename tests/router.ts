import { runInRepo } from '../utils.ts'
import type { RunOptions } from '../types.ts'

export async function test(options: RunOptions) {
	await runInRepo({
		...options,
		repo: 'vuejs/router',
		branch: 'main',
		build: 'build',
		beforeTest: 'pnpm exec playwright install --with-deps',
		test: 'test',
	})
}
