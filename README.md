<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/omnicode-dark.svg">
    <img alt="OmniCode" src="./assets/omnicode-light.svg" width="400">
  </picture>
</p>

<p align="center">
  <strong>OmniCode</strong> — The Universal Code Workspace
</p>

<p align="center">
  Forked from <a href="https://github.com/pingdotgg/t3code">T3 Code</a> · Extending its philosophy of AI-native development into a universal multi-provider, multi-agent coding platform
</p>

---

## Vision

OmniCode reimagines software development the way VSCode did for editors — as an extensible, open platform. Where T3 Code pioneered AI-native coding in the terminal, OmniCode extends that vision outward:

- **Unified Git Provider Layer** — One interface for GitHub, GitLab, Azure DevOps, Bitbucket, and any Git hosting
- **Integrated Issue & PR Management** — Browse repos, search issues, review PRs without leaving your terminal
- **AI Agent Ecosystem** — Automated code reviews, issue triage, PR creation, and more via pluggable agents
- **Third-Party Extensions** — A plugin system (like CodeRabbit, CodeCov, etc.) to add custom behaviors and UIs
- **Multiple Worktrees** — Native git worktree management (inherited from T3 Code)
- **Open Library** — All contracts, interfaces, and services are public and extensible

## Architecture

OmniCode extends T3 Code with these layered additions:

```
┌──────────────────────────────────────────────────┐
│                  Web UI (React/Vite)              │
│  ├── Chat (T3)  │  Repos  │  Issues  │  Agents   │
│  ├── Extensions │  Plugins │  Settings            │
├──────────────────────────────────────────────────┤
│             Server (Node.js/WebSocket)            │
│  ├── AI Agent Orchestrator                        │
│  ├── Plugin Loader & Registry                     │
│  ├── Octokit API Service (enhanced GitHub)        │
│  ├── SourceControlProvider Registry (T3)          │
│  │   ├── GitHub    ├── GitLab                     │
│  │   ├── AzureDevOps ├── Bitbucket                │
│  └── VCS Drivers (Git, Jujutsu)                   │
├──────────────────────────────────────────────────┤
│             Shared Packages                       │
│  ├── @omnicode/contracts  (schemas, types)        │
│  ├── @omnicode/plugin     (extension API)         │
│  ├── @omnicode/github     (Octokit layer)         │
│  └── @omnicode/ai         (agent framework)       │
└──────────────────────────────────────────────────┘
```

---

## REST API

OmniCode exposes a set of REST API endpoints via the T3 Code server. All endpoints are prefixed with `/api/omnicode/`:

| Method | Endpoint | Description | Requires |
|--------|----------|-------------|----------|
| `GET` | `/api/omnicode/status` | Health & status check | PluginRegistry + AgentRegistry |
| `GET` | `/api/omnicode/plugins` | List registered plugins | PluginRegistry |
| `GET` | `/api/omnicode/agents` | List registered AI agents | AgentRegistry |
| `POST` | `/api/omnicode/agents/execute` | Execute an AI agent | AgentRegistry |
| `GET` | `/api/omnicode/repos/search` | Search GitHub repos | ReposService |
| `GET` | `/api/omnicode/issues` | List issues for a repo | IssuesService |

### Example Requests

```bash
# Check OmniCode status
curl http://localhost:8080/api/omnicode/status

# Search repositories
curl "http://localhost:8080/api/omnicode/repos/search?query=effect+ts&sort=stars"

# List issues
curl "http://localhost:8080/api/omnicode/issues?owner=blckhndr&repo=omnicode&state=open"

# Execute an agent
curl -X POST http://localhost:8080/api/omnicode/agents/execute \
  -H "Content-Type: application/json" \
  -d '{"agentKind":"code-review","task":"Review PR #42","context":{"prNumber":42}}'
```

---

## Packages

### `@omnicode/contracts` — Shared TypeScript Contract Schemas

Defines all the Effect Schema contracts for OmniCode:

| Schema | Description |
|--------|-------------|
| `AiProviderKind` | LLM providers: openai, anthropic, google, azure, ollama, custom |
| `AiProviderConfig` | LLM provider configuration (endpoint, apiKey, model) |
| `OmnicodeConfig` | Global settings (reposDir, editor, theme, ai provider, log level) |
| `ExtensionPoint` | Where plugins can attach: sidebar, top, settings, dropdown |
| `ProviderType` | Git host: github, gitlab, bitbucket, gitea, custom |
| `AuthMethod` | Auth: token, oauth, basic, none |
| `PluginContribution` | Plugin contribution types: agents, routes, providers, paints |
| `PaintPosition` | Paint hook position: before, after, replace, append, prepend |
| `ExtensionSchema` | Full extension validation schema |
| `RepositoryView` | Repo metadata shape |
| `RepoSearchSort` | Search sort: stars, forks, updated, help-wanted-issues |
| `RepoSearchQuery` | Search parameters |
| `RepoSearchResult` | Search result with items, totalCount, incompleteResults |
| `IssueState` | Issue state: open, closed, all |
| `IssueSort` | Issue sort: created, updated, comments |
| `IssueListQuery` | Issue list query parameters |
| `IssueCreateInput` | New issue shape |
| `IssueView` | Issue presentation shape |
| `AgentKind` | Agent types: code-review, issue-triage, pr-analysis, auto-fix, custom |
| `AgentExecutionRequest` | Agent execution input |
| `AgentExecutionResult` | Agent execution output |

### `@omnicode/plugin` — Plugin/Extension System

The plugin system is the heart of OmniCode's extensibility:

```typescript
export interface OmniCodePlugin {
  manifest: PluginManifest;
  contributes?: PluginContributions;
  hooks?: PluginHooks;
}
```

**Plugin discovery** — Scan directories for plugin manifests, load and validate.

**Plugin registry** — Lifecycle management: register → activate → deactivate → unregister.

**Hook system** — Priority-ordered hooks with `before`, `after`, `replace` paint points.

**Isolation** — Each plugin gets its own directory and manifest. Server creates per-session instances.

### `@omnicode/github` — Octokit API Client

Octokit-powered GitHub integration with typed Effect services:

- **GitHubClient** — Authenticated Octokit wrapper with token/basic auth
- **ReposService** — Search repos, get repo details
- **IssuesService** — List, create, update, search issues
- **PullRequestsService** — List PRs, get PR diff, create PR, merge PR
- **ReviewsService** — Create review, list reviews, submit review, post review comments

All services are Effect Context.Services for clean DI with T3 Code's server layer.

### `@omnicode/ai` — AI Agent Framework

Lightweight pluggable agent system:

- **`Agent<TInput, TOutput>`** — Base class: `name`, `description`, `version`, `run(input)`
- **`AgentRegistry`** — Register, dispatch, and manage agents by type
- **`CodeReviewAgent`** — Analyzes PR diffs using LLM, posts inline review comments
- **`IssueTriageAgent`** — Reads new issues, suggests labels, assignees, and milestones
- **`RegistryError`** — Typed error class for registry operations

---

## Key Concepts

### Provider Paradise

Every source control provider speaks the same language. The `SourceControlProviderShape` interface unifies:

| Operation | GitHub | GitLab | Azure DevOps | Bitbucket |
|-----------|--------|--------|-------------|-----------|
| List PRs/MRs | ✅ | ✅ | ✅ | ✅ |
| Get PR/MR | ✅ | ✅ | ✅ | ✅ |
| Create PR/MR | ✅ | ✅ | ✅ | ✅ |
| List Issues | ✅ | Planned | Planned | Planned |
| Search Repos | ✅ | Planned | Planned | Planned |
| Code Review | ✅ | Planned | Planned | Planned |

### Effect Service Layer

The server-side integration uses T3 Code's Effect-based DI pattern:

```typescript
// Create an OmniCode layer with your config
const omniCodeLayer = makeOmniCodeServerLayer({
  enabled: true,
  githubToken: process.env.GITHUB_TOKEN,
  pluginDirs: ["./plugins"],
});

// Compose with T3 Code's existing runtime
const RuntimeServicesLive = ServerRuntimeStartupLive.pipe(
  Layer.provideMerge(RuntimeDependenciesLive),
  Layer.provideMerge(omniCodeLayer),
);
```

### Plugin Isolation

The server creates fresh `DefaultPluginRegistry` instances per-session to ensure complete isolation between plugin consumers. The legacy module-level singleton (`getDefaultRegistry()`) is maintained for backward compatibility but the Effect service layer uses instance-level isolation.

---

## Extending OmniCode

### Writing a Plugin

```typescript
import { OmniCodePlugin, type PluginManifest } from "@omnicode/plugin";

export const manifest: PluginManifest = {
  id: "my-plugin",
  name: "My Plugin",
  version: "0.1.0",
  description: "My custom OmniCode plugin",
};

export default {
  manifest,

  // Register custom AI agents
  contributes: {
    agents: [
      {
        type: "custom",
        name: "My Custom Agent",
        description: "Does something amazing",
        handler: async (input) => { /* ... */ },
      },
    ],
    // Add custom UI routes
    routes: [{ path: "/my-plugin", component: "MyComponent" }],
    // Hook into events
    hooks: {
      "pr:created": async (pr) => { /* ... */ },
    },
  },
} satisfies OmniCodePlugin;
```

### Writing a Custom Agent

```typescript
import { Agent, type AgentResult } from "@omnicode/ai";

interface MyInput { file: string }
interface MyOutput { suggestions: string[] }

export class LintFixAgent extends Agent<MyInput, MyOutput> {
  constructor() {
    super({
      type: "custom",
      name: "Lint Fix Agent",
      description: "Automatically fixes lint errors",
      version: "1.0.0",
      capabilities: ["lint", "auto-fix"],
    });
  }

  async run(input: MyInput): Promise<AgentResult<MyOutput>> {
    // Your logic here
    return { success: true, output: { suggestions: [] } };
  }
}

// Register with the agent registry
agentRegistry.register(new LintFixAgent());
```

---

## Project Structure

| Directory | Description |
|-----------|-------------|
| `apps/web` | React/Vite web UI (inherited from T3 Code) |
| `apps/server` | WebSocket + REST server (inherited from T3 Code) |
| `packages/contracts` | Shared TypeScript schemas (inherited from T3 Code) |
| `packages/shared` | Shared utilities (inherited from T3 Code) |
| `packages/omnicode-plugin` | Plugin/extension system |
| `packages/omnicode-github` | Octokit-based GitHub API |
| `packages/omnicode-ai` | AI agent framework |
| `packages/omnicode-contracts` | OmniCode-specific schemas |
| `packages/core` | OmniCode server integration (services + REST router) |

---

## Development

```bash
# Prerequisites
bun install

# Start development
bun dev

# Type checking
npx tsgo check packages/omnicode-contracts/src/
npx tsgo check packages/omnicode-plugin/src/
npx tsgo check packages/omnicode-ai/src/
npx tsgo check packages/omnicode-github/src/
npx tsgo check packages/core/src/omnicode/
```

---

## License

Same as T3 Code.
