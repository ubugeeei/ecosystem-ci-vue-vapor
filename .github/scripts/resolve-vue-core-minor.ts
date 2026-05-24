import { execFile } from 'node:child_process'
import fs from 'node:fs'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const { stdout } = await execFileAsync('git', [
	'ls-remote',
	'https://github.com/vuejs/core.git',
	'refs/heads/minor',
])
const sha = stdout.trim().split(/\s+/)[0]

if (!sha) {
	throw new Error('Could not resolve vuejs/core minor')
}

const output = process.env.GITHUB_OUTPUT
if (!output) {
	throw new Error('GITHUB_OUTPUT is not set')
}

fs.appendFileSync(output, `sha=${sha}\n`)
