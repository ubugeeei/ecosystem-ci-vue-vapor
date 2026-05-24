import { runInRepo } from '../utils.ts'
import type { RunOptions } from '../types.ts'

export async function test(options: RunOptions) {
	await runInRepo({
		...options,
		repo: 'vuejs/pinia',
		branch: 'v3',
		test: 'test',
	})
}
