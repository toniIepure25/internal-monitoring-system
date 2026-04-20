"use client";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  color?: "green" | "red" | "yellow" | "blue" | "gray";
}

const colorMap = {
  green: "border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.96))]",
  red: "border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,255,255,0.96))]",
  yellow: "border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.96))]",
  blue: "border-sky-200/80 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.96))]",
  gray: "border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))]",
};

const valueColorMap = {
  green: "text-emerald-700",
  red: "text-rose-700",
  yellow: "text-amber-700",
  blue: "text-sky-700",
  gray: "text-slate-700",
};

export function StatCard({ label, value, subtext, color = "gray" }: StatCardProps) {
  return (
    <div className={`rounded-3xl border p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.24)] ${colorMap[color]}`}>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${valueColorMap[color]}`}>{value}</p>
      {subtext && <p className="mt-2 text-xs text-slate-500">{subtext}</p>}
    </div>
  );
}
