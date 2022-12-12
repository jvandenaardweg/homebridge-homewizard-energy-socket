import { HomeWizardApi } from './api';
import { loggerMock } from '../mocks/logger';
import { mockBasicInformationResponse } from './mocks/data/basic';
import { mockStateResponse } from './mocks/data/state';
import { mockIdentifyResponse } from './mocks/data/identify';
import { mockApiUrl } from './mocks/api';
import { Interceptable, MockAgent, setGlobalDispatcher } from 'undici';
import { HomeWizardApiStateResponse, HomeWizardDeviceTypes } from './types';
import { mockEnergySocketDataResponse, mockP1MeterDataResponse } from './mocks/data/data';

const newApi = () => {
  return new HomeWizardApi(mockApiUrl, {
    logger: loggerMock,
  });
};

let mockApiAgent: MockAgent;
let mockApiPool: Interceptable;

describe('HomeWizardApi', () => {
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
  });

  it('should be able to create a new instance', () => {
    const homeWizardApi = newApi();

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

    const homeWizardApi = newApi();
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

    const homeWizardApi = newApi();
    const responseFn = () => homeWizardApi.getBasicInformation();

    expect(responseFn()).rejects.toThrowError(
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

    const homeWizardApi = newApi();
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

    const homeWizardApi = newApi();
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

    const homeWizardApi = newApi();
    const responseFn = () => homeWizardApi.getState();

    expect(responseFn()).rejects.toThrowError(
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

    const homeWizardApi = newApi();
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

    const homeWizardApi = newApi();

    const responseFn = () =>
      homeWizardApi.putState({
        power_on: true,
      });

    expect(responseFn()).rejects.toThrowError(
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

    const homeWizardApi = newApi();
    const firmwareVersion = 3;

    const identify = await homeWizardApi.putIdentify(firmwareVersion);

    expect(identify).toStrictEqual(mockIdentifyResponse);
  });

  it('should throw an error when PUT the "identify" endpoint returns a server error', async () => {
    mockApiPool
      .intercept({
        path: `/api/v1/identify`,
        method: 'PUT',
      })
      .reply(() => ({
        data: 'Server error!',
        statusCode: 500,
      }));

    const homeWizardApi = newApi();
    const responseFn = () => homeWizardApi.putIdentify(3);

    expect(responseFn()).rejects.toThrowError(
      'Api PUT call at http://localhost/api/v1/identify failed with status 500 and response data: Server error!',
    );
  });

  it('should error when firmware version on PUT "identify" endpoint is too low', async () => {
    const homeWizardApi = newApi();
    const firmwareVersion = 2;

    const identifyFn = async () => homeWizardApi.putIdentify(firmwareVersion);

    expect(identifyFn()).rejects.toThrow(
      'Cannot identify this Energy Socket. Firmware version is 2. But the identify feature is only available on Energy Sockets with firmware version 3.00 or later.',
    );
  });

  it('should error when firmware version on PUT "identify" endpoint is null', async () => {
    const homeWizardApi = newApi();
    const firmwareVersion = null;

    const identifyFn = async () => homeWizardApi.putIdentify(firmwareVersion);

    expect(identifyFn()).rejects.toThrow(
      'Cannot identify this Energy Socket. The firmware version is not set.',
    );
  });

  it('should error when firmware version on PUT "identify" endpoint is 0', async () => {
    const homeWizardApi = newApi();
    const firmwareVersion = 0;

    const identifyFn = async () => homeWizardApi.putIdentify(firmwareVersion);

    expect(identifyFn()).rejects.toThrow(
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

    const homeWizardApi = newApi();
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

    const homeWizardApi = newApi();
    const data = await homeWizardApi.getData(HomeWizardDeviceTypes.WIFI_PI_METER);

    expect(data).toStrictEqual(mockP1MeterDataResponse);
  });
});
