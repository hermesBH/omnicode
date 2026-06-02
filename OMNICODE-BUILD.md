# OmniCode Extensions — Build Plan

## What T3 Code already has (the foundation)
- Multi-provider source control (GitHub, GitLab, Azure DevOps, Bitbucket) via `gh`/`glab` CLI
- SourceControlProviderRegistry with dispatching by remote URL
- Worktree management (create, list, remove, prune)
- VCS driver system (Git, Jujutsu)
- SourceControlProviderShape interface (listChangeRequests, getChangeRequest, createChangeRequest, etc.)
- React SPA with TanStack Router, Tailwind, shadcn/ui
- Settings pages for source control, providers, connections
- Git stacked actions (commit, push, create_pr)

## What OmniCode needs to add

### Phase 1: Plugin System (packages/omnicode-plugin)
- OmniCodePlugin base class with hooks
- Plugin manifest format
- Plugin discovery and loading
- Plugin contributions (UI, agents, providers)

### Phase 2: GitHub Enhancement (packages/omnicode-github)
- Octokit-based GitHub provider alongside gh CLI
- Issue search, get, create
- Repository search and get
- PR file listing and review fetching

### Phase 3: AI Agent System (packages/omnicode-ai)
- Agent base class with lifecycle
- Code review agent (analyzes PR diffs)
- Issue triage agent (analyzes issues)
- Agent orchestrator

### Phase 4: Web UI Extensions (apps/web)
- Repo browsing view
- Issue tracking view
- Agent console view
- Plugin management view
- Integration into sidebar navigation
