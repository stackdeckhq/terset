# Contributing

Thanks for helping with Terset. Everyone who takes part follows the [code of conduct](CODE_OF_CONDUCT.md).

## What we welcome

- Bugs in the package or the site.
- Format or spec problems: an unclear rule, an ambiguous case, a round trip that loses data.

For a new feature, start a discussion first: https://github.com/stackdeckhq/terset/discussions. Write code only after we agree on the idea.

For a security problem, do not open an issue. See [SECURITY.md](SECURITY.md).

## Set up

You need Node 24 and pnpm 10.34.5. Corepack picks the right pnpm for you.

```sh
corepack enable
pnpm install
```

## Check your change

```sh
pnpm gate
```

The gate runs the type check, lint, the tests, the package build, the site build and a deploy dry run. It must pass before a pull request is merged.

To release: merge the release PR, push the matching version tag, and the site follows after both packages publish.

## Pull requests

- Link the issue or discussion where we agreed on the change. A pull request with no linked issue or agreed discussion may be closed without review.
- Fix one problem per pull request.
- Say how you found the problem and how you checked the fix. "Tests pass" alone is not enough.
- Add a test for any bug you fix. A change to round trips or token counts needs a test.
- A format change also needs a change to `packages/terset/SPEC.md`.
- Pull requests are squash merged.
- CI runs for outside contributors wait until a maintainer approves them. That includes your first pull request.
