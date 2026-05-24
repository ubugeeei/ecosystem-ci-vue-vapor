import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

const root = fileURLToPath(new URL('../..', import.meta.url))

for (const target of ['.verdaccio-cache/.local', 'workspace']) {
	fs.rmSync(path.join(root, target), { recursive: true, force: true })
}

await execa('pnpm', ['store', 'prune'], {
	cwd: root,
	stdio: 'inherit',
})
