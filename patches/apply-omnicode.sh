#!/usr/bin/env bash
set -euo pipefail

# OmniCode — Apply patches to T3 Code
# =====================================
# Applies the 9 OmniCode patches on top of T3 Code at commit b3e8c033.
# Patches must be applied in order (0001 → 0009).
#
# Usage:
#   git clone https://github.com/pingdotgg/t3code.git
#   cd t3code
#   git checkout b3e8c033
#   bash /path/to/omnicode/patches/apply-omnicode.sh
#
# Verify:
#   bun install
#   npx tsgo --noEmit   # typecheck
#   bun run test          # run tests

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_DIR="${SCRIPT_DIR}"

echo "OmniCode patch apply — $(date)"
echo "Applying patches from: ${PATCH_DIR}"
echo ""

cd "$(git rev-parse --show-toplevel)"

# Verify we're on the correct base
EXPECTED_BASE="b3e8c033"
CURRENT_COMMIT=$(git rev-parse --short HEAD)
if [ "${CURRENT_COMMIT}" != "${EXPECTED_BASE}" ]; then
  echo "⚠️  WARNING: Expected base commit ${EXPECTED_BASE} but HEAD is ${CURRENT_COMMIT}"
  echo "   Continuing anyway, but patches might not apply cleanly."
  echo ""
fi

PATCH_COUNT=0
FAIL_COUNT=0

apply_patch() {
  local patch_file="$1"
  local name="$(basename "$patch_file")"
  echo -n "  ${name}... "

  if git apply --check "$patch_file" 2>/dev/null; then
    if git apply "$patch_file" 2>/dev/null; then
      echo "✓"
      PATCH_COUNT=$((PATCH_COUNT + 1))
    else
      echo "✗ (apply failed)"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    echo "✗ (check failed — conflicts)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo "Applying patches..."
for patch in "${PATCH_DIR}"/000[1-9]-*.patch; do
  if [ -f "$patch" ]; then
    apply_patch "$patch"
  fi
done

echo ""
echo "========================================"
echo "Results: ${PATCH_COUNT} patches applied"
if [ $FAIL_COUNT -gt 0 ]; then
  echo "         ${FAIL_COUNT} patches FAILED"
  echo ""
  echo "If patches failed, try:"
  echo "  git apply --reject <failed-patch>  # partial apply"
  echo "  git am --3way <failed-patch>       # three-way merge"
  exit 1
fi

echo ""
echo "All patches applied successfully!"
echo ""
echo "Next steps:"
echo "  1. bun install"
echo "  2. bun run typecheck"
echo "  3. bun run test"
echo "  4. Set GITHUB_TOKEN env var (optional, for authenticated API access)"
echo "  5. bun run dev"
echo ""
echo "Then open T3 Code, open a project, and click the ◉ Issues button"
echo "in the top bar to open the issues sidebar."
