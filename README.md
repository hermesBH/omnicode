# OmniCode

A **patch set** that turns [T3 Code](https://github.com/pingdotgg/t3code) into a universal code workspace with integrated GitHub/GitLab browsing, AI agents, and a plugin system.

## Quick Start

```bash
# Clone T3 Code at the base commit
git clone https://github.com/pingdotgg/t3code.git
cd t3code
git checkout b3e8c033

# Apply OmniCode patches
git clone https://github.com/blckhndr/omnicode.git
bash omnicode/apply-omnicode.sh

# Install & verify
bun install
npx tsgo --noEmit
```

## What You Get

- **GitHub browser** — search repos, browse issues, review PRs
- **AI agents** — code review, issue triage, extensible framework
- **Plugin system** — third-party extensions with hooks and manifests
- **Multi-git support** — GitHub, GitLab, etc. through a common abstraction
- **VCS integration** — auto-detect remotes, create worktrees from issues

## Patches (15 total)

| # | Area | What it adds |
|---|------|-------------|
| 1 | Workspace | Package config, tsconfig for `@omnicode/*` packages |
| 2 | Contracts | Effect Schema types for repos, issues, agents, plugins |
| 3 | Plugin | Plugin interface, manifest, hooks, registry |
| 4 | GitHub | Octokit wrappers — Issues, PRs, Repos, Reviews |
| 5 | AI | CodeReviewAgent, IssueTriageAgent, AgentRegistry |
| 6 | Server | Effect service layer, REST endpoints |
| 7 | Web UI | Route pages, sidebar nav, animations |
| 8 | Docs | SPEC.md architecture doc |
| 9–15 | VCS | Worktree creation, remote detection, issue UI, chat integration |

## Structure

```
packages/
├── omnicode-contracts/   → Schema types
├── omnicode-plugin/      → Plugin system
├── omnicode-github/      → GitHub API client
├── omnicode-ai/          → AI agents
apps/server/src/omnicode/ → Server + REST router
apps/web/src/             → UI routes
patches/                  → All 15 patch files
apply-omnicode.sh         → Apply script
```

## Requirements

- T3 Code at `b3e8c033`
- Git 2.30+
- bun 1.2+

See [`patches/README.md`](patches/README.md) for patch details.
