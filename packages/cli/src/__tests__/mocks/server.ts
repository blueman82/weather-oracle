/**
 * MSW server setup for Node.js integration tests.
 */

import { setupServer } from "msw/node";
import { handlers, resetMockState } from "./handlers";

/**
 * Create MSW server instance with default handlers
 */
export const server = setupServer(...handlers);

/**
 * Setup function to be called before all tests
 */
export function setupMswServer(): void {
  // Start server before all tests
  server.listen({
    onUnhandledRequest: "warn",
  });
}

/**
 * Reset function to be called after each test
 */
export function resetMswServer(): void {
  // Reset handlers to defaults
  server.resetHandlers();
  // Reset our mock state
  resetMockState();
}

/**
 * Cleanup function to be called after all tests
 */
export function teardownMswServer(): void {
  server.close();
}

// Re-export mock utilities for convenience
export {
  setModelFailure,
  setGeocodingFailure,
  setNetworkDelay,
  getRequestLog,
  clearRequestLog,
  resetMockState,
} from "./handlers";
