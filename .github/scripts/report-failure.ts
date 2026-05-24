const token = requiredEnv('GITHUB_TOKEN')

main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})

async function main() {
	const suite = requiredEnv('SUITE')
	const refType = requiredEnv('REF_TYPE')
	const ref = requiredEnv('REF')
	const vueRepo = requiredEnv('VUE_REPO')
	const repository = requiredEnv('GITHUB_REPOSITORY')
	const [owner, repo] = repository.split('/')

	if (!owner || !repo) {
		throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`)
	}

	const runUrl = `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`
	const title = `[ecosystem-ci] ${suite} failed for ${vueRepo}@${refType}:${ref}`
	const labels = ['ecosystem-ci', 'vapor', `suite:${suite}`]
	const body = [
		`Suite \`${suite}\` failed while testing \`${vueRepo}\` \`${refType}:${ref}\`.`,
		'',
		`Run: ${runUrl}`,
		`Workflow: ${process.env.GITHUB_WORKFLOW}`,
		`Event: ${process.env.GITHUB_EVENT_NAME}`,
		`Commit: ${process.env.GITHUB_SHA}`,
		'',
		'This issue is intentionally filed in this fork. Do not report directly to vuejs/core from automation.',
	].join('\n')

	if (process.env.DRY_RUN === '1') {
		console.log(JSON.stringify({ title, labels, body }, null, 2))
		return
	}

	for (const label of labels) {
		const response = await github(`/repos/${repository}/labels`, {
			method: 'POST',
			body: {
				name: label,
				color: label.startsWith('suite:') ? 'C2E0C6' : '5319E7',
			},
		})
		if (!response.ok && response.status !== 422) {
			throw new Error(
				`Failed to create label ${label}: ${response.status} ${await response.text()}`,
			)
		}
	}

	const issues = await githubJson<any[]>(
		`/repos/${repository}/issues?state=open&labels=${encodeURIComponent(
			labels.join(','),
		)}&per_page=100`,
	)
	const existing = issues.find((issue) => issue.title === title)

	if (existing) {
		await githubJson(
			`/repos/${repository}/issues/${existing.number}/comments`,
			{
				method: 'POST',
				body: { body },
			},
		)
	} else {
		await githubJson(`/repos/${repository}/issues`, {
			method: 'POST',
			body: {
				title,
				body,
				labels,
			},
		})
	}
}

function requiredEnv(name: string): string {
	const value = process.env[name]
	if (!value) {
		throw new Error(`${name} is not set`)
	}
	return value
}

async function github(
	path: string,
	options: { method?: string; body?: unknown } = {},
) {
	return fetch(`https://api.github.com${path}`, {
		method: options.method ?? 'GET',
		headers: {
			accept: 'application/vnd.github+json',
			authorization: `Bearer ${token}`,
			'content-type': 'application/json',
			'x-github-api-version': '2022-11-28',
		},
		body: options.body == null ? undefined : JSON.stringify(options.body),
	})
}

async function githubJson<T>(
	path: string,
	options: { method?: string; body?: unknown } = {},
): Promise<T> {
	const response = await github(path, options)
	if (!response.ok) {
		throw new Error(
			`GitHub API request failed: ${response.status} ${await response.text()}`,
		)
	}
	return response.json() as Promise<T>
}
