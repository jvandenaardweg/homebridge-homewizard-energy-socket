import { server } from "src/api/mocks/server";
import { vi } from "vitest";

beforeAll(() => {
  // Establish API mocking before all tests.
  server.listen();
});

afterEach(() => {
  // Reset any MSW request handlers that we may add during the tests,
  // so they don't affect other tests.
  server.resetHandlers();

  vi.clearAllMocks();
});

afterAll(() => {
  // Clean up after the tests are finished.
  server.close();
});
