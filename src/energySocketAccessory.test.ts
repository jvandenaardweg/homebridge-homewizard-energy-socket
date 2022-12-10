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
} from './tests/mocks/platform';
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

  it('should set the required characteristics when invoking setAsyncRequiredCharacteristic', async () => {
    mockApiPool
      .intercept({
        path: '/api',
        method: 'GET',
      })
      .reply(() => ({
        data: mockBasicInformationResponse,
        statusCode: 200,
      }));

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock);

    // Clear the mocks, we want to start capturing the calls from the setAsyncRequiredCharacteristic method
    vi.clearAllMocks();

    expect(await energySocketAccessory.setAsyncRequiredCharacteristic()).toStrictEqual(
      mockBasicInformationResponse,
    );

    const model = energySocketAccessory.getModel(
      mockBasicInformationResponse.product_name,
      mockBasicInformationResponse.product_type,
    );

    const serialNumber = mockBasicInformationResponse.serial;
    const firmwareRevision = mockBasicInformationResponse.firmware_version;

    expect(mockSetCharacteristics).toHaveBeenCalledTimes(3);
    expect(mockSetCharacteristics).toHaveBeenNthCalledWith(1, 'Model', model);
    expect(mockSetCharacteristics).toHaveBeenNthCalledWith(2, 'SerialNumber', serialNumber);
    expect(mockSetCharacteristics).toHaveBeenNthCalledWith(3, 'FirmwareRevision', firmwareRevision);
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

    energySocketAccessory.setLocalStateResponse({
      power_on: !mockPowerOn,
      switch_lock: false,
      brightness: 0,
    });

    expect(energySocketAccessory.handleSetOn(mockPowerOn)).resolves.toStrictEqual(mockResponse);
  });

  it('should throw an error when handleSetOn is invoked when switch_lock = true', async () => {
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

    const handleAccessoryApiErrorSpy = vi.spyOn(
      EnergySocketAccessory.prototype,
      'handleAccessoryApiError',
    );

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock);

    energySocketAccessory.setLocalStateResponse({
      power_on: !mockPowerOn,
      switch_lock: true,
      brightness: 0,
    });

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
