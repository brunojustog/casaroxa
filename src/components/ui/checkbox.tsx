import * as React from "react";
import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded border-slate-300 text-roxa-700",
        "focus:ring-2 focus:ring-roxa-500 focus:ring-offset-0",
        className,
      )}
      {...props}
    />
  ),
);
Checkbox.displayName = "Checkbox";
