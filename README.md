# OmniCode

A **patch pack** that extends [T3 Code](https://github.com/pingdotgg/t3code) with:

- **GitHub browser** — search repos, browse issues, review PRs
- **AI agents** — code review, issue triage, extensible agent framework
- **Plugin system** — third-party extensions with hooks and manifest contributions
- **Multi-git support** — provider abstraction for GitHub, GitLab, etc.
- **REST API** — 6 Effect-wired endpoints

## Usage

```bash
git clone https://github.com/pingdotgg/t3code.git
cd t3code
git checkout b3e8c033

# Apply OmniCode patches
git clone https://github.com/blckhndr/omnicode.git
bash omnicode/apply-omnicode.sh
# → applies all 8 patches, creates @omnicode/* packages
```

## Patches

| # | Patch | Purpose |
|---|-------|---------|
| 1 | Infrastructure | Workspace config, package.jsons, tsconfigs |
| 2 | Contracts | Effect Schema types for providers, repos, issues, agents |
| 3 | Plugin | Plugin interface, manifest, hooks, discovery, registry |
| 4 | GitHub | Octokit wrappers: IssuesService, PRsService, ReposService |
| 5 | AI | Agent base class, AgentRegistry, CodeReviewAgent |
| 6 | Server | Effect service layer, 6 REST API endpoints |
| 7 | Web UI | 5 TanStack Router pages, sidebar nav, animations |
| 8 | Docs | SPEC.md architecture, README |

## Architecture

All patches follow T3 Code's existing patterns:

- **Effect-first** — all services are `Context.Layer` with Schema validation
- **No global state** — plugin instances are per-session, injected via DI
- **Minimal dependencies** — only `octokit` as a new runtime dep
- **@omnicode/* namespace** — no conflict with existing T3 Code packages

## Directory Structure After Patching

```
packages/omnicode-contracts/  → Effect Schema type definitions
packages/omnicode-plugin/     → Plugin system (discovery, registry, hooks)
packages/omnicode-github/     → Octokit wrappers for GitHub API
packages/omnicode-ai/         → AI agent framework
packages/core/src/omnicode/   → Server service layer + REST router
apps/web/src/                 → UI routes, components, styles
```

## Requirements

- T3 Code at commit `b3e8c033` (for patch compatibility)
- Git 2.30+
- bun 1.2+
