import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { toJSONSchema } from "zod";

import { PUBLIC_SCHEMA_REGISTRY } from "../dist/schema-registry.js";

const schemaDirectory = fileURLToPath(new URL("../schemas/", import.meta.url));
const mode = process.argv[2];

if (mode !== "--write" && mode !== "--check") {
  throw new Error("Use --write to generate schemas or --check to verify committed artifacts.");
}

const artifacts = new Map();
for (const name of Object.keys(PUBLIC_SCHEMA_REGISTRY).sort()) {
  const schema = toJSONSchema(PUBLIC_SCHEMA_REGISTRY[name], {
    target: "draft-2020-12",
    reused: "ref",
  });
  schema.$id = `https://schemas.scraptrace.local/contracts/1.0.0/${name}.schema.json`;
  schema.title = name;
  artifacts.set(`${name}.schema.json`, `${JSON.stringify(schema, null, 2)}\n`);
}

const manifest = {
  contract_schema_version: "1.0.0",
  generated_files: Array.from(artifacts.entries()).map(([name, contents]) => ({
    name,
    sha256: createHash("sha256").update(contents).digest("hex"),
  })),
};
artifacts.set("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

await mkdir(schemaDirectory, { recursive: true });

if (mode === "--write") {
  await Promise.all(
    Array.from(artifacts.entries()).map(([name, contents]) =>
      writeFile(new URL(`../schemas/${name}`, import.meta.url), contents, "utf8"),
    ),
  );
  process.stdout.write(`Generated ${artifacts.size} contract artifacts.\n`);
} else {
  const existingFiles = (await readdir(schemaDirectory)).filter((name) => name.endsWith(".json")).sort();
  const expectedFiles = Array.from(artifacts.keys()).sort();
  if (JSON.stringify(existingFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(`Generated schema file set is stale. Expected ${expectedFiles.join(", ")}.`);
  }
  for (const [name, expected] of artifacts) {
    const actual = await readFile(new URL(`../schemas/${name}`, import.meta.url), "utf8");
    if (actual !== expected) {
      throw new Error(`${name} is stale. Run npm run schema:generate.`);
    }
  }
  process.stdout.write(`Verified ${artifacts.size} contract artifacts.\n`);
}

