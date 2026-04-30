#!/usr/bin/env bash
# Initialise the current folder as a fresh git repository and push it
# to a brand-new remote. Idempotent — re-running on an already-init'd
# folder just performs the push step.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
echo "Working in: $ROOT"

if [ -d ".git" ]; then
  echo "✓ git repo already initialised"
else
  echo "▶ git init"
  git init -q
  git branch -M main
fi

if [ -z "$(git config user.email 2>/dev/null || true)" ]; then
  read -rp "Git author name (e.g. 'Your Name'): " GIT_NAME
  read -rp "Git author email: " GIT_EMAIL
  git config user.name  "$GIT_NAME"
  git config user.email "$GIT_EMAIL"
fi

if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "▶ first commit"
  git add .
  git commit -q -m "Initial commit"
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo
  echo "Create an EMPTY private GitHub repo first (no README, no LICENSE,"
  echo "no .gitignore), then paste its URL below."
  read -rp "Remote URL (e.g. https://github.com/USERNAME/REPO_NAME.git): " REMOTE_URL
  git remote add origin "$REMOTE_URL"
fi

echo "▶ git push"
git push -u origin main

cat <<'EOM'

✓ Done. Next:

    npm i -g vercel
    vercel login
    vercel link
    vercel --prod
    ./scripts/verify-deployment.sh https://YOUR-DEPLOYMENT.vercel.app

No environment variables need to be set in Vercel — defaults are
baked in. Override only if you need to point at a different upstream.
EOM
