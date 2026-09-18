# Vision service

- **Purpose:** Proposed ownership boundary for e-waste image-model training, evaluation, versioning, and inference.
- **Belongs here:** Approved training pipelines, evaluation artefacts, inference service logic, and model documentation.
- **Must not contain:** User interfaces, safety advice, raw personal data without governance, or automatic learning from unreviewed corrections.
- **Interactions:** Exposes defined contracts to `apps/api`; consumes only authorised datasets and reviewed labels.
- **Status:** Placeholder; no model or inference code exists.
- **Ownership:** ML engineering with data, responsible-AI, privacy, and domain review.
