import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const source = path.resolve(import.meta.dirname, "..");
const css = readFileSync(path.join(source, "app/globals.css"), "utf8");

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

describe("design tokens", () => {
  const expected: Record<string, string> = {
    "--primary": "#176b52",
    "--primary-dark": "#0f4c3a",
    "--accent": "#237a57",
    "--secondary": "#c78a12",
    "--warning": "#a15c00",
    "--danger": "#b42318",
    "--info": "#2563eb",
    "--background": "#f7f9f8",
    "--surface": "#ffffff",
    "--foreground": "#18211e",
    "--muted-foreground": "#5e6b66",
    "--border": "#dce5e1",
  };

  it.each(Object.entries(expected))("defines %s with the Figma value", (name, value) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${value};`, "i"));
  });

  it.each(["--focus", "--success", "--touch-target", "--container-content", "--radius-sm"])(
    "defines the semantic token %s",
    (name) => {
      expect(css).toContain(`${name}:`);
    },
  );

  it("maps semantic tokens into Tailwind and keeps 44px touch targets", () => {
    expect(css).toContain("--color-primary: var(--primary)");
    expect(css).toMatch(/--touch-target:\s*2\.75rem/);
  });

  it("keeps raw colour values out of components and pages", () => {
    const offenders = walk(source)
      .filter((file) => /\.(tsx?|mjs)$/.test(file) && !file.includes(`${path.sep}test${path.sep}`))
      .filter((file) => /#[0-9a-f]{6}\b/i.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => path.relative(source, file))).toEqual([]);
  });
});
