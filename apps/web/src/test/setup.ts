import "@testing-library/jest-dom/vitest";

import { toHaveNoViolations } from "jest-axe";
import { afterAll, afterEach, beforeAll } from "vitest";
import { expect } from "vitest";

import { mockServer } from "./test-server";

expect.extend(toHaveNoViolations);

/**
 * jsdom does not implement the modal dialog methods, so a component that opens a native `<dialog>`
 * would throw during a test. These stand-ins toggle the `open` attribute and fire `close`, which is
 * the behaviour the components rely on.
 */
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(
    this: HTMLDialogElement,
    returnValue?: string,
  ) {
    this.open = false;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event("close"));
  };
}

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());
