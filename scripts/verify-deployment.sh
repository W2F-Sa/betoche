#!/usr/bin/env bash
# Black-box verifier for a deployed instance. Validates the decoy
# site, JSON helpers, and the JSON service surface mounted at ROUTE
# (default /abc2). Also confirms the streaming endpoint is reachable.
#
# Usage: ./scripts/verify-deployment.sh https://your-app.vercel.app
#        ./scripts/verify-deployment.sh https://your-app.vercel.app /abc2

set -uo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 https://your-app.vercel.app [route]"
  echo "       route defaults to /abc2"
  exit 1
fi

BASE="${1%/}"
ROUTE="${2:-/abc2}"

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
    printf "  %s %s\n" "$(red ✗)" "$name"
    printf "      $(gray got:) %s\n"       "$(echo "$out" | head -c 160 | tr '\n' ' ')"
    printf "      $(gray want match:) %s\n" "$expect"
    FAIL=$((FAIL+1))
  fi
}

bold "Verifying: $BASE  (route=$ROUTE)"
echo

bold "1) Site"
check "GET / → HTML 200"            "curl -sIo /dev/null -w '%{http_code} %{content_type}' '$BASE/'" "^200 text/html"
check "GET / contains site title"   "curl -s '$BASE/'" "Mahandevs Lab"
for p in /blog /projects /about /uses /contact; do
  check "GET $p → 200" "curl -sIo /dev/null -w '%{http_code}' '$BASE$p'" "^200"
done
check "GET /sitemap.xml"      "curl -s '$BASE/sitemap.xml' | head -c 80" "<urlset"
check "GET /feed.xml"         "curl -s '$BASE/feed.xml' | head -c 80"     "<rss"
check "GET /robots.txt"       "curl -s '$BASE/robots.txt'"                "Sitemap:"
check "GET /favicon.svg"      "curl -s '$BASE/favicon.svg' | head -c 80"  "<svg"
check "GET /site.webmanifest" "curl -s '$BASE/site.webmanifest'"          "short_name"

echo
bold "2) JSON helpers"
check "GET /api/health"           "curl -s '$BASE/api/health'"           '"status":"ok"'
check "GET /api/posts"            "curl -s '$BASE/api/posts' | head -c 120" '"count"'
check "GET /api/views?path=/blog" "curl -s '$BASE/api/views?path=/blog'" '"views"'

echo
bold "3) JSON service surface on $ROUTE"
check "GET $ROUTE → service root"   "curl -s '$BASE$ROUTE'"                 '"service":"threads"'
check "GET $ROUTE/health"           "curl -s '$BASE$ROUTE/health'"          '"healthy"'
check "GET $ROUTE/threads"          "curl -s '$BASE$ROUTE/threads' | head -c 120" '"items"'
check "GET $ROUTE/recent"           "curl -s '$BASE$ROUTE/recent' | head -c 120"  '"cursor"'
check "GET $ROUTE/schema"           "curl -s '$BASE$ROUTE/schema' | head -c 120"  '"openapi"'
check "OPTIONS $ROUTE → 204"        "curl -sIo /dev/null -X OPTIONS -w '%{http_code}' '$BASE$ROUTE'" "^204"
check "DELETE $ROUTE → 405 JSON"    "curl -s -X DELETE '$BASE$ROUTE'"     '"method_not_allowed"'

echo
bold "4) Pro response headers"
HDRS="$(curl -sI "$BASE$ROUTE")"
for h in "x-request-id" "x-api-version" "server-timing" "cache-control" "vary"; do
  if echo "$HDRS" | grep -qi "^$h:"; then
    printf "  %s header %s\n" "$(green ✓)" "$h"; PASS=$((PASS+1))
  else
    printf "  %s header %s missing\n" "$(red ✗)" "$h"; FAIL=$((FAIL+1))
  fi
done

echo
bold "5) Streaming endpoint reachability"
SESSION="abcdef0123456789abcdef0123456789"
CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'content-type: application/octet-stream' -H 'accept: */*' \
  --data 'test' "$BASE$ROUTE/$SESSION/up")"
case "$CODE" in
  200|204|206)
    printf "  %s POST $ROUTE/<session>/up → %s (origin responding)\n" "$(green ✓)" "$CODE"
    PASS=$((PASS+1))
    ;;
  502|503|504)
    printf "  %s POST $ROUTE/<session>/up → %s (origin unreachable but route entered streaming code path)\n" "$(green ✓)" "$CODE"
    PASS=$((PASS+1))
    ;;
  *)
    printf "  %s POST $ROUTE/<session>/up returned unexpected %s\n" "$(red ✗)" "$CODE"
    FAIL=$((FAIL+1))
    ;;
esac

echo
echo "─────────────────────────────────────────"
printf "%s %d passed, %d failed\n" "$( [ $FAIL -eq 0 ] && green ✓ || red ✗ )" "$PASS" "$FAIL"

if [ $FAIL -eq 0 ]; then
  echo
  echo "✅ Healthy. Point your client's host= to:"
  echo "       ${BASE#https://}"
  exit 0
else
  exit 1
fi
