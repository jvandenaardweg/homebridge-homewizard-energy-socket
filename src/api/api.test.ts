import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { loggerMock } from '../mocks/logger';
import { HomeWizardApi, HomeWizardApiError, HomeWizardApiResponseError } from './api';
import { mockApiUrl } from './mocks/api';
import { mockBasicInformationResponse } from './mocks/data/basic';
import { mockEnergySocketDataResponse, mockP1MeterDataResponse } from './mocks/data/data';
import { mockIdentifyResponse } from './mocks/data/identify';
import { mockStateResponse } from './mocks/data/state';
import { HomeWizardApiStateResponse, HomeWizardDeviceTypes } from './types';

let mockApiAgent: MockAgent;
let mockApiPool: Interceptable;
let homeWizardApi: HomeWizardApi;

describe('HomeWizardApi', () => {
  beforeEach(() => {
    homeWizardApi = new HomeWizardApi(mockApiUrl, {
      logger: loggerMock,
    });

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
  });

  it('should be able to create a new instance', () => {
    expect(homeWizardApi).toBeTruthy();
  });

  it('should GET the "basic" endpoint', async () => {
    mockApiPool
      .intercept({
        path: '/api',
        method: 'GET',
      })
      .reply(() => ({
        data: mockBasicInformationResponse,
        statusCode: 200,
      }));

    const basicInformation = await homeWizardApi.getBasicInformation();

    expect(basicInformation).toStrictEqual(mockBasicInformationResponse);
  });

  it('should throw an error when GET the "basic" endpoint returns a server error', async () => {
    mockApiPool
      .intercept({
        path: '/api',
        method: 'GET',
      })
      .reply(() => ({
        data: 'Server error!',
        statusCode: 500,
      }));

    const responseFn = () => homeWizardApi.getBasicInformation();

    await expect(responseFn()).rejects.toThrowError(
      'Api GET call at http://localhost/api failed with status 500 and response data: Server error!',
    );
  });

  it('should GET the "basic" endpoint', async () => {
    mockApiPool
      .intercept({
        path: '/api',
        method: 'GET',
      })
      .reply(() => ({
        data: mockBasicInformationResponse,
        statusCode: 200,
      }));

    const basicInformation = await homeWizardApi.getBasicInformation();

    expect(basicInformation).toStrictEqual(mockBasicInformationResponse);
  });

  it('should GET the "state" endpoint', async () => {
    mockApiPool
      .intercept({
        path: `/api/v1/state`,
        method: 'GET',
      })
      .reply(() => ({
        data: mockStateResponse,
        statusCode: 200,
      }));

    const state = await homeWizardApi.getState();

    expect(state).toStrictEqual(mockStateResponse);
  });

  it('should throw an error when GET the "state" endpoint returns a server error', async () => {
    mockApiPool
      .intercept({
        path: `/api/v1/state`,
        method: 'GET',
      })
      .reply(() => ({
        data: 'Server error!',
        statusCode: 500,
      }));

    const responseFn = () => homeWizardApi.getState();

    await expect(responseFn()).rejects.toThrowError(
      'Api GET call at http://localhost/api/v1/state failed with status 500 and response data: Server error!',
    );
  });

  it('should PUT the "state" endpoint', async () => {
    mockApiPool
      .intercept({
        path: `/api/v1/state`,
        method: 'PUT',
      })
      .reply(({ body }) => {
        if (!body) {
          return {
            statusCode: 400,
          };
        }

        const bodyParams = JSON.parse(body.toString()) as Partial<HomeWizardApiStateResponse>;

        const updatedStateResponse = {
          ...mockStateResponse,
          ...bodyParams,
        };

        return {
          data: updatedStateResponse,
          statusCode: 200,
        };
      });

    const updatedPowerOn = true;

    const state = await homeWizardApi.putState({
      power_on: updatedPowerOn,
    });

    expect(state.power_on).toBe(updatedPowerOn);
  });

  it('should throw an error on PUT when the "state" endpoint returns a server error', async () => {
    mockApiPool
      .intercept({
        path: `/api/v1/state`,
        method: 'PUT',
      })
      .reply(() => ({
        data: 'Server error!',
        statusCode: 500,
      }));

    const responseFn = () =>
      homeWizardApi.putState({
        power_on: true,
      });

    await expect(responseFn()).rejects.toThrowError(
      'Api PUT call at http://localhost/api/v1/state failed with status 500 and response data: Server error!',
    );
  });

  it('should PUT the "identify" endpoint', async () => {
    mockApiPool
      .intercept({
        path: `/api/v1/identify`,
        method: 'PUT',
      })
      .reply(() => ({
        data: mockIdentifyResponse,
        statusCode: 200,
      }));

    const firmwareVersion = 3;

    const identify = await homeWizardApi.putIdentify(firmwareVersion);

    expect(identify).toStrictEqual(mockIdentifyResponse);
  });

  it('should throw an error when PUT on the "identify" endpoint returns a server error', async () => {
    mockApiPool
      .intercept({
        path: `/api/v1/identify`,
        method: 'PUT',
      })
      .reply(() => ({
        data: 'Server error!',
        statusCode: 500,
      }));

    const responseFn = () => homeWizardApi.putIdentify(3);

    await expect(responseFn()).rejects.toThrowError(
      'Api PUT call at http://localhost/api/v1/identify failed with status 500 and response data: Server error!',
    );
  });

  it('should error when firmware version on PUT "identify" endpoint is too low', async () => {
    const firmwareVersion = 2;

    const identifyFn = async () => homeWizardApi.putIdentify(firmwareVersion);

    await expect(identifyFn()).rejects.toThrow(
      'Cannot identify this Energy Socket. Firmware version is 2. But the identify feature is only available on Energy Sockets with firmware version 3.00 or later.',
    );
  });

  it('should error when firmware version on PUT "identify" endpoint is null', async () => {
    const firmwareVersion = null;

    const identifyFn = async () => homeWizardApi.putIdentify(firmwareVersion);

    await expect(identifyFn()).rejects.toThrow(
      'Cannot identify this Energy Socket. The firmware version is not set.',
    );
  });

  it('should error when firmware version on PUT "identify" endpoint is 0', async () => {
    const firmwareVersion = 0;

    const identifyFn = async () => homeWizardApi.putIdentify(firmwareVersion);

    await expect(identifyFn()).rejects.toThrow(
      'Cannot identify this Energy Socket. The firmware version is not set.',
    );
  });

  it('should GET the "data" endpoint as an Energy Socket', async () => {
    mockApiPool
      .intercept({
        path: `/api/v1/data`,
        method: 'GET',
      })
      .reply(() => ({
        data: mockEnergySocketDataResponse,
        statusCode: 200,
      }));

    const data = await homeWizardApi.getData(HomeWizardDeviceTypes.WIFI_ENERGY_SOCKET);

    expect(data).toStrictEqual(mockEnergySocketDataResponse);
  });

  it('should GET the "data" endpoint as a P1 Meter', async () => {
    mockApiPool
      .intercept({
        path: `/api/v1/data`,
        method: 'GET',
      })
      .reply(() => ({
        data: mockP1MeterDataResponse,
        statusCode: 200,
      }));

    const data = await homeWizardApi.getData(HomeWizardDeviceTypes.WIFI_PI_METER);

    expect(data).toStrictEqual(mockP1MeterDataResponse);
  });

  it('should throw an error when the productType parameter has an unsupported product type', async () => {
    const dataFn = () => homeWizardApi.getData('SOME-THING' as never);

    await expect(dataFn()).rejects.toThrowError(
      'Product type "SOME-THING" is not supported for this API call.',
    );
  });

  it('should throw an error when GET on the "data" endpoint returns a server error', async () => {
    mockApiPool
      .intercept({
        path: `/api/v1/data`,
        method: 'GET',
      })
      .reply(() => ({
        data: 'Server error!',
        statusCode: 500,
      }));

    const dataFn = () => homeWizardApi.getData(HomeWizardDeviceTypes.WIFI_ENERGY_SOCKET);

    await expect(dataFn()).rejects.toThrowError(
      'Api GET call at http://localhost/api/v1/data failed with status 500 and response data: Server error!',
    );
  });

  it('should create a HomeWizardApiError instance', () => {
    const error = new HomeWizardApiError('Test error');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HomeWizardApiError);
    expect(error.message).toBe('Test error');

    expect(error.toString()).toBe('HomeWizardApiError: Test error');
  });

  it('should create a HomeWizardApiResponseError instance', () => {
    const error = new HomeWizardApiResponseError(
      'Test error',
      'http://localhost/api/v1/data',
      500,
      'Test response data',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HomeWizardApiResponseError);
    expect(error.message).toBe('Test error');
    expect(error.url).toBe('http://localhost/api/v1/data');
    expect(error.statusCode).toBe(500);
    expect(error.response).toBe('Test response data');

    expect(error.toString()).toBe('HomeWizardApiResponseError: Test error');
  });
});
