#!/bin/bash
# Compares every file in dist/ with what a live URL serves. Prints mismatches
# and a summary line; exits non-zero on any mismatch or error status.
set -uo pipefail
BASE=${1:-https://fly-navy.vercel.app}
cd "$(dirname "$0")/../dist"
TMP=$(mktemp)
ok=0; bad=0
while IFS= read -r f; do
  f=${f#./}
  code=$(curl -s -A "Mozilla/5.0 (Macintosh) FLY-verify" -o "$TMP" -w '%{http_code}' "$BASE/$f")
  if [ "$code" = "200" ] && cmp -s "$TMP" "$f"; then ok=$((ok+1)); else bad=$((bad+1)); echo "MISMATCH $code $f"; fi
done < <(find . -type f ! -name '.DS_Store' | sort)
rm -f "$TMP"
echo "live=$BASE identical=$ok mismatched=$bad"
[ "$bad" -eq 0 ]
