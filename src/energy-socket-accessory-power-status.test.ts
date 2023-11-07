import { EnergySocketAccessoryPowerStatus } from './energy-socket-accessory-power-status';
import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { mockApiUrl, mockFirmwareVersion } from './api/mocks/api';
import { mockIdentifyResponse } from './api/mocks/data/identify';
import { mockBasicInformationResponse } from './api/mocks/data/basic';
import { accessoryMock, platformMock } from './mocks/platform';
import { mockStateResponse } from './api/mocks/data/state';
import { EnergySocketApi } from 'homewizard-energy-api';

let mockApiAgent: MockAgent;
let mockApiPool: Interceptable;

let mockApi: EnergySocketApi;

describe('EnergySocketAccessoryPowerStatus', () => {
  beforeEach(() => {
    mockApiAgent = new MockAgent({
      bodyTimeout: 10,
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10,
    });

    mockApiAgent.disableNetConnect();

    setGlobalDispatcher(mockApiAgent);

    mockApiPool = mockApiAgent.get(mockApiUrl);

    mockApi = new EnergySocketApi(mockApiUrl);
  });

  afterEach(async () => {
    await mockApiAgent.close();
    vi.restoreAllMocks();
  });

  it('should create an instance', () => {
    const energySocketAccessoryPowerStatus = new EnergySocketAccessoryPowerStatus(platformMock, accessoryMock, mockApi);

    expect(energySocketAccessoryPowerStatus).toBeTruthy();
  });

  it('should get the firmware version as a number value', () => {
    const firmwareVersion = new EnergySocketAccessoryPowerStatus(platformMock, accessoryMock, mockApi)
      .firmwareVersion;

    expect(firmwareVersion).toBe(Number(mockFirmwareVersion));
  });

  it('should get a response from the identify endpoint', async () => {
    mockApiPool
      .intercept({
        path: `/api/v1/identify`,
        method: 'PUT',
      })
      .reply(() => ({
        data: mockIdentifyResponse,
        statusCode: 200,
      }));

    const energySocketAccessoryPowerStatus = new EnergySocketAccessoryPowerStatus(platformMock, accessoryMock, mockApi);

    expect(energySocketAccessoryPowerStatus.handleIdentify()).resolves.toStrictEqual(mockIdentifyResponse);
  });

  it('should call handleAccessoryApiError when an error happens on handleIdentify', async () => {
    mockApiPool
      .intercept({
        path: `/api/v1/identify`,
        method: 'PUT',
      })
      .reply(() => ({
        data: 'Server error!',
        statusCode: 500,
      }));

    const handleAccessoryApiErrorSpy = vi.spyOn(
      EnergySocketAccessoryPowerStatus.prototype,
      'handleAccessoryApiError',
    );

    const energySocketAccessoryPowerStatus = new EnergySocketAccessoryPowerStatus(platformMock, accessoryMock, mockApi);

    try {
      await energySocketAccessoryPowerStatus.handleIdentify();
    } catch (err) {
      expect(handleAccessoryApiErrorSpy).toHaveBeenCalledTimes(1);
    }
  });

  it('should resolve when handleSetOn is invoked with a boolean value and switch_lock = false', async () => {
    const mockPowerOn = true;

    const energySocketAccessoryPowerStatus = new EnergySocketAccessoryPowerStatus(platformMock, accessoryMock, mockApi);

    expect(energySocketAccessoryPowerStatus.handleSetOn(mockPowerOn)).resolves.toBeUndefined();
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
      EnergySocketAccessoryPowerStatus.prototype,
      'handleAccessoryApiError',
    );

    const energySocketAccessoryPowerStatus = new EnergySocketAccessoryPowerStatus(platformMock, accessoryMock, mockApi);

    try {
      await energySocketAccessoryPowerStatus.handleSetOn(mockPowerOn);
    } catch (err) {
      expect(handleAccessoryApiErrorSpy).toHaveBeenCalledOnce();
    }
  });

  it('should return the power_on value when handleGetOn is invoked', async () => {
    const energySocketAccessoryPowerStatus = new EnergySocketAccessoryPowerStatus(platformMock, accessoryMock, mockApi);

    const response = await energySocketAccessoryPowerStatus.handleGetOn();

    expect(response).toStrictEqual(mockStateResponse.power_on);
  });
});
