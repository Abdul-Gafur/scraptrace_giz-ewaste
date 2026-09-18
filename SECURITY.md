# Security policy

## Reporting a vulnerability

Report suspected security, privacy, evidence-integrity, AI-safety, or secret-exposure issues privately.

**Security contact: To be assigned by the project team**

Until a dedicated contact is assigned, contact the project lead privately and ask that the report be routed to the security owner. Do not open a public issue containing vulnerability details.

Include the affected component/version, impact, safe reproduction steps using synthetic data, observed and expected behaviour, and whether personal data, credentials, safety content, or active exploitation may be involved.

## Do not publish

Do not publish or attach active secrets, personal data, restricted images, precise locations, private recovery records, destructive exploit code, model/dataset artefacts, or unpatched attack details. Request a protected transfer channel if additional evidence is needed.

## Secret exposure

If a credential may be exposed, report it privately and revoke or rotate it immediately through its issuer. Do not wait for repository-history cleanup, and do not copy the value into the report.

## Detailed guidance

- [Vulnerability-reporting process](docs/security/vulnerability-reporting.md)
- [Threat model](docs/security/threat-model.md)
- [Security and privacy baseline](docs/security/security-and-privacy.md)
- [Secrets management](docs/security/secrets-management.md)

Response targets, safe-harbour terms, disclosure policy, and permanent contacts are **to be decided**.
