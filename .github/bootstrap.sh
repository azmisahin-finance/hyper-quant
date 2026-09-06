#!/usr/bin/env bash
set -euo pipefail

git init
git add .
git status --short
git diff --cached --stat
printf '\nRepository prepared. Review the staged diff, then commit/push manually.\n'
