# OmniCode — Patch Pack for T3 Code

Extends T3 Code with an integrated GitHub issues sidebar, top-bar toggle button, and right-side diffpanel. Pulls issues live from the GitHub REST API — no server config needed.

## Quick Start

```bash
git clone https://github.com/pingdotgg/t3code.git
cd t3code
git checkout b3e8c033
bash /path/to/omnicode/patches/apply-omnicode.sh
bun install
```

## What You Get

- **Top-bar issues toggle** — ◉ button in the BranchToolbar and ChatHeader
- **Right-side issues panel** — matches the DiffPanel pattern: resizable sidebar, DiffPanelShell layout
- **Live GitHub issues** — auto-detects the repo from the project cwd, fetches directly from `api.github.com` (CORS-enabled, no auth needed for public repos)
- **Full filter/search** — filter by state (open/closed/all), type (bug/feature/all), text search
- **Clickable issue cards** — opens GitHub issue in a new tab
- **Loading/error/empty states** — skeleton loading, error message with retry, "all clear!" empty state

## Patch Series (9 patches)

| # | What | Size |
|---|------|------|
| 1 | Infrastructure: workspace config, package.json, tsconfig | 289 lines |
| 2 | Contracts: @omnicode/contracts Effect Schema types | 442 lines |
| 3 | Plugin: extensible plugin system (discovery, registry, hooks) | 1,012 lines |
| 4 | GitHub: Octokit-based API client (Issues, PRs, Repos, Reviews) | 1,131 lines |
| 5 | AI: agent framework + CodeReviewAgent, IssueTriageAgent | 1,087 lines |
| 6 | Server: OmniCode service layer + REST router + VCS integration | 1,713 lines |
| 7 | Web UI: IssuesSidebar, BranchToolbar toggle, ChatHeader toggle | 1,844 lines |
| 8 | Docs: SPEC.md architecture, updated README | 1,209 lines |
| 9 | Apply script + this README | 186 lines |

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

## Files Changed

**New files:**
- `packages/omnicode-contracts/` — Effect Schema type definitions
- `packages/omnicode-plugin/` — Plugin system
- `packages/omnicode-github/` — Octokit-based GitHub API
- `packages/omnicode-ai/` — AI agent framework  
- `packages/core/src/omnicode/` — Server layer + REST router
- `apps/web/src/components/IssuesSidebar.tsx` — Right-side issues panel
- `apps/web/src/issuesRouteSearch.ts` — Issues URL search param
- `apps/web/src/lib/omniCodeIssueStore.ts` — Global issue store
- `apps/web/src/lib/omnicodeProjectDetector.ts` — Project/repo detection hooks
- `SPEC.md` — Full architecture specification

**Modified files:**
- `apps/web/src/components/BranchToolbar.tsx` — Adds ◉ issues toggle button
- `apps/web/src/components/ChatView.tsx` — Passes issues props to BranchToolbar
- `apps/web/src/components/chat/ChatHeader.tsx` — Adds ◉ issues toggle
- `apps/web/src/routes/_chat.$environmentId.$threadId.tsx` — IssuesInlineSidebar + cwd derivation
- `apps/web/src/routes/__root.tsx` — Auto-issue detection hook
- `apps/server/src/server.ts` — OmniCode services wired into DI graph
- `package.json` / `turbo.json` / `tsconfig.base.json` — Workspace config
- `README.md` — Updated project readme

## No Behavior Changed

All original T3 Code functionality is preserved. The patches only ADD new features:
- A new button appears in the toolbar (does nothing until clicked)
- A new sidebar exists (only shown when button is clicked)
- New packages exist (only loaded when used)

Nothing in T3 Code's core chat, diff panel, terminal, or git integration is modified.
