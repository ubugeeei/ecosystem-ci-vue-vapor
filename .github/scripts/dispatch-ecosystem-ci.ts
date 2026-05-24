const token = process.env.GITHUB_TOKEN
const repository = process.env.GITHUB_REPOSITORY
const sha = process.env.MINOR_SHA

if (!token) {
	throw new Error('GITHUB_TOKEN is not set')
}
if (!repository) {
	throw new Error('GITHUB_REPOSITORY is not set')
}
if (!sha) {
	throw new Error('MINOR_SHA is not set')
}

const response = await fetch(
	`https://api.github.com/repos/${repository}/dispatches`,
	{
		method: 'POST',
		headers: {
			accept: 'application/vnd.github+json',
			authorization: `Bearer ${token}`,
			'content-type': 'application/json',
			'x-github-api-version': '2022-11-28',
		},
		body: JSON.stringify({
			event_type: 'ecosystem-ci',
			client_payload: {
				refType: 'commit',
				ref: sha,
				repo: 'vuejs/core',
				reason: 'vuejs/core minor branch changed',
			},
		}),
	},
)

if (!response.ok) {
	throw new Error(
		`Failed to dispatch ecosystem-ci: ${response.status} ${await response.text()}`,
	)
}
