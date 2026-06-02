# OmniCode — Patch Pack for T3 Code

Extends T3 Code with an integrated GitHub issues sidebar, top-bar toggle button, and right-side diffpanel. Pulls issues live from the GitHub REST API — no server config needed.

## Quick Start

```bash
git clone https://github.com/pingdotgg/t3code.git
cd t3code
bash /path/to/omnicode/patches/apply-omnicode.sh --target .
bun install
bun run dev
```

The apply script uses a **single combined patch** (`omnicode.patch`) — no sequential dependency issues. It also falls back to individual patches (0001–0009) if available.

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
| Infrastructure | `package.json`, `turbo.json`, `tsconfig.base.json` | Workspace config, catalog entries (`@octokit/rest`, etc.), turbo pipeline |
| Contracts | `packages/omnicode-contracts/` | Effect Schema types for repos, issues, agents, extensions |
| Plugin | `packages/omnicode-plugin/` | Extensible plugin system (discovery, registry, hooks) |
| GitHub | `packages/omnicode-github/` | Octokit-based API client (Issues, PRs, Repos, Reviews) |
| AI | `packages/omnicode-ai/` | Agent framework + CodeReviewAgent, IssueTriageAgent |
| Server | `packages/core/`, `apps/server/` | OmniCode service layer + REST router + server DI wiring |
| Web UI | `apps/web/src/components/IssuesSidebar.tsx`, `BranchToolbar.tsx`, `ChatView.tsx`, `ChatHeader.tsx`, routes | Right-side issues panel + top-bar toggle |
| Docs | `SPEC.md`, `README.md` | Architecture specification |

## Requirements

- T3 Code checkout at https://github.com/pingdotgg/t3code.git
- Bun package manager
- The patch works on macOS and Linux
- For private repos: set `GITHUB_TOKEN` env var

## How the Issues Sidebar Works

```
1. User opens a project in T3 Code
2. Click the ◉ button in the top bar (BranchToolbar)
3. Right sidebar opens (same pattern as DiffPanel)
4. Repo detection:
   → Tries OmniCode server API (/api/omnicode/projects/detect-remote) for full owner/repo
   → Falls back to project folder name
5. Fetches issues from api.github.com (public repos only, 60 req/hr rate limit)
6. Issues render as clickable cards → click opens GitHub issue
```

## Troubleshooting

**`ERR_MODULE_NOT_FOUND: Cannot find package '@t3tools/core'`**
→ Run `bun install` again. The patch adds workspace packages that need to be linked.

**`bun install` fails with dependency resolution errors**
→ Make sure you're running a recent Bun version (`bun --version` ≥ 1.1). The patch adds `@octokit/rest` to the dependency catalog.

**Patches won't apply (conflicts)**
→ Use the combined `omnicode.patch` instead of individual patches. Make sure the working tree is clean before applying.

## No Behavior Changed

All original T3 Code functionality is preserved. The patches only ADD new features:
- A new button appears in the toolbar (does nothing until clicked)
- A new sidebar exists (only shown when button is clicked)
- New packages exist (only loaded when used)

Nothing in T3 Code's core chat, diff panel, terminal, or git integration is modified.
