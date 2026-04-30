#!/usr/bin/env bash
# Initialize this folder as a fresh git repository and push it to a new
# remote. Idempotent — re-running it on an already-initialised folder
# just does the push step.

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
  git commit -q -m "Initial commit: stealth XHTTP relay for Vercel"
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo
  echo "Create an EMPTY private GitHub repo first (no README, no LICENSE, no .gitignore),"
  echo "then paste its URL below."
  read -rp "Remote URL (e.g. https://github.com/USERNAME/vercel-xhttp-stealth-relay.git): " REMOTE_URL
  git remote add origin "$REMOTE_URL"
fi

echo "▶ git push"
git push -u origin main

echo
echo "✓ Done. Next steps:"
echo "    1. npm i -g vercel  (if you don't have it)"
echo "    2. vercel login"
echo "    3. vercel link"
echo "    4. echo 'https://my.mahandevs.com:8080' | vercel env add TARGET_DOMAIN production"
echo "    5. vercel --prod"
echo "    6. ./scripts/verify-deployment.sh https://YOUR-DEPLOYMENT.vercel.app"
