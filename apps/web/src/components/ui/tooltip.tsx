"use client";

import { cloneElement, useId, useState, type ReactElement } from "react";

/**
 * Supplementary description for a focusable child. Shown on hover and focus, dismissible
 * with Escape (WCAG 1.4.13). Never place essential information only in a tooltip.
 */
export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: ReactElement<{ "aria-describedby"?: string }>;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onBlur={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setVisible(false);
      }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {cloneElement(children, { "aria-describedby": id })}
      <span
        className="bg-foreground text-surface pointer-events-none absolute start-1/2 top-full z-50 mt-1 w-max max-w-56 -translate-x-1/2 rounded-sm px-2 py-1 text-xs data-[hidden=true]:hidden rtl:translate-x-1/2"
        data-hidden={!visible}
        id={id}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}
