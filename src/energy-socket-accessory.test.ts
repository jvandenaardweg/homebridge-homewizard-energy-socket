import { EnergySocketApi } from 'homewizard-energy-api';
import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { expect } from 'vitest';
import { mockApiUrl, mockFirmwareVersion } from './api/mocks/api';
import { mockBasicInformationResponse } from './api/mocks/data/basic';
import { mockIdentifyResponse } from './api/mocks/data/identify';
import { mockStateResponse } from './api/mocks/data/state';
import { EnergySocketAccessory } from './energy-socket-accessory';
import { accessoryMock, platformMock } from './mocks/platform';

let mockApiAgent: MockAgent;
let mockApiPool: Interceptable;

let mockApi: EnergySocketApi;

describe('EnergySocketAccessory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
    vi.useRealTimers();
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
        path: `/api/v1/identify`,
        method: 'PUT',
      })
      .reply(() => ({
        data: mockIdentifyResponse,
        statusCode: 200,
      }));

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock, mockApi);

    await expect(energySocketAccessory.handleIdentify()).resolves.toStrictEqual(
      mockIdentifyResponse,
    );
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
        path: `/api/v1/state`,
        method: 'PUT',
      })
      .reply(() => ({
        data: mockResponse,
        statusCode: 200,
      }));

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock, mockApi);

    await expect(energySocketAccessory.handleSetOn(mockPowerOn)).resolves.toBeUndefined();
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
    vi.spyOn(EnergySocketAccessory.prototype, 'startStatePolling').mockImplementation(() => {
      return Promise.resolve();
    });

    mockApiPool
      .intercept({
        path: `/api/v1/state`,
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

    try {
      const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock, mockApi);

      const response = await energySocketAccessory.handleGetOn();

      expect(response).toStrictEqual(mockStateResponse.power_on);

      expect(setLocalStateResponseSpy).toHaveBeenCalledOnce();
      expect(setLocalStateResponseSpy).toHaveBeenLastCalledWith(mockStateResponse);
    } catch (error) {
      expect(error).toBeUndefined();
    }
  });

  it('should start polling state and update characteristics when state changes', async () => {
    // First poll response
    mockApiPool
      .intercept({
        path: `/api/v1/state`,
        method: 'GET',
      })
      .reply(() => ({
        data: { ...mockStateResponse, power_on: false },
        statusCode: 200,
      }));

    const setLocalStateResponseSpy = vi.spyOn(
      EnergySocketAccessory.prototype,
      'setLocalStateResponse',
    );

    const updateCurrentOnStateSpy = vi.spyOn(
      EnergySocketAccessory.prototype,
      'updateCurrentOnState',
    );

    const syncOutletInUseStateWithOnStateSpy = vi.spyOn(
      EnergySocketAccessory.prototype,
      'syncOutletInUseStateWithOnState',
    );

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock, mockApi);

    expect(energySocketAccessory).toBeDefined();

    // Wait for first poll
    await vi.advanceTimersByTimeAsync(1000);

    // Verify the local state response is set
    expect(setLocalStateResponseSpy).toHaveBeenCalledOnce();
    expect(setLocalStateResponseSpy).toHaveBeenLastCalledWith({
      ...mockStateResponse,
      power_on: false,
    });

    // Verify the characteristic is updated, it should be updated with false, which is the API response
    expect(updateCurrentOnStateSpy).toHaveBeenCalledOnce();
    expect(updateCurrentOnStateSpy).toHaveBeenLastCalledWith(false);

    expect(syncOutletInUseStateWithOnStateSpy).toHaveBeenCalledOnce();
    expect(syncOutletInUseStateWithOnStateSpy).toHaveBeenLastCalledWith(false);

    mockApiPool
      .intercept({
        path: `/api/v1/state`,
        method: 'GET',
      })
      .reply(() => ({
        data: { ...mockStateResponse, power_on: true },
        statusCode: 200,
      }));

    // Fast forward to the next poll
    await vi.advanceTimersByTimeAsync(1000);

    // API now returns true
    expect(setLocalStateResponseSpy).toHaveBeenCalledTimes(2);
    expect(setLocalStateResponseSpy).toHaveBeenLastCalledWith({
      ...mockStateResponse,
      power_on: true,
    });

    // Verify the characteristic is updated, it should be updated with true, which is the API response
    expect(updateCurrentOnStateSpy).toHaveBeenCalledTimes(2);
    expect(updateCurrentOnStateSpy).toHaveBeenLastCalledWith(true);

    expect(syncOutletInUseStateWithOnStateSpy).toHaveBeenCalledTimes(2);
    expect(syncOutletInUseStateWithOnStateSpy).toHaveBeenLastCalledWith(true);
  });

  it('should stop polling when stopStatePolling is called', async () => {
    // Setup the API mock before creating spy
    mockApiPool
      .intercept({
        path: `/api/v1/state`,
        method: 'GET',
      })
      .reply(() => ({
        data: mockStateResponse,
        statusCode: 200,
      }));

    const energySocketAccessory = new EnergySocketAccessory(platformMock, accessoryMock, mockApi);

    // Create spy after the accessory is instantiated
    const getStateSpy = vi.spyOn(mockApi, 'getState');

    // Stop polling
    energySocketAccessory.stopStatePolling();

    // Advance time
    await vi.advanceTimersByTimeAsync(2000);

    // Verify no more polls occurred after stopping
    expect(getStateSpy).not.toHaveBeenCalled();
  });
});
