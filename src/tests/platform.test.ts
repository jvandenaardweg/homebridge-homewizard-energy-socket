import { HomebridgeAPI } from "homebridge/lib/api";
import { HomebridgeHomeWizardEnergySocket } from "../platform";
import { PLATFORM_NAME } from "../settings";
import { TxtRecord } from "../types";

jest.mock("bonjour-service");

// mock the logger parameter
const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  log: jest.fn(),
};

// mock the config parameter
const configMock = {
  platform: PLATFORM_NAME,
};

const apiMock = new HomebridgeAPI();

const platform = new HomebridgeHomeWizardEnergySocket(
  loggerMock,
  configMock,
  apiMock
);

describe("platform", () => {
  it('should return true if api_enabled is "1"', () => {
    const txtRecordMock = {
      api_enabled: "1",
    } as TxtRecord;

    expect(platform.isDeviceApiEnabled(txtRecordMock)).toBe(true);
  });

  it('should return false if api_enabled is not "1"', () => {
    const txtRecordMock = {
      api_enabled: "0",
    } as TxtRecord;

    expect(platform.isDeviceApiEnabled(txtRecordMock)).toBe(false);
  });

  it('should return true if product_type is "HWE-SKT"', () => {
    const txtRecordMock = {
      product_type: "HWE-SKT",
    } as TxtRecord;

    expect(platform.isDeviceProductTypeSupported(txtRecordMock)).toBe(true);
  });

  it('should return false if product_type is not "HWE-SKT"', () => {
    const txtRecordMock = {
      product_type: "something-else",
    } as TxtRecord;

    expect(platform.isDeviceProductTypeSupported(txtRecordMock)).toBe(false);
  });
});
