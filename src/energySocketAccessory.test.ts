import { EnergySocketAccessory } from './energySocketAccessory';
import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { mockApiPath, mockApiUrl } from './api/mocks';
import { mockIdentifyResponse } from './api/mocks/data/identify';
import { mockBasicInformationResponse } from './api/mocks/data/basic';
import {
  accessoryMock,
  mockFirmwareRevision,
  mockSetCharacteristics,
  platformMock,
} from './mocks/platform';
import { mockStateResponse } from './api/mocks/data/state';

let mockApiAgent: MockAgent;
let mockApiPool: Interceptable;

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

    // Endpoint will be called when creating a new instance
    // So we mock it every time
    mockApiPool
      .intercept({
        path: `/api`,
        method: 'GET',
      })
      .reply(() => ({
        data: mockBasicInformationResponse,
        statusCode: 200,
      }));
  });

  afterEach(async () => {
    await mockApiAgent.close();
    vi.restoreAllMocks();
  });

  it('should create an instance', () => {
    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock);

    expect(energySocketAccessory).toBeTruthy();
  });

  it('should get the firmware version as a number value', () => {
    const firmwareVersion = new EnergySocketAccessory(platformMock, accessoryMock).firmwareVersion;

    expect(firmwareVersion).toBe(Number(mockFirmwareRevision));
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

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock);

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

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock);

    try {
      await energySocketAccessory.handleIdentify();
    } catch (err) {
      expect(handleAccessoryApiErrorSpy).toHaveBeenCalledTimes(1);
    }
  });

  it('should invoke setAsyncCharacteristics when creating a new instance', async () => {
    const setAsyncCharacteristicsSpy = vi.spyOn(
      EnergySocketAccessory.prototype,
      'setAsyncCharacteristics',
    );

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock);

    expect(energySocketAccessory).toBeTruthy();

    expect(setAsyncCharacteristicsSpy).toHaveBeenCalledOnce();
  });

  it('should set the required characteristics when invoking setAsyncFirmwareVersion', async () => {
    mockApiPool
      .intercept({
        path: '/api',
        method: 'GET',
      })
      .reply(() => ({
        data: mockBasicInformationResponse,
        statusCode: 200,
      }));

    EnergySocketAccessory.prototype.setAsyncCharacteristics = vi.fn();

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock);

    // Clear the mocks, we want to start capturing the calls from the setAsyncFirmwareVersion method
    vi.clearAllMocks();

    const result = await energySocketAccessory.setAsyncFirmwareVersion();

    expect(result).toStrictEqual(mockBasicInformationResponse);

    const firmwareRevision = mockBasicInformationResponse.firmware_version;

    // TODO: fix this part, should only be called once
    // expect(mockSetCharacteristics).toHaveBeenCalledOnce();
    expect(mockSetCharacteristics).toHaveBeenCalledWith('FirmwareRevision', firmwareRevision);
  });

  it('should return the API response when handleSetOn is invoked with a boolean value and switch_lock = false', async () => {
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

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock);

    expect(energySocketAccessory.handleSetOn(mockPowerOn)).resolves.toStrictEqual(mockResponse);
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

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock);

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

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock);

    const response = await energySocketAccessory.handleGetOn();

    expect(response).toStrictEqual(mockStateResponse.power_on);

    expect(setLocalStateResponseSpy).toHaveBeenCalledOnce();
    expect(setLocalStateResponseSpy).toHaveBeenCalledWith(mockStateResponse);
  });
});
