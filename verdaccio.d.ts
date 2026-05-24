declare module 'verdaccio' {
	import type { Server } from 'node:http'

	export function parseConfigFile(configPath: string): Record<string, unknown>
	export function runServer(config: Record<string, unknown>): Promise<Server>
}
