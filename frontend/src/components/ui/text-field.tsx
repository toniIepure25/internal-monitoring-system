import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const fieldId = id || props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label htmlFor={fieldId} className="text-xs font-medium text-fgMuted">{label}</label>}
        <input
          ref={ref}
          id={fieldId}
          className={cn("filter-input", error && "border-danger focus:border-danger focus:ring-danger/20", className)}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="text-[11px] text-danger">{error}</p>}
        {hint && !error && <p className="text-[11px] text-fgSubtle">{hint}</p>}
      </div>
    );
  },
);

TextField.displayName = "TextField";
