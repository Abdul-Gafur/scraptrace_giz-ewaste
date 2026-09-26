import { setupServer } from "msw/node";

import { mockHandlers } from "@/services/mocks/handlers";

export const mockServer = setupServer(...mockHandlers);
