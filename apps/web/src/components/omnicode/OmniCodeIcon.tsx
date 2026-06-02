import { cn } from "~/lib/utils";

interface OmniCodeIconProps {
  className?: string;
  size?: number;
  variant?: "default" | "subtle";
}

/**
 * OmniCode logo icon – a stylized interlocking 'O' and 'C' representing
 * the OmniCode brand. Designed for both dark and light themes.
 */
export function OmniCodeIcon({
  className,
  size = 24,
  variant = "default",
}: OmniCodeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      role="img"
    >
      {/* Outer ring (O) */}
      <circle
        cx="16"
        cy="16"
        r="13"
        stroke="currentColor"
        strokeWidth="2.5"
        className={
          variant === "subtle"
            ? "text-muted-foreground/50"
            : "text-foreground/80"
        }
        fill="none"
      />
      {/* Inner chevron-arm (C cutout) */}
      <path
        d="M16 6.5A9.5 9.5 0 0 0 6.5 16A9.5 9.5 0 0 0 16 25.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={
          variant === "subtle"
            ? "text-muted-foreground/40"
            : "text-foreground/60"
        }
        fill="none"
      />
      {/* Accent dot at end of C-arm */}
      <circle
        cx="22.5"
        cy="22.5"
        r="2.5"
        fill="currentColor"
        className={
          variant === "subtle"
            ? "text-primary/60"
            : "text-primary"
        }
      />
    </svg>
  );
}
