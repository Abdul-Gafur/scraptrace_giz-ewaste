# Secrets management

## Status

This document defines proposed rules. No secret store, deployment, credential, scanner, or rotation automation is implemented. No real secrets belong in the repository.

## What counts as a secret

Secrets include API/provider keys, passwords, private keys, signing/encryption keys, database/storage credentials, session/token signing material, OAuth client secrets, webhook secrets, service-account credentials, recovery codes, administrative bootstrap values, future payment credentials, and any value that grants unauthorised access or can derive another secret. Personal data is sensitive but governed separately; it must not be mislabeled a “secret” to avoid privacy controls.

## Prohibited locations

Never store secrets in Git or its history, source code, Markdown, examples, issue/PR text, chat, screenshots, test fixtures, datasets, notebooks, model artefacts, browser bundles, mobile/offline caches, QR codes, container images/layers, logs/traces/metrics, analytics, URLs, or unencrypted shared files. Environment files containing real values must not be committed.

## Local development

- Use an approved developer secret mechanism after tooling is selected, with local files excluded from version control and minimum-scope non-production credentials.
- Provide variable names and safe placeholders, never real example values.
- Do not share credentials among developers or copy production secrets/data locally.
- Prefer local emulators or dedicated test accounts with low limits and isolated data.
- Clear secrets from shell history, crash reports, recordings, and support bundles.

Exact tool and onboarding/revocation process are to be decided.

## Future deployment

Use an approved managed secret store or platform-native equivalent with authenticated workload identity where possible. Inject at runtime, not build time; scope by service/environment/purpose; separate production from non-production; encrypt and audit access; restrict human reads; define availability, backup/recovery, region, and break-glass handling. Provider choice requires an architecture/security decision.

## Least privilege and credential design

- One service/integration/environment should not share a broad credential with unrelated components.
- Grant minimum APIs, resources, operations, region, lifetime, and rate/spend.
- Prefer short-lived, automatically issued credentials over long-lived keys.
- Separate read, write, administration, signing, and future financial authority.
- A service credential never confers a domain role or programme-verification authority.

## Rotation and revocation

Every secret has owner, purpose, environment, issuer, consumers, creation/expiry, rotation method, revocation path, and last review. Rotation must support overlap or coordinated cutover, test the new value, revoke the old value, and verify no failed/unauthorised use. Cadence is risk/provider-driven and requires approval; no arbitrary period is set here.

Revoke immediately on confirmed/suspected exposure, lost device/account, role change, provider compromise, or unused credential discovery. Planned deletion must account for queued/offline work without extending unsafe credentials indefinitely.

## Provider credentials

LLM, map, object-storage, monitoring, identity, and future payment credentials stay server-side unless a provider-specific public client identifier is explicitly designed as non-secret. Apply provider restrictions, quotas, alerts, allowed origins/network/resource scope, and separate environments. Never use one personal account key as a team production credential.

## Accidental-exposure response

1. Do not copy the secret into another channel or public issue.
2. Privately notify the security contact/process in [SECURITY.md](../../SECURITY.md).
3. Revoke/rotate the credential immediately through the issuer; do not wait for Git history cleanup.
4. Preserve minimum incident evidence without retaining the secret unnecessarily.
5. Identify access/use, affected data/systems, downstream credentials, and logs.
6. Remove the value from current files and, where approved, rewrite history/caches; assume copied history may persist.
7. Validate replacement, monitor abuse, notify required parties, and document root cause/follow-up.

The incident-response authority and notification rules remain to be established.

## Logging restrictions

Use allow-listed structured fields. Redact authorisation headers, cookies, query credentials, provider payload credentials, connection strings, private key material, and secret-bearing exceptions before emission. Avoid logging arbitrary environment/configuration objects. Secret fingerprints may be used only under an approved non-reversible and non-enumerable design; simple hashing of a low-entropy secret is unsafe.

## Review checklist

- Can this value grant or derive access?
- Is it outside source/build/client/log/data artefacts?
- Is scope/lifetime/environment minimal?
- Are owner, rotation, and emergency revocation known?
- Will offline queues or rollback require the old value, and is that risk controlled?
- Does monitoring reveal use without exposing the credential?
