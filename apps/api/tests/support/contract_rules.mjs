// Evaluates the real TypeScript contract functions (built to packages/contracts/dist) so the
// Python parity tests compare against the source of truth rather than a copy of it.
//
// Usage: node contract_rules.mjs < request.json
//   {"digest": <json value>}  -> {"digest": "sha256:..."}
//   {"permissions": true}      -> {"table": [[role, permission, contextBits, allowed], ...]}
//   {"transitions": true}      -> {"rules": RECOVERY_RECORD_TRANSITIONS}
//   {"vocabulary": true}       -> review codes, operation names and system identifiers
//   {"normalize": [codes]}     -> {"normalized": [normalizeManualTransferCode(code)]}

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const contracts = await import(resolve(here, "../../../../packages/contracts/dist/index.js"));
const request = JSON.parse(readFileSync(0, "utf8"));

if ("digest" in request) {
  process.stdout.write(JSON.stringify({ digest: await contracts.sha256CanonicalJson(request.digest) }));
} else if (request.permissions) {
  const roles = contracts.UserRoleSchema.options;
  const permissions = contracts.PermissionSchema.options;
  const keys = ["owns_resource", "assigned_programme", "assigned_facility", "assigned_review", "personal_data_required"];
  const table = [];
  for (const role of roles) {
    for (const permission of permissions) {
      for (let bits = 0; bits < 2 ** keys.length; bits += 1) {
        const context = Object.fromEntries(keys.map((key, index) => [key, Boolean(bits & (1 << index))]));
        table.push([role, permission, bits, contracts.isPermissionAllowed(role, permission, context)]);
      }
    }
  }
  process.stdout.write(JSON.stringify({ table, keys }));
} else if (request.transitions) {
  process.stdout.write(JSON.stringify({ rules: contracts.RECOVERY_RECORD_TRANSITIONS }));
} else if (request.vocabulary) {
  process.stdout.write(
    JSON.stringify({
      flag_codes: contracts.REVIEW_FLAG_CODES,
      reason_codes: contracts.REVIEW_REASON_CODES,
      reasons_by_decision: contracts.REASON_CODES_BY_DECISION,
      manual_review_reason: contracts.MANUAL_REVIEW_REASON,
      operations: contracts.IDEMPOTENT_OPERATIONS,
      system_device_instance_id: contracts.SYSTEM_DEVICE_INSTANCE_ID,
      manual_code_alphabet: contracts.MANUAL_TRANSFER_CODE_ALPHABET,
      lifecycle_events: contracts.LIFECYCLE_EVENT_TYPES,
      fact_events: contracts.RECORD_FACT_EVENT_TYPES,
    }),
  );
} else if (request.normalize) {
  process.stdout.write(
    JSON.stringify({ normalized: request.normalize.map((code) => contracts.normalizeManualTransferCode(code)) }),
  );
} else {
  process.stderr.write("Unknown request.\n");
  process.exit(2);
}
