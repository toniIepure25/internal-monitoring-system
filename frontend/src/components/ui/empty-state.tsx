"use client";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(248,250,252,0.92))] px-6 py-16 text-center shadow-[0_18px_50px_-34px_rgba(15,23,42,0.24)]">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200">
        <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="primary-button mt-5"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
