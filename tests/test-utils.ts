import { runInRepo } from '../utils.ts'
import type { RunOptions } from '../types.ts'

export async function test(options: RunOptions) {
	await runInRepo({
		...options,
		repo: 'vuejs/test-utils',
		branch: 'main',
		test: ['test:coverage', 'test:build', 'tsd', 'vue-tsc'],
	})
}
