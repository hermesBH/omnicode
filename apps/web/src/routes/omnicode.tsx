import {
  Outlet,
  createFileRoute,
  redirect,
  useCanGoBack,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useCallback, useEffect } from "react";

import { SidebarInset, SidebarTrigger } from "../components/ui/sidebar";
import { isElectron } from "../env";
import { OmniCodeIcon } from "../components/omnicode/OmniCodeIcon";

function OmniCodeContentLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const navigateBackWithinApp = useCallback(() => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    void navigate({ to: "/" });
  }, [canGoBack, navigate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        navigateBackWithinApp();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navigateBackWithinApp]);

  return (
    <SidebarInset
      className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate"
      aria-label="OmniCode section"
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {!isElectron && (
          <header className="border-b border-border px-3 py-2 sm:px-5">
            <div className="flex min-h-7 items-center gap-2 sm:min-h-6">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <OmniCodeIcon className="size-5 text-primary" />
              <span className="text-sm font-medium text-foreground">
                OmniCode
              </span>
            </div>
          </header>
        )}

        {isElectron && (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5 wco:h-[env(titlebar-area-height)] wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]">
            <OmniCodeIcon className="mr-2 size-4 text-muted-foreground/70" variant="subtle" />
            <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
              OmniCode
            </span>
          </div>
        )}

        <div
          className="min-h-0 flex flex-1 flex-col animate-fade-in"
          role="region"
          aria-label="OmniCode content"
        >
          <Outlet />
        </div>
      </div>
    </SidebarInset>
  );
}

function OmniCodeRouteLayout() {
  return <OmniCodeContentLayout />;
}

export const Route = createFileRoute("/omnicode")({
  beforeLoad: async ({ context, location }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    ) {
      throw redirect({ to: "/pair", replace: true });
    }

    if (location.pathname === "/omnicode") {
      throw redirect({ to: "/omnicode/repos", replace: true });
    }
  },
  component: OmniCodeRouteLayout,
});
