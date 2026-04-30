#!/usr/bin/env bash
# Verify a deployed instance is healthy and the proxy is properly
# camouflaged.
#
# Usage: ./scripts/verify-deployment.sh https://your-app.vercel.app

set -uo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 https://your-app.vercel.app [proxy_path]"
  echo "       proxy_path defaults to /abc2"
  exit 1
fi

BASE="${1%/}"
PROXY_PATH="${2:-/abc2}"

PASS=0
FAIL=0

bold()  { printf '\033[1m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m'  "$*"; }
red()   { printf '\033[31m%s\033[0m'  "$*"; }
gray()  { printf '\033[90m%s\033[0m'  "$*"; }

check() {
  local name="$1" cmd="$2" expect="$3"
  local out
  out="$(eval "$cmd" 2>&1)"
  if echo "$out" | grep -qE "$expect"; then
    printf "  %s %s\n" "$(green ✓)" "$name"
    PASS=$((PASS+1))
  else
    printf "  %s %s\n" "$(red ✗)"   "$name"
    printf "      $(gray got:) %s\n" "$(echo "$out" | head -c 160)"
    printf "      $(gray want match:) %s\n" "$expect"
    FAIL=$((FAIL+1))
  fi
}

bold "Verifying: $BASE  (proxy_path=$PROXY_PATH)"
echo

bold "1) Decoy site"
check "GET /  → HTML 200"               "curl -sIo /dev/null -w '%{http_code} %{content_type}' '$BASE/'"           "^200 text/html"
check "GET /  contains site title"      "curl -s '$BASE/'"                                                          "Mahandevs Lab"
for p in /blog /projects /about /uses /contact; do
  check "GET $p → 200"                  "curl -sIo /dev/null -w '%{http_code}' '$BASE$p'"                            "^200"
done
check "GET /sitemap.xml"                "curl -s '$BASE/sitemap.xml' | head -c 80"                                   "<urlset"
check "GET /feed.xml"                   "curl -s '$BASE/feed.xml' | head -c 80"                                      "<rss"
check "GET /robots.txt"                 "curl -s '$BASE/robots.txt'"                                                  "Sitemap:"
check "GET /favicon.svg"                "curl -s '$BASE/favicon.svg' | head -c 80"                                    "<svg"
check "GET /site.webmanifest"           "curl -s '$BASE/site.webmanifest'"                                            "short_name"

echo
bold "2) Decoy site JSON APIs"
check "GET /api/health"                 "curl -s '$BASE/api/health'"                                                  '"status":"ok"|"status":"healthy"'
check "GET /api/posts"                  "curl -s '$BASE/api/posts' | head -c 120"                                     '"count"'
check "GET /api/views?path=/blog"       "curl -s '$BASE/api/views?path=/blog'"                                        '"views"'

echo
bold "3) Camouflage on $PROXY_PATH (the proxy path itself)"
check "GET $PROXY_PATH        → JSON"   "curl -s '$BASE$PROXY_PATH'"                                                  '"service":"threads"'
check "GET $PROXY_PATH/health → JSON"   "curl -s '$BASE$PROXY_PATH/health'"                                           '"healthy"'
check "GET $PROXY_PATH/threads"         "curl -s '$BASE$PROXY_PATH/threads' | head -c 120"                            '"items"'
check "GET $PROXY_PATH/recent"          "curl -s '$BASE$PROXY_PATH/recent' | head -c 120"                             '"cursor"'
check "GET $PROXY_PATH/schema"          "curl -s '$BASE$PROXY_PATH/schema' | head -c 120"                             '"openapi"'
check "OPTIONS $PROXY_PATH → 204"       "curl -sIo /dev/null -X OPTIONS -w '%{http_code}' '$BASE$PROXY_PATH'"         "^204"
check "DELETE $PROXY_PATH → 405 JSON"   "curl -s -X DELETE '$BASE$PROXY_PATH'"                                        '"method_not_allowed"'

echo
bold "4) Pro response headers on proxy path"
HDRS="$(curl -sI "$BASE$PROXY_PATH")"
for h in "x-request-id" "x-api-version" "server-timing" "cache-control"; do
  if echo "$HDRS" | grep -qi "^$h:"; then
    printf "  %s header %s\n" "$(green ✓)" "$h"; PASS=$((PASS+1))
  else
    printf "  %s header %s missing\n" "$(red ✗)" "$h"; FAIL=$((FAIL+1))
  fi
done

echo
bold "5) XHTTP-shaped probe (POST with session-id)"
SESSION="abcdef0123456789abcdef0123456789"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'content-type: application/octet-stream' -H 'accept: */*' \
  --data 'test' "$BASE$PROXY_PATH/$SESSION/up")"
case "$CODE" in
  200|204|206)
    printf "  %s POST $PROXY_PATH/<session>/up → %s (upstream is responding)\n" "$(green ✓)" "$CODE"
    PASS=$((PASS+1))
    ;;
  502|503|504)
    printf "  %s POST $PROXY_PATH/<session>/up → %s (upstream unreachable but path correctly entered proxy)\n" "$(green ✓)" "$CODE"
    PASS=$((PASS+1))
    ;;
  *)
    printf "  %s POST $PROXY_PATH/<session>/up returned unexpected %s\n" "$(red ✗)" "$CODE"
    FAIL=$((FAIL+1))
    ;;
esac

echo
echo "─────────────────────────────────────────"
printf "%s %d passed, %d failed\n" "$( [ $FAIL -eq 0 ] && green ✓ || red ✗ )" "$PASS" "$FAIL"

if [ $FAIL -eq 0 ]; then
  echo
  echo "✅ Deployment is healthy. Now point your VLESS client's host= to:"
  echo "       ${BASE#https://}"
  echo "   and connect."
  exit 0
else
  exit 1
fi
