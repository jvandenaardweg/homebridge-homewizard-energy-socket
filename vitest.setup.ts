import { mockAgent } from './src/api/mocks/index';
import { setGlobalDispatcher } from 'undici';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

beforeAll(() => {
  setGlobalDispatcher(mockAgent);
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  await mockAgent.close();
});
