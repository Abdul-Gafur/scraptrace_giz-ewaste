# Docker infrastructure

- **Purpose:** Owns container and local-service definitions.
- **Belongs here:** Dockerfiles, compose definitions, and container documentation after technology confirmation.
- **Must not contain:** Secrets, application source, datasets, or production-only credentials.
- **Interactions:** Packages applications and services while respecting their boundaries once container tooling is implemented.
- **Status:** Placeholder; Docker is not implemented.
- **Ownership:** Platform engineering with each component owner reviewing its image.
