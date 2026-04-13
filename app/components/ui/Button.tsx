"use client";

import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClass: Record<Variant, string> = {
  primary:
    "btn-primary-gradient text-white shadow-sm hover:shadow-md focus-visible:ring-blue-400",
  secondary:
    "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 focus-visible:ring-gray-300",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-300",
  outline:
    "bg-white/70 text-gray-800 border border-gray-200 hover:bg-white focus-visible:ring-gray-300",
};

const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-sm rounded-md gap-1.5",
  md: "h-10 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-5 text-base rounded-xl gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={[
        "inline-flex items-center justify-center font-medium",
        "transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        variantClass[variant],
        sizeClass[size],
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
