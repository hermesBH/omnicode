#!/usr/bin/env bash
# apply-omnicode.sh — Apply OmniCode patches to a fresh T3 Code checkout
# Usage: cd /path/to/t3code && bash /path/to/apply-omnicode.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_DIR="$SCRIPT_DIR/patches"

if [ ! -d "$PATCH_DIR" ]; then
  echo "ERROR: patches/ directory not found next to this script"
  echo "Expected at: $PATCH_DIR"
  exit 1
fi

echo "=== OmniCode Patch Applicator ==="
echo "Base: T3 Code (upstream commit b3e8c033)"
echo ""

# Verify we're in a T3 Code checkout
if [ ! -f "package.json" ] || ! grep -q "t3tools" package.json 2>/dev/null; then
  echo "WARNING: Not in a T3 Code checkout? (package.json missing t3tools)"
  echo "Continuing anyway..."
fi

# Count patches
PATCH_COUNT=$(ls "$PATCH_DIR"/[0-9][0-9][0-9][0-9]-*.patch 2>/dev/null | wc -l)
if [ "$PATCH_COUNT" -eq 0 ]; then
  echo "ERROR: No .patch files found in $PATCH_DIR"
  exit 1
fi

echo "Found $PATCH_COUNT patches to apply"
echo ""

# Apply patches in order
for patch_file in "$PATCH_DIR"/[0-9][0-9][0-9][0-9]-*.patch; do
  name=$(basename "$patch_file")
  echo "  Applying $name ..."
  
  if git am "$patch_file" 2>/dev/null; then
    echo "    ✓"
  else
    echo "    ⚠ git am failed, trying git apply..."
    # Fallback to git apply (doesn't create commits)
    if git apply --index "$patch_file" 2>/dev/null; then
      git commit -m "$(head -5 "$patch_file" | grep "^Subject:" | sed 's/Subject: \[PATCH[^]]*\] //')"
      echo "    ✓ (via git apply)"
    else
      echo "    ✗ FAILED on $name"
      echo "    Try applying manually: git apply $patch_file"
      exit 1
    fi
  fi
done

echo ""
echo "=== All $PATCH_COUNT patches applied successfully ==="
echo ""
echo "Next steps:"
echo "  bun install"
echo "  npx tsgo check packages/omnicode-contracts/src/"
echo "  npx tsgo check packages/omnicode-plugin/src/"
echo "  npx tsgo check packages/omnicode-ai/src/"
echo "  npx tsgo check packages/omnicode-github/src/"
echo "  npx tsgo check packages/core/src/omnicode/"
echo ""
echo "See patches/README.md for details."
