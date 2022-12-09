import { mockApiAgent } from './src/api/mocks/index';
import { setGlobalDispatcher } from 'undici';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

beforeAll(() => {
  setGlobalDispatcher(mockApiAgent);
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  await mockApiAgent.close();
});
