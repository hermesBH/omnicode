#!/usr/bin/env bash
set -euo pipefail

# OmniCode — Apply patch to T3 Code
# ===================================
# Applies the OmniCode patch on top of a T3 Code checkout.
#
# Usage:
#   git clone https://github.com/pingdotgg/t3code.git
#   cd t3code
#   bash /path/to/omnicode/patches/apply-omnicode.sh
#
# Or specify target directory:
#   bash /path/to/omnicode/patches/apply-omnicode.sh --target /path/to/t3code
#
# The single-patch approach avoids sequential dependency issues.
#
# Verify:
#   bun install
#   bun run typecheck
#   bun run test

usage() {
  echo "Usage: $0 [--target <dir>]"
  echo ""
  echo "  --target <dir>   Path to T3 Code checkout (default: current directory)"
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
  TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
  if [ -n "${TOPLEVEL}" ]; then
    cd "${TOPLEVEL}"
  fi
fi

echo "OmniCode Patch Applicator"
echo "========================="
echo "Target: $(pwd)"
echo ""

# Sanity check
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "ERROR: Not a git repository."
  echo "  Clone T3 Code first:"
  echo "    git clone https://github.com/pingdotgg/t3code.git"
  echo "    cd t3code"
  exit 1
fi

# Check for t3tools
if ! grep -q 't3tools' package.json 2>/dev/null; then
  echo "⚠️  WARNING: package.json doesn't reference t3tools — is this a T3 Code checkout?"
  echo "   Continuing anyway, but the patch may fail."
  echo ""
fi

# Working tree must be clean
if ! git diff-index --quiet HEAD -- 2>/dev/null; then
  echo "ERROR: Working tree is dirty. Please commit or stash changes first."
  exit 1
fi

echo "Applying omnicode.patch..."
echo ""

# Try the combined patch first
COMBINED="${PATCH_DIR}/omnicode.patch"
if [ -f "${COMBINED}" ]; then
  if git apply --check "${COMBINED}" 2>&1; then
    git apply "${COMBINED}" 2>&1
    echo "✓ Combined patch applied successfully!"
  else
    echo "✗ Combined patch failed, trying individual patches..."
    echo ""
    
    # Fall back to individual patches  
    PATCH_OK=0
    PATCH_FAIL=0
    for patch in "${PATCH_DIR}"/000[1-9]-*.patch; do
      if [ -f "$patch" ]; then
        name="$(basename "$patch")"
        if git apply --check "$patch" 2>/dev/null; then
          git apply "$patch" 2>/dev/null && { echo "  ✓  ${name}"; PATCH_OK=$((PATCH_OK+1)); } || { echo "  ✗  ${name}"; PATCH_FAIL=$((PATCH_FAIL+1)); }
        else
          echo "  ✗  ${name} — conflicts"
          PATCH_FAIL=$((PATCH_FAIL+1))
        fi
      fi
    done
    echo ""
    if [ $PATCH_FAIL -gt 0 ]; then
      echo "ERROR: ${PATCH_FAIL} patch(es) failed."
      exit 1
    fi
    echo "✓ All ${PATCH_OK} individual patches applied!"
  fi
else
  # No combined patch, use individual ones
  echo "No combined patch found, using individual patches..."
  PATCH_OK=0
  PATCH_FAIL=0
  for patch in "${PATCH_DIR}"/000[1-9]-*.patch; do
    if [ -f "$patch" ]; then
      name="$(basename "$patch")"
      if git apply --check "$patch" 2>/dev/null; then
        git apply "$patch" 2>/dev/null && { echo "  ✓  ${name}"; PATCH_OK=$((PATCH_OK+1)); } || { echo "  ✗  ${name}"; PATCH_FAIL=$((PATCH_FAIL+1)); }
      else
        echo "  ✗  ${name} — conflicts"
        PATCH_FAIL=$((PATCH_FAIL+1))
      fi
    fi
  done
  echo ""
  if [ $PATCH_FAIL -gt 0 ]; then
    echo "ERROR: ${PATCH_FAIL} patch(es) failed."
    exit 1
  fi
  echo "✓ All ${PATCH_OK} patches applied!"
fi

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
