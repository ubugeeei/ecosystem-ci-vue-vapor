import { runInRepo } from '../utils.ts'
import type { RunOptions } from '../types.ts'

export async function test(options: RunOptions) {
	await runInRepo({
		...options,
		repo: 'vuejs/vue-jsx-vapor',
		branch: 'main',
		verify: false,
		build: ['build', 'typecheck'],
		test: 'test',
	})
}
