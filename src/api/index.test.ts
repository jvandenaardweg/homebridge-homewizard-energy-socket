import { HomeWizardApi } from "./index";
import { loggerMock } from "../tests/mocks/logger";
import { mockBasicInformationResponse } from "./mocks/data/basic";
import { mockStateResponse } from "./mocks/data/state";
import { mockIdentifyResponse } from "./mocks/data/identify";
import { mockApiUrl } from "./mocks/api-url";

const mockLoggerPrefix = "test logger prefix";

describe("HomeWizardApi", () => {
  it("should be able to create a new instance", () => {
    const homeWizardApi = new HomeWizardApi(
      mockApiUrl,
      mockLoggerPrefix,
      loggerMock
    );
    expect(homeWizardApi).toBeTruthy();
  });

  it('should GET the "basic" endpoint', async () => {
    const homeWizardApi = new HomeWizardApi(
      mockApiUrl,
      mockLoggerPrefix,
      loggerMock
    );

    const basicInformation = await homeWizardApi.getBasicInformation();

    expect(basicInformation).toStrictEqual(mockBasicInformationResponse);
  });

  it('should GET the "state" endpoint', async () => {
    const homeWizardApi = new HomeWizardApi(
      mockApiUrl,
      mockLoggerPrefix,
      loggerMock
    );

    const state = await homeWizardApi.getState();

    expect(state).toStrictEqual(mockStateResponse);
  });

  it('should PUT the "state" endpoint', async () => {
    const homeWizardApi = new HomeWizardApi(
      mockApiUrl,
      mockLoggerPrefix,
      loggerMock
    );

    const updatedPowerOn = true;

    const state = await homeWizardApi.putState({
      power_on: updatedPowerOn,
    });

    expect(state.power_on).toBe(updatedPowerOn);
  });

  it('should PUT the "identify" endpoint', async () => {
    const homeWizardApi = new HomeWizardApi(
      mockApiUrl,
      mockLoggerPrefix,
      loggerMock
    );

    const firmwareVersion = 3;

    const identify = await homeWizardApi.putIdentify(firmwareVersion);

    expect(identify).toStrictEqual(mockIdentifyResponse);
  });

  it('should error when firmware version on PUT "identify" endpoint is too low', async () => {
    const homeWizardApi = new HomeWizardApi(
      mockApiUrl,
      mockLoggerPrefix,
      loggerMock
    );

    const firmwareVersion = 2;

    const identifyFn = async () => homeWizardApi.putIdentify(firmwareVersion);

    expect(identifyFn()).rejects.toThrow(
      "Cannot identify, this Energy Socket uses firmware version 2. But the identify feature is only available on Energy Sockets with firmware version 3.00 or later"
    );
  });
});
