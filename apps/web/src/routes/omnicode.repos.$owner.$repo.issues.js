import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, CircleIcon, InboxIcon, MessageSquareIcon, UserIcon, } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardPanel } from "../components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from "../components/ui/empty";
import { ScrollArea } from "../components/ui/scroll-area";
import { Skeleton } from "../components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
// --- Mock Data ---
const MOCK_ISSUES = [
    {
        id: "1",
        number: 42,
        title: "Plugin system fails to discover local plugins when OMNICODE_PLUGIN_PATH contains symlinks",
        state: "open",
        labels: [
            { name: "bug", color: "red" },
            { name: "plugin-system", color: "blue" },
        ],
        assignee: { login: "alice", avatarUrl: "" },
        commentsCount: 5,
        createdAt: "2026-05-28T10:00:00Z",
        updatedAt: "2026-06-01T14:30:00Z",
    },
    {
        id: "2",
        number: 41,
        title: "Add support for GitLab as a source control provider",
        state: "open",
        labels: [
            { name: "enhancement", color: "green" },
            { name: "provider", color: "purple" },
        ],
        assignee: null,
        commentsCount: 12,
        createdAt: "2026-05-25T08:00:00Z",
        updatedAt: "2026-05-31T09:15:00Z",
    },
    {
        id: "3",
        number: 40,
        title: "Agent orchestration fails with 'session not found' error under concurrent load",
        state: "open",
        labels: [
            { name: "bug", color: "red" },
            { name: "agents", color: "orange" },
            { name: "concurrency", color: "yellow" },
        ],
        assignee: { login: "bob", avatarUrl: "" },
        commentsCount: 8,
        createdAt: "2026-05-22T16:00:00Z",
        updatedAt: "2026-05-30T11:00:00Z",
    },
    {
        id: "4",
        number: 39,
        title: "Implement pull request review agent with inline comment support",
        state: "closed",
        labels: [
            { name: "feature", color: "green" },
            { name: "agents", color: "orange" },
        ],
        assignee: { login: "carol", avatarUrl: "" },
        commentsCount: 15,
        createdAt: "2026-05-10T09:00:00Z",
        updatedAt: "2026-05-28T17:00:00Z",
    },
    {
        id: "5",
        number: 38,
        title: "Repository browser shows incorrect star counts for mirrored repos",
        state: "closed",
        labels: [
            { name: "bug", color: "red" },
            { name: "ui", color: "blue" },
        ],
        assignee: null,
        commentsCount: 3,
        createdAt: "2026-05-15T14:00:00Z",
        updatedAt: "2026-05-26T10:30:00Z",
    },
];
// --- Helpers ---
const LABEL_COLORS = {
    red: "bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/15 dark:text-red-400",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-400",
    green: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400",
    purple: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/15 dark:text-purple-400",
    orange: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-500/15 dark:text-orange-400",
    yellow: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:bg-yellow-500/15 dark:text-yellow-400",
};
function formatRelativeTime(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1)
        return "just now";
    if (diffMinutes < 60)
        return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24)
        return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30)
        return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths}mo ago`;
}
// --- States ---
function LoadingState() {
    return (<div className="flex flex-col gap-3 p-6" role="status" aria-label="Loading issues">
      <span className="sr-only">Loading issues...</span>
      <div className="mb-2 flex gap-2">
        <Skeleton className="h-8 w-20"/>
        <Skeleton className="h-8 w-20"/>
        <Skeleton className="h-8 w-20"/>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (<Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-4 rounded-full"/>
              <Skeleton className="h-5 flex-1"/>
            </div>
            <div className="mt-2 flex gap-2">
              <Skeleton className="h-5 w-16"/>
              <Skeleton className="h-5 w-20"/>
            </div>
          </CardHeader>
          <CardPanel>
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-24"/>
              <Skeleton className="h-4 w-20"/>
            </div>
          </CardPanel>
        </Card>))}
    </div>);
}
function ErrorState({ message, onRetry }) {
    return (<Empty role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircleIcon className="size-5 text-destructive"/>
        </EmptyMedia>
        <EmptyTitle>Failed to load issues</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={onRetry} aria-label="Try again to load issues">
          Try again
        </Button>
      </EmptyContent>
    </Empty>);
}
function EmptyState({ stateFilter }) {
    const title = stateFilter === "all" ? "No issues" : `No ${stateFilter} issues`;
    return (<Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon className="size-5 text-muted-foreground"/>
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>
          {stateFilter === "open"
            ? "There are no open issues. Good work!"
            : stateFilter === "closed"
                ? "No closed issues yet."
                : "No issues have been created in this repository."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>);
}
// --- Main Component ---
function IssueTrackerPage() {
    const params = useParams({ from: "/omnicode/repos/$owner/$repo/issues" });
    const owner = params.owner;
    const repo = params.repo;
    const [stateFilter, setStateFilter] = useState("all");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [issues, setIssues] = useState(MOCK_ISSUES);
    const filteredIssues = useMemo(() => {
        if (stateFilter === "all")
            return issues;
        return issues.filter((issue) => issue.state === stateFilter);
    }, [issues, stateFilter]);
    const handleRetry = useCallback(() => {
        setError(null);
        setIsLoading(true);
        setTimeout(() => {
            setIssues(MOCK_ISSUES);
            setIsLoading(false);
        }, 500);
    }, []);
    const countLabel = `${filteredIssues.length} issue${filteredIssues.length !== 1 ? "s" : ""}`;
    if (error) {
        return <ErrorState message={error} onRetry={handleRetry}/>;
    }
    if (isLoading) {
        return <LoadingState />;
    }
    return (<div className="flex h-full flex-col animate-slide-up">
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <ToggleGroup value={stateFilter} onValueChange={(value) => {
            if (value)
                setStateFilter(value);
        }} type="single" size="sm" aria-label="Filter issues by state">
            <ToggleGroupItem value="all" className="text-xs" aria-label="Show all issues">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="open" className="text-xs" aria-label="Show open issues only">
              <CircleIcon className="size-3.5 text-emerald-500" aria-hidden="true"/>
              Open
            </ToggleGroupItem>
            <ToggleGroupItem value="closed" className="text-xs" aria-label="Show closed issues only">
              <CheckCircle2Icon className="size-3.5 text-muted-foreground" aria-hidden="true"/>
              Closed
            </ToggleGroupItem>
          </ToggleGroup>
          <span className="ml-auto text-xs text-muted-foreground/60" aria-live="polite">
            {countLabel}
          </span>
        </div>
      </div>

      {/* Repository context header */}
      <div className="border-b border-border/50 px-4 py-2 sm:px-6">
        <p className="text-xs text-muted-foreground/60">
          Issues for <span className="font-medium text-foreground/80">{owner}/{repo}</span>
        </p>
      </div>

      <ScrollArea className="flex-1">
        {filteredIssues.length === 0 ? (<EmptyState stateFilter={stateFilter}/>) : (<div className="flex flex-col gap-3 p-4 sm:p-6" role="list" aria-label={countLabel}>
            {filteredIssues.map((issue) => (<Card key={issue.id} role="listitem" className="transition-shadow duration-150 focus-within:ring-2 focus-within:ring-ring/50 hover:shadow-sm">
                <CardHeader>
                  <div className="flex items-start gap-2.5">
                    {issue.state === "open" ? (<CircleIcon className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-label="Open issue"/>) : (<CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Closed issue"/>)}
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-medium leading-snug text-foreground">
                        <span className="text-muted-foreground">#{issue.number}</span>{" "}
                        {issue.title}
                      </CardTitle>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5" role="list" aria-label="Labels">
                        {issue.labels.map((label) => (<Badge key={label.name} variant="outline" size="sm" className={LABEL_COLORS[label.color] ?? ""} role="listitem">
                            {label.name}
                          </Badge>))}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardPanel>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {issue.assignee ? (<span className="flex items-center gap-1" aria-label={`Assigned to ${issue.assignee.login}`}>
                        <UserIcon className="size-3.5" aria-hidden="true"/>
                        {issue.assignee.login}
                      </span>) : (<span className="flex items-center gap-1 text-muted-foreground/60" aria-label="Unassigned">
                        <UserIcon className="size-3.5" aria-hidden="true"/>
                        Unassigned
                      </span>)}
                    <span className="flex items-center gap-1" aria-label={`${issue.commentsCount} comments`}>
                      <MessageSquareIcon className="size-3.5" aria-hidden="true"/>
                      {issue.commentsCount}
                    </span>
                    <span className="ml-auto" aria-label={`Updated ${formatRelativeTime(issue.updatedAt)}`}>
                      Updated {formatRelativeTime(issue.updatedAt)}
                    </span>
                  </div>
                </CardPanel>
              </Card>))}
          </div>)}
      </ScrollArea>
    </div>);
}
export const Route = createFileRoute("/omnicode/repos/$owner/$repo/issues")({
    component: IssueTrackerPage,
});
