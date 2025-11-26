/**
 * MSW server setup for Web API integration tests.
 */

import { setupServer } from "msw/node";
import { handlers, resetMockState } from "./handlers";

export const server = setupServer(...handlers);

export function setupMswServer(): void {
  server.listen({ onUnhandledRequest: "warn" });
}

export function resetMswServer(): void {
  server.resetHandlers();
  resetMockState();
}

export function teardownMswServer(): void {
  server.close();
}

export { setModelFailure, setGeocodingFailure, resetMockState } from "./handlers";
