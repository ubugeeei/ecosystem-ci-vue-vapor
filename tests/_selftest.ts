import path from 'node:path'
import { runInRepo } from '../utils.ts'
import type { RunOptions } from '../types.ts'

export async function test(options: RunOptions) {
	await runInRepo({
		...options,
		repo: 'vuejs/ecosystem-ci',
		test: 'pnpm run selftestscript',
		verify: false,
		patchFiles: {
			'package.json': (content) => {
				const pkg = JSON.parse(content)
				if (pkg.name !== '@vue/ecosystem-ci') {
					throw new Error(
						`invalid checkout, expected package.json with "name": "@vue/ecosystem-ci" in ${path.resolve(
							options.workspace,
							'ecosystem-ci',
						)}`,
					)
				}
				pkg.scripts.selftestscript = `node -e "const fs = require('node:fs'); if (!fs.existsSync('../../core/packages/vue/dist')) { console.error('vue build failed'); process.exit(1) }"`
				return JSON.stringify(pkg, null, 2)
			},
		},
	})
}
