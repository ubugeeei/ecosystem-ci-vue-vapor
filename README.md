# Vue Vapor Ecosystem CI

This repository is a Vapor-focused fork of `vuejs/ecosystem-ci`.

Its job is to track the Vapor implementation on the `vuejs/core` `minor`
branch, run it against real downstream projects, and collect failures in this
fork before anything is raised upstream. The Vue.js Core Team can then triage
the results here and decide which findings should be manually reported to the
implementation repository.

## Motivation

Vapor Mode needs confidence from the outside of Vue core, not only unit tests
inside `vuejs/core`. Production readiness depends on SSR, SSG, large
applications, JSX/TSX, and VDOM/Vapor interop all continuing to work under real
build tools and dependency graphs.

This fork therefore treats downstream projects as black-box probes. It installs
the selected Vue build through package-manager overrides, forces representative
SFCs into Vapor compilation where possible, wires `vaporInteropPlugin` into the
host app, and runs the downstream build and test commands.

## Policy

- Test `vuejs/core` `minor` by default.
- Never mutate or comment on `vuejs/core` from automation.
- File failures only in `ubugeeei/ecosystem-ci-vue-vapor`.
- Keep downstream patches local to the CI workspace.
- Treat downstream repositories as external testbeds only. Do not vendor their
  source, do not commit patched copies, and do not redistribute generated
  artifacts.
- Prefer observable behavior: build output, SSR/SSG success, hydration, DOM
  updates, interop warnings, and downstream test results.
- Run on Node.js 24+ and execute TypeScript directly with Node's stable strip
  types support. Do not use `tsx` for this repository's runner scripts.

## Tooling

This fork assumes Vite+ for local and CI tooling. Lint, format, type-aware
checks, and staged-file checks live in `vite.config.ts` instead of separate
ESLint, Prettier, or lint-staged configuration files.

Use `vp install` to install dependencies, `vp check` for the unified static
check, and `vp run check:testbeds` to validate the downstream license manifest.

## Testbed Licenses

All downstream projects cloned by suites are listed in
`tests/_testbed-manifest.ts`. The manifest records the suite, repository,
license class, license source, usage, and artifact redistribution policy. CI
uses downstream checkouts only as ephemeral test inputs.

Most tracked projects are MIT licensed. The explicit non-MIT or non-detected
cases are:

| Suite                 | Repository                     | License status                                                             | Policy                                                                |
| --------------------- | ------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `misskey`             | `misskey-dev/misskey`          | AGPL-3.0                                                                   | External testbed only; no vendoring or artifact redistribution.       |
| `vuejs-docs`          | `vuejs/docs`                   | CC BY 4.0 for repository contents except images; images retain owner terms | External content testbed only; no built site or image redistribution. |
| `vuefes-2025-website` | `vuejs-jp/vuefes-2025-website` | No license detected by GitHub API                                          | External testbed only; no vendoring or artifact redistribution.       |

## Suites

Existing ecosystem suites are retained, and Vapor-specific coverage is added:

- SSR / Nuxt: `npmx`, `nuxt`, `elk`
- SSG: `vuefes-2025-website`, `vuejs-docs`, `vitepress`
- Large apps: `misskey`, `elk`
- JSX / TSX: `vue-jsx-vapor`, `vuetify-jsx-vapor`,
  `naive-ui-jsx-vapor`
- VDOM / Vapor interop fuzzing: `vapor-interop-fuzz`
- Visual regression: `vapor-vrt`

The `vapor-interop-fuzz` suite is a local fixture. It compiles Vapor SFCs,
mounts them from both VDOM and Vapor roots, randomly switches VDOM/Vapor
components across seeded runs, exercises slots, fragments, keyed lists, events,
Teleport, unmounting, and SSR hydration, then fails on observable mismatches or
interop/hydration warnings.

The `vapor-vrt` suite is also a local fixture. It resolves the latest stable
Vue release from npm at runtime, renders the non-Vapor baseline, then renders
the same page/state manifest with the tested Vapor build. It covers every page
and state declared in the fixture manifest across desktop and mobile viewports,
and compares screenshots with pixel-level diffs.

## Workflows

- `ecosystem-ci.yml` runs all suites every day and can be manually dispatched.
- `ecosystem-ci-selected.yml` runs one selected suite manually.
- `ecosystem-ci-from-pr.yml` manually runs a branch or commit associated with a
  Vue PR, but reports only inside this fork.
- `vue-core-minor-watch.yml` polls `vuejs/core` `minor` hourly. When it sees a
  new branch head SHA, it dispatches `ecosystem-ci.yml` against that commit.

Failures create or update issues in this repository with labels:
`ecosystem-ci`, `vapor`, and `suite:<name>`.

## Running Locally

Install dependencies:

```sh
vp install
```

Run project checks:

```sh
vp check
vp run check:testbeds
```

Run all suites against `vuejs/core` `minor`:

```sh
vp run test --branch minor
```

Run one suite:

```sh
vp run test --branch minor vapor-interop-fuzz
vp run test --branch minor vapor-vrt
vp run test --branch minor npmx
```

Run against a pkg.pr.new continuous release:

```sh
vp run test --release @<commit> vapor-interop-fuzz
```

Run against a local Vue build by linking a local `vuejs/core/packages` directory
to `built-packages` in this repository, then:

```sh
vp run test --local vapor-interop-fuzz
```

If the same Vue version or tag is tested repeatedly, run `vp run clean` first to
purge the workspace and local registry cache.

## Adding Coverage

Add a file in `tests/<suite>.ts` and call `runInRepo` for downstream projects or
`runInFixture` for local black-box fixtures. For Vapor downstream probes, prefer
the helpers in `tests/vapor-mode-utils.ts`:

- `enableVaporModeForVueFiles`
- `installNuxtVaporInterop`
- `patchViteConfigVueAlias`
- `patchVitePressConfigForVapor`
- `patchVitePressThemeForVapor`
- `patchMisskeyForVapor`

Once a suite is stable, add it to the workflow matrices and dispatch choices.
