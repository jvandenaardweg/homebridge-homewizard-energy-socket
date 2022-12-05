import { server } from "@/api/mocks/server";

beforeAll(() => {
  // Establish API mocking before all tests.
  server.listen();
});

afterEach(() => {
  // Reset any MSW request handlers that we may add during the tests,
  // so they don't affect other tests.
  server.resetHandlers();

  jest.clearAllMocks();
});

afterAll(() => {
  // Clean up after the tests are finished.
  server.close();
});
