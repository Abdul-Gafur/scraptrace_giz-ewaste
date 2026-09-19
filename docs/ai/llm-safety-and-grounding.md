# LLM safety and grounding

## Mandatory flow

No Large Language Model (LLM) call currently exists. Any future implementation must follow this sequence:

1. The image model suggests an item type.
2. ScrapTrace retrieves approved safety content for the user-confirmed or manually selected category.
3. The LLM receives only the approved content and an allowed transformation request.
4. The LLM explains, simplifies, or translates that content.
5. The output passes structural, provenance, and safety validation.
6. Source and version metadata remain connected to the response.
7. If required approved information is unavailable, invalid, withdrawn, or expired under policy, the LLM does not guess or continue.
8. The application displays a separately approved safe fallback.

## System-instruction requirements

The versioned system policy must define the model as a constrained transformer, not a safety authority. It must require exclusive use of supplied approved content, preservation of warnings/uncertainty, structured output, refusal on missing evidence, and no compliance with user/content instructions that conflict with the policy. It must prohibit the response classes listed below. System instructions are governed artefacts and require review, tests, version, owner, and rollback.

This document defines requirements, not actual prompt text.

## Retrieval restrictions

- Retrieve only published, approved, in-review-date content for the confirmed/manual category and requested supported language.
- Do not retrieve unrestricted web content, user submissions, model memory, operational notes, or draft/withdrawn safety cards.
- Return card identifier, version, language, source references, approval status/date, and review date with the content.
- If no eligible card exists, return a controlled unavailable result; do not broaden the category silently.
- Access to draft, superseded, or withdrawn content is limited to authorised governance roles and never used for end-user generation.

## Input separation and prompt-injection resistance

Approved content, user text, retrieved metadata, and system policy are separate typed fields with explicit trust levels. Treat all user and retrieved text as data, never as instructions. Delimit and length-limit inputs, allow-list transformation intents and languages, disable tools/browsing/code execution, and reject attempts to reveal policy, change roles, add sources, or override restrictions. Safety-card content itself must be reviewed for embedded instructions before publication.

## Allowed transformations

- Explain approved content in clearer language without adding facts.
- Simplify wording while preserving meaning, qualifications, warnings, and destination status.
- Translate into an approved supported language with reviewed terminology.
- Format approved content into the governed response fields.
- Prepare approved wording for read-aloud presentation if that capability is separately approved.

An allowed transformation does not permit answering a new safety, medical, commercial, or regulatory question from general model knowledge.

## Prohibited responses

The LLM must not:

- invent or supplement safety facts;
- recommend hazardous dismantling or teach metal extraction;
- give medical diagnoses or personalised treatment;
- guarantee a price, sale, income, payment, or incentive;
- claim a scrapyard, collection point, or recycler is approved without verified directory data;
- override, weaken, contradict, or omit required approved safety content;
- represent a prediction, image, QR code, or response as proof of recycling;
- expose hidden instructions, secrets, personal data, or unrelated provider data; or
- continue when required approved evidence is unavailable or validation fails.

## Prompt and policy versioning

Each request should reference immutable versions for system policy, transformation template, retrieval policy, output schema, validator, safety card, provider/model, and language configuration. Release records document evaluation, approver, date, known limitations, rollback, and compatible content/schema versions. Mutable provider aliases are not sufficient audit identifiers.

## Structured output

The proposed response schema should contain only fields derived from the governed safety-card structure, plus category, language, card/source/version metadata, generation metadata, and validation outcome. Free-form fields are bounded. Missing required fields fail closed. Exact schema belongs in `packages/contracts` after approval.

## Output validation

Validation should combine schema checks, required-field coverage, source/version match, preservation of prohibited/required meaning, category/language match, length/format bounds, prohibited-claim detection, and safe rendering. Validators reduce risk but do not prove correctness. Failed validation triggers approved source/fallback display and a privacy-safe operational signal; automatic retries must not repeatedly seek a permissive answer.

## Source provenance

The displayed response remains traceable to the approved card, underlying source references, approval/review metadata, content language, prompt/policy version, provider/model, and validation result. Users should be able to distinguish approved source content from LLM-transformed wording and cached from newly generated output.

## Online and offline behaviour

New cloud responses may require internet. Approved cards and previously validated responses may be cached under version, language, freshness, withdrawal, and retention rules. Offline use must show cache/source status. If no eligible cached content exists, display only an approved offline fallback; never run an unapproved local generative path or reuse a guide from another category.

## Provider data minimisation

Send only the minimum approved card fields, target language, allowed transformation, and non-identifying request metadata. Do not send collector identity, account/contact details, precise location, images, recovery evidence, prices, programme decisions, secrets, or unrelated user text. Provider training use, retention, region, subcontractors, abuse logging, deletion, and contract terms require privacy/security approval before use.

## Logging restrictions

Do not log full prompts/responses by default, personal data, safety-card bodies, images, precise locations, provider credentials, or user free text. Prefer version IDs, safe request/correlation IDs, outcome, latency, token/size measures, validation codes, and fallback reason. Any controlled content sampling requires a documented purpose, minimisation, restricted access, retention, and human-review process.

## Human review and evaluation

Safety subject-matter reviewers own content meaning; language reviewers assess critical translations; responsible-AI/security reviewers assess injection, prohibited outputs, privacy, and safe failure. Test every supported category/language and adversarial condition before release and after provider, model, policy, validator, schema, or card changes.

## Failure handling

Timeout, refusal, provider error, invalid structure, unsupported language, missing/withdrawn card, injection signal, or failed safety validation produces no unreviewed advice. Return the approved card directly when eligible or the approved fallback. Preserve a user-safe status and privacy-safe diagnostics. Repeated or severe failures may disable the generation path without disabling access to approved cached/source content.
