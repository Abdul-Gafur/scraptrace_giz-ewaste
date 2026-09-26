import type { AnchorHTMLAttributes, ReactNode } from "react";
import { vi } from "vitest";

/** Shared stand-in for `@/i18n/navigation` so components can render outside the App Router. */
export const navigationState = { pathname: "/", replace: vi.fn() };

export const navigationMock = {
  Link: ({
    href,
    children,
    ...props
  }: { href: string; children?: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => navigationState.pathname,
  useRouter: () => ({ replace: navigationState.replace }),
  redirect: vi.fn(),
  getPathname: vi.fn(),
};
