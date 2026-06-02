# OmniCode — Patch Pack for T3 Code

A universal code workspace extension for [T3 Code](https://github.com/pingdotgg/t3code) that adds integrated GitHub/GitLab browsing, AI agents for issues/PRs/code review, and a plugin/extension system.

## What is This?

This is a **pack of 8 clean patches** that apply directly to the upstream T3 Code repository (commit `b3e8c033`). They add OmniCode without forking — you apply them to your own T3 Code checkout and get:

- **GitHub Browser** — search repos, browse issues, view PRs
- **AI Agents** — code review agents that read PR diffs, issue triage agents that suggest labels
- **Plugin System** — third-party extensions with hooks, manifest-declared contributions
- **Multi-Git Support** — provider abstraction for GitHub, GitLab, etc.
- **REST API** — 6 Effect-wired endpoints for status, plugins, agents, repos, issues

## Quick Start

```bash
# Clone T3 Code
git clone https://github.com/pingdotgg/t3code.git
cd t3code
git checkout b3e8c033  # base commit

# Apply OmniCode patches
bash /path/to/patches/apply-omni-code.sh
# or manually:
git am patches/*.patch

# Install and verify
bun install
npx tsgo check packages/omnicode-contracts/src/
```

## Patch Series

| # | Patch | Size | What it adds |
|---|-------|------|-------------|
| 1 | Infrastructure | 6.6 KB | Workspace config, package.json, tsconfig |
| 2 | Contracts | 20 KB | Effect Schema types (providers, repos, issues, agents, extensions) |
| 3 | Plugin | 32 KB | Plugin interface, manifest, hooks, discovery, registry |
| 4 | GitHub | 40 KB | Octokit wrappers: IssuesService, PRsService, ReposService, ReviewsService |
| 5 | AI | 32 KB | Agent base class, AgentRegistry, CodeReviewAgent, IssueTriageAgent |
| 6 | Server | 33 KB | Effect service layer, OmniCodeRouter (6 endpoints) |
| 7 | Web UI | 67 KB | 5 route pages, sidebar nav, icon, animations |
| 8 | Docs | 58 KB | SPEC.md architecture, README updates |

## New Packages

Applied patches create these packages under the `@omnicode/*` namespace:

```
packages/omnicode-contracts/  — Effect Schema type definitions
packages/omnicode-plugin/     — Plugin system (discovery, registry, hooks)
packages/omnicode-github/     — Octokit-based GitHub API
packages/omnicode-ai/         — AI agent framework
packages/core/src/omnicode/   — Server layer + REST router
apps/web/src/                 — UI routes, components, styles
```

## Design Philosophy

Follows T3 Code's architecture:
- **Effect-first** — all services are Effect Context.Layers with Schema validation
- **Minimal deps** — octokit for GitHub, effect for the rest
- **Plugin isolation** — plugins get per-session instances, no global state
- **Extensible** — new providers (GitLab, Gitea) implement the same service interface

## Applying to Upstream Updates

When T3 Code updates, rebase the patches:

```bash
git remote add upstream https://github.com/pingdotgg/t3code.git
git fetch upstream
git rebase --onto upstream/main b3e8c033 omnicode-patches
# Resolve conflicts if any, then regenerate:
git format-patch upstream/main..omnicode-patches -o patches/
```

## File Structure

```
patches/
├── 0001-*.patch   → Workspace infrastructure
├── 0002-*.patch   → Effect Schema contracts
├── 0003-*.patch   → Plugin system
├── 0004-*.patch   → GitHub Octokit client
├── 0005-*.patch   → AI agent framework
├── 0006-*.patch   → Server layer + REST API
├── 0007-*.patch   → Web UI routes & components
├── 0008-*.patch   → Documentation
├── README.md      ← this file
├── apply-omnicode.sh  → automatic apply script
└── gen-patches.sh     → patch regeneration script
```
