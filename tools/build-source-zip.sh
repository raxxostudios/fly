#!/bin/bash
# Rebuilds dist/downloads/FLY-study-source.zip from the repository: study
# code, protocols, historical revisions and the figure inputs. Refuses to
# write the archive if an identity marker slips into any included file.
set -euo pipefail
cd "$(dirname "$0")/.."
FILES=(README.md THIRD_PARTY.md data/source-lock.json dist/SOURCE-ALIGNMENT.md dist/METHOD.md dist/research.html dist/data/brain.json dist/data/brain.bin neural scripts dist/data/study-002 licenses history)
GREP=/usr/bin/grep
[ -x "$GREP" ] || { echo "grep missing; refusing to skip the identity check" >&2; exit 2; }
# The marker list is deliberately NOT in this repository: a public script that
# greps for a person's name would publish the name. One pattern per line,
# extended regex, read from FLY_LEAK_DENYLIST or the default path below.
DENYLIST="${FLY_LEAK_DENYLIST:-$HOME/.config/raxxo/leak-denylist.txt}"
[ -s "$DENYLIST" ] || { echo "no denylist at $DENYLIST; refusing to build without the identity check" >&2; exit 2; }
set +e
HITS=$("$GREP" -rilE -f "$DENYLIST" "${FILES[@]}")
STATUS=$?
set -e
# grep exits 1 for no match, >1 for an error: only 1 counts as clean.
if [ "$STATUS" -eq 0 ]; then echo "identity marker found in: $HITS" >&2; exit 1; fi
if [ "$STATUS" -gt 1 ]; then echo "identity scan failed ($STATUS)" >&2; exit 2; fi
mkdir -p dist/downloads
rm -f dist/downloads/FLY-study-source.zip
zip -qr -X dist/downloads/FLY-study-source.zip "${FILES[@]}" -x '*/__pycache__/*' '*.pyc' '*.DS_Store'
unzip -l dist/downloads/FLY-study-source.zip | tail -1
