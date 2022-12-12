import { EnergySocketAccessory } from './energy-socket-accessory';
import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { mockApiPath, mockApiUrl, mockFirmwareVersion, mockSerialNumber } from './api/mocks/api';
import { mockIdentifyResponse } from './api/mocks/data/identify';
import { mockBasicInformationResponse } from './api/mocks/data/basic';
import { accessoryMock, platformMock } from './mocks/platform';
import { mockStateResponse } from './api/mocks/data/state';
import { HomeWizardApi } from './api';
import { loggerMock } from './mocks/logger';

let mockApiAgent: MockAgent;
let mockApiPool: Interceptable;

let mockApi: HomeWizardApi;

describe('EnergySocketAccessory', () => {
  beforeEach(() => {
    mockApiAgent = new MockAgent({
      bodyTimeout: 10,
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10,
    });

    mockApiAgent.disableNetConnect();

    setGlobalDispatcher(mockApiAgent);

    mockApiPool = mockApiAgent.get(mockApiUrl);

    mockApi = new HomeWizardApi(mockApiUrl, mockApiPath, mockSerialNumber, loggerMock);
  });

  afterEach(async () => {
    await mockApiAgent.close();
    vi.restoreAllMocks();
  });

  it('should create an instance', () => {
    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock, mockApi);

    expect(energySocketAccessory).toBeTruthy();
  });

  it('should get the firmware version as a number value', () => {
    const firmwareVersion = new EnergySocketAccessory(platformMock, accessoryMock, mockApi)
      .firmwareVersion;

    expect(firmwareVersion).toBe(Number(mockFirmwareVersion));
  });

  it('should get a response from the identify endpoint', async () => {
    mockApiPool
      .intercept({
        path: `${mockApiPath}/identify`,
        method: 'PUT',
      })
      .reply(() => ({
        data: mockIdentifyResponse,
        statusCode: 200,
      }));

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock, mockApi);

    expect(energySocketAccessory.handleIdentify()).resolves.toStrictEqual(mockIdentifyResponse);
  });

  it('should call handleAccessoryApiError when an error happens on handleIdentify', async () => {
    mockApiPool
      .intercept({
        path: `${mockApiPath}/identify`,
        method: 'PUT',
      })
      .reply(() => ({
        data: 'Server error!',
        statusCode: 500,
      }));

    const handleAccessoryApiErrorSpy = vi.spyOn(
      EnergySocketAccessory.prototype,
      'handleAccessoryApiError',
    );

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock, mockApi);

    try {
      await energySocketAccessory.handleIdentify();
    } catch (err) {
      expect(handleAccessoryApiErrorSpy).toHaveBeenCalledTimes(1);
    }
  });

  it('should resolve when handleSetOn is invoked with a boolean value and switch_lock = false', async () => {
    const mockPowerOn = true;
    const mockResponse = {
      power_on: mockPowerOn,
    };

    mockApiPool
      .intercept({
        path: `${mockApiPath}/state`,
        method: 'PUT',
      })
      .reply(() => ({
        data: mockResponse,
        statusCode: 200,
      }));

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock, mockApi);

    expect(energySocketAccessory.handleSetOn(mockPowerOn)).resolves.toBeUndefined();
  });

  it('should throw an error when handleSetOn is invoked when switch_lock = true', async () => {
    const mockPowerOn = true;

    mockApiPool
      .intercept({
        path: `/api`,
        method: 'GET',
      })
      .reply(() => ({
        data: mockBasicInformationResponse,
        statusCode: 200,
      }));

    const handleAccessoryApiErrorSpy = vi.spyOn(
      EnergySocketAccessory.prototype,
      'handleAccessoryApiError',
    );

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock, mockApi);

    try {
      await energySocketAccessory.handleSetOn(mockPowerOn);
    } catch (err) {
      expect(handleAccessoryApiErrorSpy).toHaveBeenCalledOnce();
    }
  });

  it('should return the power_on value when handleGetOn is invoked', async () => {
    mockApiPool
      .intercept({
        path: `${mockApiPath}/state`,
        method: 'GET',
      })
      .reply(() => ({
        data: mockStateResponse,
        statusCode: 200,
      }));

    const setLocalStateResponseSpy = vi.spyOn(
      EnergySocketAccessory.prototype,
      'setLocalStateResponse',
    );

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock, mockApi);

    const response = await energySocketAccessory.handleGetOn();

    expect(response).toStrictEqual(mockStateResponse.power_on);

    expect(setLocalStateResponseSpy).toHaveBeenCalledOnce();
    expect(setLocalStateResponseSpy).toHaveBeenCalledWith(mockStateResponse);
  });
});
