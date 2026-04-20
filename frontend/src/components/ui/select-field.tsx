import { cn } from "@/lib/utils";
import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, options, placeholder, className, id, ...props }, ref) => {
    const fieldId = id || props.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label && <label htmlFor={fieldId} className="text-xs font-medium text-fgMuted">{label}</label>}
        <select
          ref={ref}
          id={fieldId}
          className={cn("filter-input", error && "border-danger focus:border-danger focus:ring-danger/20", className)}
          aria-invalid={!!error}
          {...props}
        >
          {placeholder && <option value="" className="text-fgSubtle">{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
    );
  },
);

SelectField.displayName = "SelectField";
