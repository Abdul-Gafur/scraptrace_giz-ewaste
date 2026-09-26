import { NextRequest } from "next/server";

import proxy from "@/proxy";

const request = (path: string) => new NextRequest(`http://localhost${path}`);

describe("proxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["/en/dev/components", "/ar/dev", "/dev/components"])(
    "returns 404 for development-only route %s in production",
    (path) => {
      vi.stubEnv("NODE_ENV", "production");
      expect(proxy(request(path)).status).toBe(404);
    },
  );

  it("does not block ordinary routes in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(proxy(request("/en/collector")).status).not.toBe(404);
    expect(proxy(request("/en/device")).status).not.toBe(404);
  });

  it("allows the showcase route outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(proxy(request("/en/dev/components")).status).not.toBe(404);
  });
});
