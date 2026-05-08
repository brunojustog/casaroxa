import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<Tone, string> = {
  default: "bg-roxa-100 text-roxa-800 ring-roxa-200",
  success: "bg-green-100 text-green-800 ring-green-200",
  warning: "bg-yellow-100 text-yellow-800 ring-yellow-200",
  danger: "bg-red-100 text-red-800 ring-red-200",
  info: "bg-blue-100 text-blue-800 ring-blue-200",
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE[tone],
        className,
      )}
      {...props}
    />
  );
}
