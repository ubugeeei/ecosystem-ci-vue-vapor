import { runInFixture } from '../utils.ts'
import type { RunOptions } from '../types.ts'

export async function test(options: RunOptions) {
	await runInFixture({
		...options,
		fixture: 'vapor-vrt',
		beforeTest: { script: 'install:browser' },
		test: 'test',
	})
}
