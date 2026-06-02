# OmniCode — Patch for T3 Code

Extends T3 Code with an integrated GitHub issues sidebar, top-bar toggle button, and right-side diffpanel. Pulls issues live from the GitHub REST API — no server config needed.

## Quick Start

```bash
git clone https://github.com/pingdotgg/t3code.git
cd t3code
bash /path/to/omnicode/patches/apply-omnicode.sh --target .
bun install
bun run dev
```

## What You Get

- **Top-bar issues toggle** — ◉ button in the BranchToolbar and ChatHeader
- **Right-side issues panel** — matches the DiffPanel pattern: resizable sidebar, DiffPanelShell layout
- **Live GitHub issues** — auto-detects the repo from the project cwd, fetches directly from `api.github.com` (CORS-enabled, no auth needed for public repos)
- **Full filter/search** — filter by state (open/closed/all), type (bug/feature/all), text search
- **Clickable issue cards** — opens GitHub issue in a new tab
- **Loading/error/empty states** — skeleton loading, error message with retry, "all clear!" empty state

## What's in the Patch

| Area | Files | Description |
|------|-------|-------------|
| Infrastructure | `package.json`, `turbo.json` | Workspace config, catalog entries (`@octokit/rest`, etc.) |
| Contracts | `packages/omnicode-contracts/` | Effect Schema types for repos, issues, agents, extensions |
| Plugin | `packages/omnicode-plugin/` | Extensible plugin system (discovery, registry, hooks) |
| GitHub | `packages/omnicode-github/` | Octokit-based API client (Issues, PRs, Repos, Reviews) |
| AI | `packages/omnicode-ai/` | Agent framework + CodeReviewAgent, IssueTriageAgent |
| Server | `apps/server/src/omnicode/`, `apps/server/src/server.ts` | OmniCode service layer + REST router + server DI wiring |
| Web UI | `apps/web/src/components/IssuesSidebar.tsx`, `BranchToolbar.tsx`, `ChatView.tsx`, `ChatHeader.tsx`, routes | Right-side issues panel + top-bar toggle |
| Docs | `SPEC.md`, `README.md` | Architecture specification |

## Troubleshooting

**`ERR_MODULE_NOT_FOUND` for `effect` or other packages**
→ Run `bun install`. If that fails, delete `node_modules` and `bun.lock` and run `bun install` again.

**`bun install` fails**
→ Make sure Bun ≥ 1.1 is installed. The patch adds `@octokit/rest` to the dependency catalog.

**Patches won't apply**
→ Reset the working tree: `git checkout -- . && git clean -fd`. Then re-apply.

## No Behavior Changed

All original T3 Code functionality is preserved. The patches only ADD new features:
- A new button appears in the toolbar (does nothing until clicked)
- A new sidebar exists (only shown when button is clicked)
- New packages exist (only loaded when used)

Nothing in T3 Code's core chat, diff panel, terminal, or git integration is modified.
