import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import {
  AlertCircleIcon,
  BookIcon,
  GitForkIcon,
  InboxIcon,
  SearchIcon,
  StarIcon,
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardPanel } from "../components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from "../components/ui/empty";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Skeleton } from "../components/ui/skeleton";

// --- Mock Types ---

interface Repo {
  id: string;
  name: string;
  owner: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  updatedAt: string;
}

// --- Mock Data ---

const MOCK_REPOS: Repo[] = [
  {
    id: "1",
    name: "omnicode-core",
    owner: "omnicode",
    description: "Core OmniCode platform – AI-native development environment with extensible plugin architecture.",
    stars: 1284,
    forks: 142,
    language: "TypeScript",
    topics: ["ai", "developer-tools", "extensible", "effect-ts"],
    updatedAt: "2026-06-01T12:00:00Z",
  },
  {
    id: "2",
    name: "omnicode-plugins",
    owner: "omnicode",
    description: "Official plugin registry and package manager for OmniCode extensions.",
    stars: 342,
    forks: 56,
    language: "TypeScript",
    topics: ["plugins", "registry", "package-manager"],
    updatedAt: "2026-05-28T08:30:00Z",
  },
  {
    id: "3",
    name: "omnicode-ai-agents",
    owner: "omnicode",
    description: "Built-in AI agents for code review, issue triage, and automated refactoring.",
    stars: 891,
    forks: 73,
    language: "TypeScript",
    topics: ["ai", "agents", "code-review", "automation"],
    updatedAt: "2026-05-30T16:45:00Z",
  },
  {
    id: "4",
    name: "omnicode-github",
    owner: "omnicode",
    description: "GitHub integration provider – browse repos, issues, PRs via Octokit.",
    stars: 156,
    forks: 28,
    language: "TypeScript",
    topics: ["github", "integration", "octokit"],
    updatedAt: "2026-05-25T10:15:00Z",
  },
];

// --- Helpers ---

function formatStars(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

// --- States ---

function LoadingState() {
  return (
    <div
      className="flex flex-col gap-3 p-6"
      role="status"
      aria-label="Loading repositories"
    >
      <span className="sr-only">Loading repositories...</span>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-1 h-4 w-full" />
            <Skeleton className="mt-1 h-4 w-3/4" />
          </CardHeader>
          <CardPanel>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-20" />
            </div>
          </CardPanel>
        </Card>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Empty role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircleIcon className="size-5 text-destructive" />
        </EmptyMedia>
        <EmptyTitle>Failed to load repositories</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={onRetry} aria-label="Try again to load repositories">
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function EmptyState({ searchQuery }: { searchQuery: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>
          {searchQuery ? `No results for "${searchQuery}"` : "No repositories"}
        </EmptyTitle>
        <EmptyDescription>
          {searchQuery
            ? "Try a different search term or browse trending repositories."
            : "Connect a source control provider to browse repositories."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// --- Main Component ---

function RepoBrowserPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repos, setRepos] = useState<Repo[]>(MOCK_REPOS);

  const filteredRepos = useMemo(() => {
    if (!searchQuery.trim()) return repos;
    const query = searchQuery.toLowerCase();
    return repos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query) ||
        repo.owner.toLowerCase().includes(query) ||
        (repo.description?.toLowerCase() ?? "").includes(query) ||
        repo.topics.some((t) => t.toLowerCase().includes(query)) ||
        (repo.language?.toLowerCase() ?? "").includes(query),
    );
  }, [repos, searchQuery]);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    // Simulate fetch
    setTimeout(() => {
      setRepos(MOCK_REPOS);
      setIsLoading(false);
    }, 500);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="flex h-full flex-col animate-fade-in">
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <div className="relative max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            className="pl-9"
            placeholder="Search repositories by name, description, or topic..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            aria-label="Search repositories"
            role="searchbox"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filteredRepos.length === 0 ? (
          <EmptyState searchQuery={searchQuery} />
        ) : (
          <div
            className="flex flex-col gap-3 p-4 sm:p-6"
            role="list"
            aria-label={`${filteredRepos.length} repositor${filteredRepos.length === 1 ? "y" : "ies"}`}
          >
            {filteredRepos.map((repo) => (
              <Card
                key={repo.id}
                role="listitem"
                className="transition-shadow duration-150 focus-within:ring-2 focus-within:ring-ring/50 hover:shadow-sm"
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BookIcon className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                    <CardTitle className="text-sm font-medium">
                      <span className="text-muted-foreground">{repo.owner}/</span>
                      <span className="text-foreground">{repo.name}</span>
                    </CardTitle>
                  </div>
                  {repo.description && (
                    <CardDescription className="line-clamp-2 text-sm text-muted-foreground/80">
                      {repo.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardPanel>
                  <div className="flex flex-wrap items-center gap-3">
                    {repo.language && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label={`Language: ${repo.language}`}>
                        <span className="inline-block size-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
                        {repo.language}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-label={`${repo.stars} stars`}>
                      <StarIcon className="size-3.5" aria-hidden="true" />
                      {formatStars(repo.stars)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-label={`${repo.forks} forks`}>
                      <GitForkIcon className="size-3.5" aria-hidden="true" />
                      {repo.forks}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground/60" aria-label={`Updated ${formatRelativeTime(repo.updatedAt)}`}>
                      Updated {formatRelativeTime(repo.updatedAt)}
                    </span>
                  </div>
                  {repo.topics.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5" role="list" aria-label="Topics">
                      {repo.topics.map((topic) => (
                        <Badge key={topic} variant="secondary" size="sm" role="listitem">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardPanel>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export const Route = createFileRoute("/omnicode/repos")({
  component: RepoBrowserPage,
});
