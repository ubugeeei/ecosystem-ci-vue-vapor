import { runInFixture } from '../utils.ts'
import type { RunOptions } from '../types.ts'

export async function test(options: RunOptions) {
	await runInFixture({
		...options,
		fixture: 'vapor-interop-fuzz',
		test: 'test',
	})
}
