import {
  DefaultBodyType,
  PathParams,
  ResponseComposition,
  rest,
  RestContext,
  RestRequest,
} from 'msw';
import { mockBasicInformationResponse } from '@/api/mocks/data/basic';
import { mockIdentifyResponse } from '@/api/mocks/data/identify';
import { mockStateResponse } from '@/api/mocks/data/state';
import { mockPort, mockIp } from '@/api/mocks/api-url';
import { HomeWizardApiStatePutParams, HomeWizardApiStateResponse } from '@/api/types';

/**
 * Little helper method so we don't have to repeat ourselves.
 */
export const mwsResponseResolver =
  <T extends object>(data: T) =>
  (
    _req: RestRequest<never, PathParams<string>>,
    res: ResponseComposition<DefaultBodyType>,
    ctx: RestContext,
  ) => {
    return res(ctx.json<T>(data));
  };

export const handlers = [
  rest.get(`http://${mockIp}:${mockPort}/api`, mwsResponseResolver(mockBasicInformationResponse)),
  rest.get(`http://${mockIp}:${mockPort}/api/v1/state`, mwsResponseResolver(mockStateResponse)),
  rest.put(
    `http://${mockIp}:${mockPort}/api/v1/state`,
    async (
      req: RestRequest<never, PathParams<string>>,
      res: ResponseComposition<DefaultBodyType>,
      ctx: RestContext,
    ) => {
      const params = await req.json<HomeWizardApiStatePutParams>();

      // mock a state update
      const updatedState = {
        ...mockStateResponse,
        ...params,
      };

      return res(ctx.json<HomeWizardApiStateResponse>(updatedState));
    },
  ),
  rest.put(
    `http://${mockIp}:${mockPort}/api/v1/identify`,
    mwsResponseResolver(mockIdentifyResponse),
  ),
];
