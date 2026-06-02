#!/usr/bin/env bash
set -euo pipefail

# OmniCode — Apply patches to T3 Code
# =====================================
# Applies the 9 OmniCode patches on top of a T3 Code checkout.
# Patches must be applied in order (0001 → 0009).
#
# Usage:
#   git clone https://github.com/pingdotgg/t3code.git
#   cd t3code
#   bash /path/to/omnicode/patches/apply-omnicode.sh
#
# Or specify target directory:
#   bash /path/to/omnicode/patches/apply-omnicode.sh --target /path/to/t3code
#
# Verify:
#   bun install
#   bun run typecheck
#   bun run test

usage() {
  echo "Usage: $0 [--target <dir>]"
  echo ""
  echo "  --target <dir>   Path to T3 Code checkout (default: current directory)"
  echo ""
  echo "The target must be a git checkout of https://github.com/pingdotgg/t3code.git"
  exit 1
}

TARGET_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET_DIR="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_DIR="${SCRIPT_DIR}"

if [ -n "${TARGET_DIR}" ]; then
  if [ ! -d "${TARGET_DIR}" ]; then
    echo "ERROR: Target directory does not exist: ${TARGET_DIR}"
    exit 1
  fi
  cd "${TARGET_DIR}"
else
  cd "$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
  if [ -z "$(pwd 2>/dev/null)" ] || [ ! -f "package.json" ]; then
    echo "ERROR: Not in a T3 Code checkout. Either:"
    echo "  1. cd into a T3 Code checkout and re-run this script, or"
    echo "  2. Use --target /path/to/t3code"
    echo ""
    echo "To clone T3 Code:"
    echo "  git clone https://github.com/pingdotgg/t3code.git"
    echo "  cd t3code"
    exit 1
  fi
fi

# Quick sanity: check for t3tools in package.json
if ! grep -q '"t3tools"' package.json 2>/dev/null && ! grep -q 't3tools' package.json 2>/dev/null; then
  echo "⚠️  WARNING: package.json doesn't reference t3tools — is this a T3 Code checkout?"
  echo "   Continuing anyway, but patches may fail."
  echo ""
fi

echo "OmniCode Patch Applicator"
echo "========================="
echo "Base: T3 Code (commit b3e8c033 or later)"
echo "Target: $(pwd)"
echo ""

EXPECTED_BASE="b3e8c033"
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Try to find b3e8c033 in history
if ! git cat-file -e "${EXPECTED_BASE}^{commit}" 2>/dev/null; then
  echo "⚠️  Commit ${EXPECTED_BASE} not found in this repo's history."
  echo "   The repo may have been shallow-cloned. Try:"
  echo "     git fetch --unshallow origin"
  echo "   Or pull the latest:"
  echo "     git pull origin main"
  echo "   Continuing anyway — patches may still apply if the file structure matches."
  echo ""
else
  echo "✓ Found base commit ${EXPECTED_BASE} in repo history"
  echo ""
fi

PATCH_COUNT=0
FAIL_COUNT=0
declare -a FAILED_PATCHES=()

apply_patch() {
  local patch_file="$1"
  local name="$(basename "$patch_file")"
  
  # Check first
  local check_out
  check_out=$(git apply --check "$patch_file" 2>&1) || true
  local check_rc=$?
  
  if [ $check_rc -eq 0 ]; then
    # Apply
    local apply_out
    apply_out=$(git apply "$patch_file" 2>&1) || true
    local apply_rc=$?
    if [ $apply_rc -eq 0 ]; then
      echo "  ✓  ${name}"
      PATCH_COUNT=$((PATCH_COUNT + 1))
      return 0
    else
      echo "  ✗  ${name} — apply failed"
      echo "     ${apply_out}"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      FAILED_PATCHES+=("$name")
      return 1
    fi
  else
    echo "  ✗  ${name} — conflicts detected"
    echo "     ${check_out}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_PATCHES+=("$name")
    return 1
  fi
}

echo "Applying patches..."
echo ""

for patch in "${PATCH_DIR}"/000[1-9]-*.patch; do
  if [ -f "$patch" ]; then
    apply_patch "$patch" || true
  fi
done

echo ""
echo "========================================"
echo "Results: ${PATCH_COUNT} applied, ${FAIL_COUNT} failed"

if [ $FAIL_COUNT -gt 0 ]; then
  echo ""
  echo "Failed patches:"
  for p in "${FAILED_PATCHES[@]}"; do
    echo "  - $p"
  done
  echo ""
  echo "Troubleshooting:"
  echo "  1. Ensure you're in a T3 Code checkout (not the omnicode repo)"
  echo "  2. Run: git status (working tree must be clean)"
  echo "  3. Try: git apply --reject <patch-file>  # partial apply with .rej files"
  echo "  4. Try: git am --3way <patch-file>       # three-way merge"
  echo ""
  echo "If on macOS and seeing 'already exists' errors, the target may"
  echo "already have OmniCode files. Start from a fresh T3 Code clone."
  exit 1
fi

echo ""
echo "✓ All patches applied successfully!"
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
