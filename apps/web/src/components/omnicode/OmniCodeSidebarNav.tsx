import { useCallback, type ComponentType } from "react";
import {
  ArrowLeftIcon,
  BookIcon,
  BotIcon,
  PuzzleIcon,
  GitForkIcon,
  CircleDotIcon,
} from "lucide-react";
import { useCanGoBack, useNavigate } from "@tanstack/react-router";

import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "../ui/sidebar";
import { OmniCodeIcon } from "./OmniCodeIcon";

export type OmniCodeSectionPath =
  | "/omnicode/repos"
  | "/omnicode/agents"
  | "/omnicode/plugins"
  | "/omnicode/issues";

export const OMNICODE_NAV_ITEMS: ReadonlyArray<{
  label: string;
  to: OmniCodeSectionPath;
  icon: ComponentType<{ className?: string }>;
}> = [
  { label: "Issues", to: "/omnicode/issues", icon: CircleDotIcon },
  { label: "Repositories", to: "/omnicode/repos", icon: BookIcon },
  { label: "Agents", to: "/omnicode/agents", icon: BotIcon },
  { label: "Plugins", to: "/omnicode/plugins", icon: PuzzleIcon },
];

export function OmniCodeSidebarNav({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const { isMobile, setOpenMobile } = useSidebar();
  const handleSectionClick = useCallback(
    (to: OmniCodeSectionPath) => {
      if (isMobile) {
        setOpenMobile(false);
      }
      void navigate({ to, replace: true });
    },
    [isMobile, navigate, setOpenMobile],
  );
  const handleBackClick = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
    if (canGoBack) {
      window.history.back();
      return;
    }
    void navigate({ to: "/" });
  }, [canGoBack, isMobile, navigate, setOpenMobile]);

  return (
    <>
      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup className="px-2 py-3">
          <span className="mb-2 flex items-center gap-2 px-2.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground/50 uppercase">
            <OmniCodeIcon className="size-3.5" variant="subtle" />
            OmniCode
          </span>
          <SidebarMenu aria-label="OmniCode sections">
            {OMNICODE_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    size="sm"
                    isActive={isActive}
                    className={
                      isActive
                        ? "gap-2.5 px-2.5 py-2 text-left text-[13px] font-medium text-foreground"
                        : "gap-2.5 px-2.5 py-2 text-left text-[13px] text-muted-foreground/70 hover:text-foreground/80"
                    }
                    onClick={() => handleSectionClick(item.to)}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={`${item.label}${isActive ? " (current)" : ""}`}
                  >
                    <Icon
                      className={
                        isActive
                          ? "size-4 shrink-0 text-foreground"
                          : "size-4 shrink-0 text-muted-foreground/60"
                      }
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              className="gap-2 px-2 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={handleBackClick}
              aria-label="Go back to main T3 Code"
            >
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              <span>Back</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
