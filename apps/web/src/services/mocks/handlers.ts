import { http, HttpResponse } from "msw";

import { createRecoveryRecordFixture } from "./deterministic-fixtures";

export const mockHandlers = [
  http.get("*/v1/recovery-records", () => HttpResponse.json([createRecoveryRecordFixture()])),
];
