#!/usr/bin/env bash
# Vercel "Ignored Build Step" for both projects (MVP/frontend, MVP/backend),
# wired through `ignoreCommand` in each vercel.json. Exit 0 skips the build,
# exit 1 runs it.
#
# Deploys are on demand to stay inside the Hobby plan's build budget: a push
# only builds when it lands on `main` AND its commit message contains
# `[deploy]`. Dependabot and every other preview branch never build.
# Dashboard "Redeploy" and `vercel --prod` from the CLI bypass this script.

if [ "${VERCEL_GIT_COMMIT_REF:-}" != "main" ]; then
  echo "Skip: branch '${VERCEL_GIT_COMMIT_REF:-?}' is not main."
  exit 0
fi

case "${VERCEL_GIT_COMMIT_MESSAGE:-}" in
  *"[deploy]"*)
    echo "Build: commit is tagged [deploy]."
    exit 1
    ;;
esac

echo "Skip: add [deploy] to the commit message to deploy."
exit 0
