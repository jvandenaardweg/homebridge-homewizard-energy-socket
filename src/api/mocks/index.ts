import { MockAgent } from 'undici';
import { HomeWizardApiStatePutParams } from '../types';

import { mockBasicInformationResponse } from './data/basic';
import { mockIdentifyResponse } from './data/identify';
import { mockStateResponse } from './data/state';

export const mockApiUrl = 'http://localhost';
export const mockApiPath = '/api/v1';
export const mockIp = '127.0.0.1';
export const mockPort = 80;

export const mockAgent = new MockAgent({
  keepAliveTimeout: 10, // milliseconds
  keepAliveMaxTimeout: 10, // milliseconds
});

mockAgent.disableNetConnect(); // prevent actual requests to the api

const mockPool = mockAgent.get(mockApiUrl);

mockPool
  .intercept({
    path: '/api',
    method: 'GET',
  })
  .reply(() => ({
    data: mockBasicInformationResponse,
    statusCode: 200,
  }));

mockPool
  .intercept({
    path: `${mockApiPath}/state`,
    method: 'GET',
  })
  .reply(() => ({
    data: mockStateResponse,
    statusCode: 200,
  }));

mockPool
  .intercept({
    path: `${mockApiPath}/state`,
    method: 'PUT',
  })
  .reply(({ body }) => {
    if (!body) {
      return {
        statusCode: 400,
      };
    }

    const bodyParams = JSON.parse(body.toString()) as HomeWizardApiStatePutParams;

    const updatedStateResponse = {
      ...mockStateResponse,
      ...bodyParams,
    };

    return {
      data: updatedStateResponse,
      statusCode: 200,
    };
  });

mockPool
  .intercept({
    path: `${mockApiPath}/identify`,
    method: 'PUT',
  })
  .reply(() => ({
    data: mockIdentifyResponse,
    statusCode: 200,
  }));
