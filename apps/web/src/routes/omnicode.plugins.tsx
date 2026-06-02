import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import {
  AlertCircleIcon,
  BookIcon,
  BotIcon,
  CheckCircle2Icon,
  GitForkIcon,
  InboxIcon,
  PuzzleIcon,
  Settings2Icon,
  ShieldIcon,
  WrenchIcon,
} from "lucide-react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardPanel, CardFooter } from "../components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from "../components/ui/empty";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { Switch } from "../components/ui/switch";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";

// --- Mock Types ---

type PluginContributionType = "provider" | "agent" | "ui" | "hook" | "command";

interface PluginContribution {
  type: PluginContributionType;
  label: string;
}

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  enabled: boolean;
  contributions: PluginContribution[];
  configurable: boolean;
}

// --- Mock Data ---

const MOCK_PLUGINS: Plugin[] = [
  {
    id: "omnicode-github",
    name: "GitHub Provider",
    description: "Full GitHub integration – browse repositories, issues, and pull requests via Octokit.",
    version: "0.2.1",
    author: "OmniCode Team",
    enabled: true,
    contributions: [
      { type: "provider", label: "GitHub Source Control" },
      { type: "ui", label: "Repository Browser" },
      { type: "ui", label: "Issue Tracker" },
    ],
    configurable: true,
  },
  {
    id: "omnicode-gitlab",
    name: "GitLab Provider",
    description: "GitLab integration for repository browsing, merge requests, and CI status.",
    version: "0.1.0",
    author: "OmniCode Team",
    enabled: false,
    contributions: [
      { type: "provider", label: "GitLab Source Control" },
      { type: "ui", label: "Merge Request Viewer" },
    ],
    configurable: true,
  },
  {
    id: "omnicode-ai-agents",
    name: "AI Agents",
    description: "Built-in AI agents for code review, issue triage, and automated refactoring.",
    version: "0.3.0",
    author: "OmniCode Team",
    enabled: true,
    contributions: [
      { type: "agent", label: "Code Review Agent" },
      { type: "agent", label: "Issue Triage Agent" },
      { type: "agent", label: "Auto-Fix Agent" },
    ],
    configurable: true,
  },
  {
    id: "plugin-lint-watcher",
    name: "Lint Watcher",
    description: "Watches for lint errors on save and surfaces them in real-time.",
    version: "0.1.0",
    author: "Community",
    enabled: true,
    contributions: [
      { type: "hook", label: "onSave Hook" },
      { type: "ui", label: "Lint Status Panel" },
    ],
    configurable: false,
  },
  {
    id: "plugin-custom-commands",
    name: "Custom Commands",
    description: "Define and run custom shell commands from the command palette.",
    version: "0.1.0",
    author: "Community",
    enabled: false,
    contributions: [
      { type: "command", label: "Custom Shell Commands" },
    ],
    configurable: true,
  },
];

// --- Helpers ---

const CONTRIBUTION_ICONS: Record<PluginContributionType, typeof PuzzleIcon> = {
  provider: GitForkIcon,
  agent: BotIcon,
  ui: BookIcon,
  hook: WrenchIcon,
  command: ShieldIcon,
};

const CONTRIBUTION_COLORS: Record<PluginContributionType, string> = {
  provider: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:bg-sky-500/15 dark:text-sky-400",
  agent: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:bg-violet-500/15 dark:text-violet-400",
  ui: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400",
  hook: "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-400",
  command: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20 dark:bg-cyan-500/15 dark:text-cyan-400",
};

// --- States ---

function LoadingState() {
  return (
    <div className="flex flex-col gap-3 p-6" role="status" aria-label="Loading plugins">
      <span className="sr-only">Loading plugins...</span>
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-1 h-4 w-full" />
              </div>
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          </CardHeader>
          <CardPanel>
            <div className="flex gap-2">
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
        <EmptyTitle>Failed to load plugins</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" onClick={onRetry} aria-label="Try again to load plugins">
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
        <EmptyTitle>No plugins installed</EmptyTitle>
        <EmptyDescription>
          Install plugins from the registry or add them to your OmniCode plugins directory.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// --- Plugin Card ---

function PluginCard({
  plugin,
  onToggle,
  onConfigure,
}: {
  plugin: Plugin;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onConfigure: (pluginId: string) => void;
}) {
  return (
    <Card
      className="transition-shadow duration-150 focus-within:ring-2 focus-within:ring-ring/50 hover:shadow-sm"
      role="region"
      aria-label={`${plugin.name} v${plugin.version} – ${plugin.enabled ? "Enabled" : "Disabled"}`}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-foreground shadow-xs/5"
            aria-hidden="true"
          >
            <PuzzleIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium text-foreground">{plugin.name}</CardTitle>
              <span className="text-xs text-muted-foreground/60">v{plugin.version}</span>
              <Badge
                variant={plugin.enabled ? "success" : "secondary"}
                size="sm"
              >
                {plugin.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <CardDescription className="mt-1 text-sm text-muted-foreground/80">
              {plugin.description}
            </CardDescription>
            <p className="mt-0.5 text-xs text-muted-foreground/50">by {plugin.author}</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Switch
                  checked={plugin.enabled}
                  onCheckedChange={(checked) => onToggle(plugin.id, checked)}
                  aria-label={`${plugin.enabled ? "Disable" : "Enable"} ${plugin.name}`}
                />
              </div>
            </TooltipTrigger>
            <TooltipPopup>
              {plugin.enabled ? "Disable plugin" : "Enable plugin"}
            </TooltipPopup>
          </Tooltip>
        </div>
      </CardHeader>
      {plugin.contributions.length > 0 && (
        <CardPanel>
          <div className="flex flex-wrap gap-1.5" role="list" aria-label="Plugin contributions">
            {plugin.contributions.map((contrib, idx) => {
              const Icon = CONTRIBUTION_ICONS[contrib.type];
              return (
                <Badge
                  key={`${contrib.type}-${idx}`}
                  variant="outline"
                  size="sm"
                  className={`flex items-center gap-1 ${CONTRIBUTION_COLORS[contrib.type]}`}
                  role="listitem"
                >
                  <Icon className="size-3" aria-hidden="true" />
                  {contrib.label}
                </Badge>
              );
            })}
          </div>
        </CardPanel>
      )}
      {plugin.configurable && (
        <CardFooter>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={() => onConfigure(plugin.id)}
            aria-label={`Configure ${plugin.name}`}
          >
            <Settings2Icon className="size-3.5" aria-hidden="true" />
            Configure
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

// --- Main Component ---

function PluginsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plugins, setPlugins] = useState<Plugin[]>(MOCK_PLUGINS);

  const handleToggle = useCallback((pluginId: string, enabled: boolean) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === pluginId ? { ...p, enabled } : p)),
    );
  }, []);

  const handleConfigure = useCallback((pluginId: string) => {
    // Placeholder – would open a config dialog or navigate to config page
    console.log(`Configure plugin: ${pluginId}`);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => {
      setPlugins(MOCK_PLUGINS);
      setIsLoading(false);
    }, 500);
  }, []);

  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  if (isLoading) {
    return <LoadingState />;
  }

  const enabledCount = plugins.filter((p) => p.enabled).length;
  const disabledCount = plugins.length - enabledCount;

  return (
    <div className="flex h-full flex-col animate-fade-in">
      <div className="border-b border-border px-4 py-3 sm:px-6">
        <h2 className="text-sm font-medium text-foreground">Installed Plugins</h2>
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          Manage your OmniCode extensions. {enabledCount} of {plugins.length} active.
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-4 sm:p-6">
          {plugins.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {enabledCount > 0 && (
                <>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Active — {enabledCount}
                  </h3>
                  {plugins
                    .filter((p) => p.enabled)
                    .map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        onToggle={handleToggle}
                        onConfigure={handleConfigure}
                      />
                    ))}
                </>
              )}

              {disabledCount > 0 && (
                <>
                  <h3 className="mt-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Disabled — {disabledCount}
                  </h3>
                  {plugins
                    .filter((p) => !p.enabled)
                    .map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        onToggle={handleToggle}
                        onConfigure={handleConfigure}
                      />
                    ))}
                </>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export const Route = createFileRoute("/omnicode/plugins")({
  component: PluginsPage,
});
