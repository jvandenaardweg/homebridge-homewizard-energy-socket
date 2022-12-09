// import { mockApiAgent, mockApiPool } from './src/api/mocks/index';
// import { setGlobalDispatcher } from 'undici';
import { afterAll, afterEach, vi } from 'vitest';

// beforeAll(() => {
//   setGlobalDispatcher(mockApiAgent);
// });

afterEach(() => {
  vi.clearAllMocks();

  // mockApiPool.destroy();
});

afterAll(() => {
  // await mockApiAgent.close();
});
