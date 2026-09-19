# Safety assistant service

- **Purpose:** Controlled retrieval and LLM explanation of reviewed e-waste safety information.
- **Belongs here:** Retrieval, provider adapters, grounding controls, fallback behaviour, and safety-response evaluation.
- **Must not contain:** Unreviewed safety claims, free-form dismantling guidance, vision training, or UI code.
- **Interactions:** Uses `packages/safety-content` and `packages/contracts`; is called through `apps/api`.
- **Status:** Placeholder; no retrieval or LLM integration exists.
- **Ownership:** AI/backend engineering with mandatory e-waste safety and responsible-AI review.
