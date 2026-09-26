import "@testing-library/jest-dom/vitest";

import { toHaveNoViolations } from "jest-axe";
import { afterAll, afterEach, beforeAll } from "vitest";
import { expect } from "vitest";

import { mockServer } from "./test-server";

expect.extend(toHaveNoViolations);

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());
