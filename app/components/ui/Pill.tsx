import * as React from "react";

type Tone = "green" | "gray" | "blue" | "red" | "amber";

const toneClass: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  gray: "bg-gray-100 text-gray-600 border-gray-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
};

export function Pill({
  tone = "gray",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
