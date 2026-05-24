import fs from 'node:fs'
import path from 'node:path'

const sha = process.env.MINOR_SHA
if (!sha) {
	throw new Error('MINOR_SHA is not set')
}

const dir = path.resolve('.cache/vue-core-minor')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'sha'), `${sha}\n`)
