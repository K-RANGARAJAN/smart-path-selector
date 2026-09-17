#!/usr/bin/env bash
# Build the browser-only dashboard, verify it against Python, and publish it to the
# gh-pages branch (served at https://k-rangarajan.github.io/smart-path-selector/).
set -euo pipefail
cd "$(dirname "$0")/.."

.venv/bin/python -m smartpath export-site
node tools/check_site.js build/site/data.json build/site_parity.json

source_commit=$(git rev-parse --short HEAD)
tmp=$(mktemp -d)
trap 'git worktree remove --force "$tmp" 2>/dev/null || true' EXIT

if git ls-remote --exit-code --heads origin gh-pages >/dev/null; then
  git fetch -q origin gh-pages
  git worktree add -q "$tmp" origin/gh-pages
  git -C "$tmp" checkout -q -B gh-pages
else
  git worktree add -q --detach "$tmp"
  git -C "$tmp" checkout -q --orphan gh-pages
fi
git -C "$tmp" rm -rq --ignore-unmatch .
cp -R build/site/. "$tmp"/
git -C "$tmp" add -A
if git -C "$tmp" diff --cached --quiet; then
  echo "Site unchanged; nothing to deploy."
else
  git -C "$tmp" commit -q -m "Published the live dashboard from $source_commit"
  git -C "$tmp" push -q origin gh-pages
  echo "Deployed to gh-pages."
fi
