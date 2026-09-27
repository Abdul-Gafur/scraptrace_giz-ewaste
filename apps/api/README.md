# ScrapTrace API

This FastAPI application is the first backend walking skeleton for ScrapTrace. It exposes health checks and a secure multipart endpoint for the released seven-category vision classifier. The model classifies one photograph as a whole; it does not detect, count, or localize multiple objects and never returns bounding boxes.

## Setup

The repository convention is `uv` with the Python version declared in the root `.python-version`. From the repository root:

```bash
uv venv --python 3.10.11 .venv
uv pip install --python .venv/bin/python -e 'apps/api[dev]'
```

Place the approved model release at `services/vision/checkpoints/best_model.pth`. Then calculate its digest and set `checkpoint_sha256` in `services/vision/checkpoints/model_manifest.json`:

```bash
shasum -a 256 services/vision/checkpoints/best_model.pth
```

The current manifest selects the EfficientNet-B0 v0.2.0 release and records its approved SHA-256. A release is ready only after the checkpoint architecture matches the manifest and its exact digest verifies. Missing, incompatible, or checksum-mismatched files keep readiness unavailable. Model files matching `services/vision/checkpoints/*.pth` are configured for Git LFS for future versions; no existing history is rewritten.

## Persistence

The API persists to PostgreSQL through SQLAlchemy 2 (async) and Alembic. `SCRAPTRACE_DATABASE_URL` is required, and startup stops with a message naming it when it is missing. Start a local database, migrate, and optionally seed demonstration data:

```bash
export SCRAPTRACE_LOCAL_POSTGRES_PASSWORD='<local-only value>'
npm run api:db:up
export SCRAPTRACE_DATABASE_URL="postgresql+asyncpg://scraptrace:${SCRAPTRACE_LOCAL_POSTGRES_PASSWORD}@127.0.0.1:55432/scraptrace"
npm run api:db:migrate
SCRAPTRACE_SEED_DEMO_PASSWORD='<at least 12 characters>' npm run api:db:seed
```

See [database and migrations](docs/database.md) for the schema, integrity rules, transactions, seeding and test-database strategy.

## Run

Run `npm run api:dev` with defaults. Use `apps/api/.env.example` as the environment-variable reference and export any overrides in the shell before starting the process.

Configuration is read from `SCRAPTRACE_*` environment variables. CPU is the default runtime. Set an explicit list of frontend origins; wildcard CORS is rejected in production. The application loads and verifies one model instance during FastAPI lifespan startup.

```bash
curl http://localhost:8000/health/live
curl http://localhost:8000/health/ready

TOKEN=$(curl -s -X POST http://localhost:8000/v1/auth/sessions \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"collector.demo\",\"password\":\"$SCRAPTRACE_SEED_DEMO_PASSWORD\"}" \
  | python -c 'import json,sys; print(json.load(sys.stdin)["data"]["access_token"])')

curl -X POST http://localhost:8000/v1/vision/appraise \
  -H "Authorization: Bearer $TOKEN" \
  -H 'X-Request-ID: demo-request-0001' \
  -F 'image=@sample.jpg' \
  -F 'evidence_id=0199a111-1111-7111-8111-111111111111'
```

## Authentication and authorisation

`SCRAPTRACE_AUTH_TOKEN_SECRET` is required. `POST /v1/auth/sessions` verifies an Argon2id password hash and issues a 30-minute access token, returned in the body for API clients and set as an HttpOnly cookie for browsers. `DELETE /v1/auth/sessions/current` revokes every earlier token. Every route enforces the contract permission matrix and programme, facility, ownership and review scope in the service layer. Vision appraisal requires authentication by default and always in production; health routes stay public. See [security controls](docs/security.md).

`evidence_id` and form-level `request_id` are optional transport metadata. The shared `VisionAppraisalRequest` is a JSON domain contract and does not represent a multipart body; the frontend adapter combines its required evidence ID with an image upload. A successful response is the exact `VisionAppraisalResponse`, and the correlation ID is returned in the `X-Request-ID` header because the success contract has no request-ID field.

## Validation and confidence

Responses are validated at runtime and in tests against `packages/contracts/schemas/vision_appraisal_response.schema.json`, generated from the canonical TypeScript/Zod contract. Standard failures use `error_envelope.schema.json` and stable ScrapTrace codes.

`SCRAPTRACE_CONFIDENCE_THRESHOLD` controls the minimum accepted top score. `SCRAPTRACE_AMBIGUITY_MARGIN` rejects predictions whose two leading scores are too close. Either condition returns `unable_to_classify` with `reason: low_confidence` and all seven scores so the UI can require manual confirmation. Thresholds must be reviewed against validation data before field use.

## Upload security

The endpoint limits upload bytes, only accepts JPEG/PNG/WebP, verifies decoded format rather than trusting MIME type or filename, rejects empty/truncated/unreadable and decompression-bomb images, caps dimensions and pixels, applies EXIF orientation, converts to RGB, and discards metadata. Uploads are read only for the request and are closed without permanent storage. Logs contain correlation, timing, outcome, and model metadata but never image bytes, filenames, or EXIF data.

Synchronous PyTorch inference runs outside the event loop with a timeout and bounded concurrency. Busy, unavailable, and timeout states return safe retryable errors. `/health/ready` performs no repeated inference; it reports the startup integrity and load state.

## Checks

```bash
npm run api:format:check
npm run api:lint
npm run api:typecheck
npm run api:test
npm run vision:predict -- sample.jpg
```

The real-checkpoint smoke test skips when the release file or digest is absent. All other API tests use an in-memory predictor. OpenAPI is available at `/openapi.json` and documents the multipart request, standard errors, limits, and classifier-only behavior.

## Frontend connection

Set the browser-safe values in `apps/web/.env.local`:

```text
NEXT_PUBLIC_API_MODE=http
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

No backend secret belongs in a `NEXT_PUBLIC_*` variable. The existing mock service remains the development default. The HTTP adapter uses `FormData`, parses success with `VisionAppraisalResponseSchema`, and normalizes standard errors.

## Scope and future work

The API does not store evidence, persist records, estimate prices, generate safety guidance, provide authentication, perform object detection, or run ONNX in the browser. Offline ONNX inference remains a future milestone and must preserve model-version, threshold, and contract behavior. Before production or new model deployment, pin the dataset/framework lineage in the manifest, complete licensing review, calibrate thresholds on field data, and publish a signed evaluation/model card.
