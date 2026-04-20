"use client";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  color?: "green" | "red" | "yellow" | "blue" | "gray";
}

const colorMap = {
  green: "border-green-200 bg-green-50",
  red: "border-red-200 bg-red-50",
  yellow: "border-yellow-200 bg-yellow-50",
  blue: "border-blue-200 bg-blue-50",
  gray: "border-gray-200 bg-gray-50",
};

const valueColorMap = {
  green: "text-green-700",
  red: "text-red-700",
  yellow: "text-yellow-700",
  blue: "text-blue-700",
  gray: "text-gray-700",
};

export function StatCard({ label, value, subtext, color = "gray" }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${valueColorMap[color]}`}>{value}</p>
      {subtext && <p className="mt-1 text-xs text-gray-400">{subtext}</p>}
    </div>
  );
}
