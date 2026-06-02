#!/usr/bin/env bash
# apply-omnicode.sh — Apply OmniCode patches to a fresh T3 Code checkout
# Usage: cd /path/to/t3code && bash /path/to/patches/apply-omnicode.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$SCRIPT_DIR" ]; then
  echo "ERROR: patches directory not found"
  exit 1
fi

echo "=== OmniCode Patch Applicator ==="
echo "Base: T3 Code (commit b3e8c033)"
echo "Format: patch-package (clean unified diffs)"
echo ""

# Verify we're in a T3 Code checkout
if [ ! -f "package.json" ] || ! grep -q "t3tools" package.json 2>/dev/null; then
  echo "WARNING: Not in a T3 Code checkout? (package.json missing t3tools)"
fi

# Collect all numbered patches
PATCH_FILES=$(find "$SCRIPT_DIR" -maxdepth 1 -name '[0-9][0-9][0-9][0-9]-*.patch' | sort)
PATCH_COUNT=$(echo "$PATCH_FILES" | wc -l)

if [ "$PATCH_COUNT" -eq 0 ]; then
  echo "ERROR: No .patch files found"
  exit 1
fi

echo "Found $PATCH_COUNT patches to apply"
echo ""

# Apply each with git apply (handles both new files & modifications)
ok=0 fail=0
for patch_file in $PATCH_FILES; do
  name=$(basename "$patch_file")
  printf "  %s ... " "$name"

  if git apply --index --ignore-whitespace "$patch_file" 2>/dev/null; then
    git commit -m "$(echo "$name" | sed 's/^[0-9]*-//;s/\.patch$//')"
    echo "✓"
    ok=$((ok+1))
  else
    echo "✗"
    fail=$((fail+1))
    echo "    Try: git apply --ignore-whitespace $patch_file"
  fi
done

echo ""
echo "=== $ok applied, $fail failed ==="
echo ""

if [ "$ok" -gt 0 ]; then
  echo "Next steps:"
  echo "  bun install"
  echo "  npx tsgo --noEmit"
fi
