vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  },
}));

vi.mock("@/features/dev/component-showcase", () => ({ ComponentShowcase: () => null }));

describe("development component showcase route", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("renders outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { default: Page } = await import("@/app/[locale]/dev/components/page");
    expect(() => Page()).not.toThrow();
  });

  it("is unavailable in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { default: Page } = await import("@/app/[locale]/dev/components/page");
    expect(() => Page()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
