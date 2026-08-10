"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "icon";
type Size = "md" | "sm";

type Shared = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
};

type AsButton = Shared &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };
type AsLink = Shared &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> & { href: string };

// Thin, typed wrapper over the .btn CSS system already used everywhere
// (className="btn btn-primary btn-sm" etc.) — same look, but variant/size
// are a closed set instead of hand-typed class strings, and loading/disabled
// are handled once instead of per-callsite.
export function Button(props: AsButton | AsLink) {
  const { variant = "ghost", size = "md", loading = false, className = "", children, ...rest } = props;
  const cls = [
    "btn",
    `btn-${variant}`,
    size === "sm" ? "btn-sm" : "",
    variant === "icon" ? "btn-icon" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if ("href" in props && props.href !== undefined) {
    const { href, "aria-disabled": ariaDisabled, ...anchorRest } = rest as Omit<AsLink, keyof Shared>;
    const disabled = loading || ariaDisabled === true || ariaDisabled === "true";
    return (
      <Link
        href={href}
        className={cls}
        aria-disabled={disabled || undefined}
        onClick={disabled ? (e) => e.preventDefault() : (anchorRest as AsLink).onClick}
        {...anchorRest}
      >
        {loading ? <span className="btn-spinner" aria-hidden /> : null}
        {children}
      </Link>
    );
  }

  const { disabled, ...buttonRest } = rest as Omit<AsButton, keyof Shared>;
  return (
    <button className={cls} disabled={loading || disabled} {...buttonRest}>
      {loading ? <span className="btn-spinner" aria-hidden /> : null}
      {children}
    </button>
  );
}
