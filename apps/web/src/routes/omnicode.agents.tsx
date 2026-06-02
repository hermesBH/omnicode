import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import {
  AlertCircleIcon,
  BotIcon,
  CheckCircle2Icon,
  InboxIcon,
  PlayIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardPanel, CardFooter } from "../components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from "../components/ui/empty";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";

// --- Mock Types ---

type AgentStatus = "idle" | "running" | "success" | "error";

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: string;
  capabilities: string[];
  status: AgentStatus;
  lastRun: string | null;
  lastResult: string | null;
}

interface AgentRun {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  status: "running" | "success" | "error";
  startedAt: string;
  completedAt: string | null;
  result: string | null;
}

// --- Mock Data ---

const MOCK_AGENTS: Agent[] = [
  {
    id: "code-review",
    name: "Code Review Agent",
    description: "Reviews pull requests for code quality, security issues, and adherence to best practices.",
    icon: "code",
    capabilities: ["PR Review", "Security Analysis", "Style Checking"],
    status: "idle",
    lastRun: "2026-06-01T16:30:00Z",
    lastResult: "Reviewed PR #42 – found 3 minor issues, 0 critical.",
  },
  {
    id: "issue-triage",
    name: "Issue Triage Agent",
    description: "Analyzes incoming issues, assigns labels, suggests priorities, and routes to appropriate maintainers.",
    icon: "bot",
    capabilities: ["Auto-labeling", "Priority Assignment", "Duplicate Detection"],
    status: "idle",
    lastRun: "2026-06-01T14:00:00Z",
    lastResult: "Triaged 5 new issues – assigned labels and suggested priorities.",
  },
  {
    id: "auto-fix",
    name: "Auto-Fix Agent",
    description: "Automatically generates and applies fixes for common code issues found by linters and type checkers.",
    icon: "wand",
    capabilities: ["Auto-fix", "Lint Correction", "Type Error Resolution"],
    status: "idle",
    lastRun: null,
    lastResult: null,
  },
];

const MOCK_RECENT_RUNS: AgentRun[] = [
  {
    id: "r1",
    agentId: "code-review",
    agentName: "Code Review Agent",
    action: "Review PR #42 – omnicode-core",
    status: "success",
    startedAt: "2026-06-01T16:30:00Z",
    completedAt: "2026-06-01T16:32:15Z",
    result: "Found 3 minor issues (2 style, 1 perf). No security concerns.",
  },
  {
    id: "r2",
    agentId: "issue-triage",
    agentName: "Issue Triage Agent",
    action: "Triage incoming issues",
    status: "success",
    startedAt: "2026-06-01T14:00:00Z",
    completedAt: "2026-06-01T14:01:30Z",
    result: "Triaged 5 issues: 2 bugs, 2 features, 1 question.",
  },
  {
    id: "r3",
    agentId: "code-review",
    agentName: "Code Review Agent",
    action: "Review PR #38 – omnicode-plugins",
    status: "error",
    startedAt: "2026-05-30T10:00:00Z",
    completedAt: "2026-05-30T10:01:00Z",
    result: "Failed: Could not fetch PR diff from remote.",
  },
];

// --- Helpers ---

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
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
    <div className="flex flex-col gap-3 p-6" role="status" aria-label="Loading agents">
      <span className="sr-only">Loading agents...</span>
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-1 h-4 w-full" />
              </div>
            </div>
          </CardHeader>
          <CardPanel>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-24" />
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
        <EmptyTitle>Failed to load agents</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={onRetry} aria-label="Try again to load agents">
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function EmptyState() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle>No agents available</EmptyTitle>
        <EmptyDescription>
          Install an agent plugin to get started with automated code review, issue triage, and more.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// --- Agent Card ---

function AgentCard({
  agent,
  onRun,
}: {
  agent: Agent;
  onRun: (agentId: string) => void;
}) {
  const statusIcon = {
    idle: null,
    running: <Spinner className="size-3.5" />,
    success: <CheckCircle2Icon className="size-3.5 text-emerald-500" />,
    error: <TriangleAlertIcon className="size-3.5 text-destructive" />,
  }[agent.status];

  const statusLabel = {
    idle: "Idle",
    running: "Running",
    success: "Ready",
    error: "Error",
  }[agent.status];

  const runButtonLabel =
    agent.id === "code-review"
      ? "Run Code Review"
      : agent.id === "issue-triage"
        ? "Run Issue Triage"
        : "Run Agent";

  return (
    <Card
      className="transition-shadow duration-150 focus-within:ring-2 focus-within:ring-ring/50 hover:shadow-sm"
      role="region"
      aria-label={`${agent.name} – ${statusLabel}`}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-foreground shadow-xs/5"
            aria-hidden="true"
          >
            <BotIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-foreground">{agent.name}</CardTitle>
              <Badge
                variant={
                  agent.status === "error"
                    ? "destructive"
                    : agent.status === "running"
                      ? "info"
                      : agent.status === "success"
                        ? "success"
                        : "secondary"
                }
                size="sm"
                className="gap-1"
                aria-label={`Status: ${statusLabel}`}
              >
                {statusIcon}
                {statusLabel}
              </Badge>
            </div>
            <CardDescription className="mt-1 text-sm text-muted-foreground/80">
              {agent.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardPanel>
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Capabilities">
          {agent.capabilities.map((cap) => (
            <Badge key={cap} variant="outline" size="sm" role="listitem">
              {cap}
            </Badge>
          ))}
        </div>
        {agent.lastRun && (
          <p className="mt-2 text-xs text-muted-foreground/60">
            Last run: {formatRelativeTime(agent.lastRun)}
            {agent.lastResult && <> — {agent.lastResult}</>}
          </p>
        )}
      </CardPanel>
      <CardFooter>
        <Button
          size="sm"
          variant="outline"
          disabled={agent.status === "running"}
          onClick={() => onRun(agent.id)}
          aria-label={`${agent.status === "running" ? "Agent is running" : runButtonLabel}`}
        >
          {agent.status === "running" ? (
            <>
              <Spinner className="size-3.5" />
              Running...
            </>
          ) : (
            <>
              <PlayIcon className="size-3.5" />
              {runButtonLabel}
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

// --- Main Component ---

function AgentsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>(MOCK_AGENTS);
  const [recentRuns, setRecentRuns] = useState<AgentRun[]>(MOCK_RECENT_RUNS);
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null);

  const handleRunAgent = useCallback(
    (agentId: string) => {
      setRunningAgentId(agentId);
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, status: "running" as const } : a)),
      );

      // Simulate agent run
      setTimeout(() => {
        const agent = agents.find((a) => a.id === agentId);
        setAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, status: "success" as const } : a)),
        );
        setRecentRuns((prev) => [
          {
            id: `r-${Date.now()}`,
            agentId,
            agentName: agent?.name ?? "Unknown",
            action: agentId === "code-review" ? "Review pending PRs" : "Triage open issues",
            status: "success",
            startedAt: new Date(Date.now() - 120000).toISOString(),
            completedAt: new Date().toISOString(),
            result: `${agent?.name ?? "Agent"} completed successfully.`,
          },
          ...prev,
        ]);
        setRunningAgentId(null);
      }, 2500);
    },
    [agents],
  );

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      setAgents(MOCK_AGENTS);
      setIsLoading(false);
    }, 500);
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
        <h2 className="text-sm font-medium text-foreground">Available Agents</h2>
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          AI agents that automate code review, issue management, and more.
        </p>
      </div>

      <ScrollArea className="flex-1" aria-label="Agent list">
        <div className="flex flex-col gap-3 p-4 sm:p-6">
          {agents.length === 0 ? (
            <EmptyState />
          ) : (
            agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onRun={handleRunAgent} />
            ))
          )}

          {recentRuns.length > 0 && (
            <>
              <Separator className="my-2" />
              <div>
                <h3 className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Recent Runs
                </h3>
                <div className="flex flex-col gap-2" role="list" aria-label="Recent agent runs">
                  {recentRuns.map((run) => (
                    <div
                      key={run.id}
                      className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 transition-shadow duration-150 hover:shadow-sm"
                      role="listitem"
                      aria-label={`${run.agentName} – ${run.status}`}
                    >
                      {run.status === "running" ? (
                        <Spinner className="mt-0.5 size-3.5 shrink-0" />
                      ) : run.status === "success" ? (
                        <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                      ) : (
                        <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {run.agentName}
                          </span>
                          <Badge
                            variant={
                              run.status === "success"
                                ? "success"
                                : run.status === "error"
                                  ? "destructive"
                                  : "info"
                            }
                            size="sm"
                          >
                            {run.status}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground/80">{run.action}</p>
                        {run.result && (
                          <p className="mt-0.5 text-xs text-muted-foreground/60">{run.result}</p>
                        )}
                        <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                          {formatRelativeTime(run.startedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export const Route = createFileRoute("/omnicode/agents")({
  component: AgentsPage,
});
