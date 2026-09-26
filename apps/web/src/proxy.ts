import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";

const handleLocale = createMiddleware(routing);

/** Development-only routes (component showcase) live under `/[locale]/dev`. */
const DEVELOPMENT_ONLY_PATH = /^\/(?:[a-z]{2}\/)?dev(?:\/|$)/;

export default function proxy(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    DEVELOPMENT_ONLY_PATH.test(request.nextUrl.pathname)
  ) {
    // A real 404 status. Rendering notFound() inside a streamed route would return 200.
    return new NextResponse(null, { status: 404 });
  }
  return handleLocale(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
