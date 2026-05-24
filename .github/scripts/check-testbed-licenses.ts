import { TESTBED_PROJECTS } from '../../tests/_testbed-manifest.ts'

const missingPolicy = TESTBED_PROJECTS.filter(
	(project) =>
		project.licenseClass !== 'permissive' && project.policy.trim() === '',
)
const redistributing = TESTBED_PROJECTS.filter(
	(project) => project.redistributesArtifacts,
)
const missingMetadata = TESTBED_PROJECTS.filter(
	(project) =>
		!project.suite ||
		!project.repo ||
		!project.license ||
		!project.licenseUrl ||
		!project.usage ||
		!project.policy,
)

if (missingPolicy.length || redistributing.length || missingMetadata.length) {
	console.error('Invalid testbed license manifest.')
	for (const project of missingMetadata) {
		console.error(`- ${project.suite || project.repo}: missing metadata`)
	}
	for (const project of missingPolicy) {
		console.error(`- ${project.suite}: non-permissive testbed lacks policy`)
	}
	for (const project of redistributing) {
		console.error(`- ${project.suite}: artifact redistribution is not allowed`)
	}
	process.exitCode = 1
} else {
	console.log(
		`testbed license manifest ok (${TESTBED_PROJECTS.length} projects)`,
	)
}
