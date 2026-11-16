# Rulesets and repository settings

These files are the rulesets for this repository, in the body shape the GitHub REST API takes.

## The rulesets

`main-history.json` keeps the history of the default branch. Nobody can bypass it.

- The branch cannot be deleted or force pushed.
- History stays linear.

`main.json` sets how changes reach the default branch.

- Changes come in through a pull request. No approval is needed, but every review thread must be resolved.
- Pull requests merge by squash only.
- The `gate` check from GitHub Actions must pass on a branch that is up to date with `main`.
- Repository admins can bypass these two rules. That keeps the owner's direct push working after he runs `pnpm gate` locally.

`release-tags.json` decides who can release.

- Only repository admins can create a release tag (`v*`).
- Pushing a `v*` tag starts the release workflow, so this decides who can publish to npm.

`release-tags-history.json` keeps released tags fixed. Nobody can bypass it.

- A release tag cannot be moved, deleted or force pushed.

## Create a ruleset

```sh
gh api repos/stackdeckhq/terset/rulesets --input .github/rulesets/main-history.json
gh api repos/stackdeckhq/terset/rulesets --input .github/rulesets/main.json
gh api repos/stackdeckhq/terset/rulesets --input .github/rulesets/release-tags.json
gh api repos/stackdeckhq/terset/rulesets --input .github/rulesets/release-tags-history.json
```

## Read them back

```sh
gh api repos/stackdeckhq/terset/rulesets
gh api repos/stackdeckhq/terset/rulesets/RULESET_ID
```

## Update a ruleset

Take the id from the list above, then:

```sh
gh api -X PUT repos/stackdeckhq/terset/rulesets/RULESET_ID --input .github/rulesets/main.json
```

## Repository settings

Apply these once. Each has a command where the API supports it.

Squash merge only, delete the branch on merge, wiki off, discussions on:

```sh
gh api -X PATCH repos/stackdeckhq/terset \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -F has_wiki=false \
  -F has_discussions=true \
  -f squash_merge_commit_title=PR_TITLE \
  -f squash_merge_commit_message=PR_BODY
```

Secret scanning and push protection on:

```sh
gh api -X PATCH repos/stackdeckhq/terset --input - <<'JSON'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
JSON
```

Dependabot alerts on, and Dependabot security updates on:

```sh
gh api -X PUT repos/stackdeckhq/terset/vulnerability-alerts
gh api -X PUT repos/stackdeckhq/terset/automated-security-fixes
```

Private vulnerability reporting on:

```sh
gh api -X PUT repos/stackdeckhq/terset/private-vulnerability-reporting
```

The Actions token is read-only by default, and Actions cannot approve pull requests:

```sh
gh api -X PUT repos/stackdeckhq/terset/actions/permissions/workflow \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false
```

Workflow runs from every outside contributor wait for approval:

```sh
gh api -X PUT repos/stackdeckhq/terset/actions/permissions/fork-pr-contributor-approval \
  -f approval_policy=all_external_contributors
```

If that call fails, set it by hand: Settings, Actions, General, "Approval for running fork pull request workflows from contributors", then "Require approval for all external contributors".

Allow only GitHub-owned actions plus `pnpm/action-setup` and `pypa/gh-action-pypi-publish` (the Python release step), and require every action to be pinned to a full commit SHA:

```sh
gh api -X PUT repos/stackdeckhq/terset/actions/permissions \
  -F enabled=true \
  -f allowed_actions=selected \
  -F sha_pinning_required=true

gh api -X PUT repos/stackdeckhq/terset/actions/permissions/selected-actions \
  -F github_owned_allowed=true \
  -F verified_allowed=false \
  -f 'patterns_allowed[]=pnpm/action-setup@*' \
  -f 'patterns_allowed[]=pypa/gh-action-pypi-publish@*'
```

If the organization sets a stricter Actions policy, the organization policy wins.

Create the `spec` label that the format issue form uses:

```sh
gh label create spec --repo stackdeckhq/terset --description "Format or spec problem" --color 1D76DB
```

## The npm environment

The npm publish job in the release workflow (`release.yml`) runs in a GitHub environment named `npm`. Create it so that only `v*` tags can use it and a reviewer must approve each release:

```sh
REVIEWER_ID="$(gh api users/its-luis-sch --jq .id)"

gh api -X PUT repos/stackdeckhq/terset/environments/npm --input - <<JSON
{
  "reviewers": [{ "type": "User", "id": $REVIEWER_ID }],
  "prevent_self_review": false,
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
JSON

gh api repos/stackdeckhq/terset/environments/npm/deployment-branch-policies \
  -f name='v*' -f type=tag
```

## The pypi environment

The Python publish job in the same workflow runs in a GitHub environment named `pypi`. Create it the same way, with the same reviewer and the same `v*` tag rule:

```sh
gh api -X PUT repos/stackdeckhq/terset/environments/pypi --input - <<JSON
{
  "reviewers": [{ "type": "User", "id": $REVIEWER_ID }],
  "prevent_self_review": false,
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
JSON

gh api repos/stackdeckhq/terset/environments/pypi/deployment-branch-policies \
  -f name='v*' -f type=tag
```

## The site environment

The deploy workflow (`deploy.yml`) publishes terset.dev on every push to `main`. It runs in a GitHub environment named `site`. Create it so that only `main` can use it. It has no reviewer, because the deploy is automatic:

```sh
gh api -X PUT repos/stackdeckhq/terset/environments/site --input - <<JSON
{
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
JSON

gh api repos/stackdeckhq/terset/environments/site/deployment-branch-policies \
  -f name='main' -f type=branch
```

The environment holds one secret, `CLOUDFLARE_API_TOKEN`: a Cloudflare API token that can edit the `terset-site` Worker. Set it without putting the value in the shell history:

```sh
gh secret set CLOUDFLARE_API_TOKEN --repo stackdeckhq/terset --env site
```

## Settings with no API

- npm trusted publisher: on npmjs.com, open the `@stackdeck/terset` package, then Settings, then Trusted Publisher. Choose GitHub Actions and enter organization `stackdeckhq`, repository `terset`, workflow file `release.yml` and environment `npm`. After the first trusted release works, set Publishing access to "Require two-factor authentication and disallow tokens".
- PyPI trusted publisher: on pypi.org, open the `terset` project, then Manage, then Publishing. Add a GitHub publisher with owner `stackdeckhq`, repository `terset`, workflow `release.yml` and environment `pypi`. The workflow then publishes with a short-lived token from GitHub, so no PyPI API token is stored anywhere. If a PyPI API token for this project exists, delete it after the first trusted release works.
