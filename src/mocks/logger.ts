import { Logger } from 'homebridge';
import { vi } from 'vitest';

export const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
} satisfies Logger;
