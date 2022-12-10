import { HomebridgeHomeWizardEnergySocket } from './platform';
import { TxtRecord } from './api/types';
import { vi } from 'vitest';

vi.mock('bonjour-service');

describe('platform', () => {
  it('should return true if api_enabled is "1"', () => {
    const txtRecordMock = {
      api_enabled: '1',
    } as TxtRecord;

    expect(HomebridgeHomeWizardEnergySocket.prototype.isDeviceApiEnabled(txtRecordMock)).toBe(true);
  });

  it('should return false if api_enabled is not "1"', () => {
    const txtRecordMock = {
      api_enabled: '0',
    } as TxtRecord;

    expect(HomebridgeHomeWizardEnergySocket.prototype.isDeviceApiEnabled(txtRecordMock)).toBe(
      false,
    );
  });

  it('should return true if product_type is "HWE-SKT"', () => {
    const txtRecordMock = {
      product_type: 'HWE-SKT',
    } as TxtRecord;

    expect(
      HomebridgeHomeWizardEnergySocket.prototype.isDeviceProductTypeSupported(txtRecordMock),
    ).toBe(true);
  });

  it('should return false if product_type is not "HWE-SKT"', () => {
    const txtRecordMock = {
      product_type: 'something-else',
    } as TxtRecord;

    expect(
      HomebridgeHomeWizardEnergySocket.prototype.isDeviceProductTypeSupported(txtRecordMock),
    ).toBe(false);
  });
});
