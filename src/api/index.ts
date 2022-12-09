import { Logger } from 'homebridge';
import {
  HomeWizardApiBasicInformationResponse,
  HomeWizardApiIdentifyResponse,
  HomeWizardApiStatePutParams,
  HomeWizardApiStatePutResponse,
  HomeWizardApiStateResponse,
} from '@/api/types';
import { Dispatcher, request as undiciRequest } from 'undici';

type RequestArgs = Parameters<typeof undiciRequest>;

// Set a default timeout on all requests
const request = (...args: RequestArgs) =>
  undiciRequest(args[0], {
    ...args[1],
    bodyTimeout: 2000, // 2 seconds, we are on a local network, so all request should be fast
  });

export class HomeWizardApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HomeWizardApiError';
  }
}

/**
 * HomeWizard Energy API
 *
 * @link: https://homewizard-energy-api.readthedocs.io
 */
export class HomeWizardApi {
  private readonly log: Logger;
  private readonly url: string;
  private readonly path: string;
  private readonly serialNumber: string;

  constructor(url: string, path: string, serialNumber: string, logger: Logger) {
    this.log = logger;

    this.url = url;
    this.path = path;
    this.serialNumber = serialNumber;
  }

  get endpoints() {
    const { url, path } = this;

    return {
      basic: `${url}/api`,
      state: `${url}${path}/state`,
      identify: `${url}${path}/identify`,
    };
  }

  get loggerPrefix(): string {
    return `[Api] -> ${this.url} (${this.serialNumber}) -> `;
  }

  isResponseOk(response: Dispatcher.ResponseData): boolean {
    return response.statusCode >= 200 && response.statusCode < 300;
  }

  async throwApiError(
    url: string,
    method: string,
    response: Dispatcher.ResponseData,
  ): Promise<never> {
    const text = await response.body.text();

    throw new HomeWizardApiError(
      `Api ${method.toUpperCase()} call at ${url} failed, with status ${
        response.statusCode
      } and response data: ${text}`,
    );
  }

  /**
   * Returns basic information from the device.
   *
   * Your application can use this endpoint to see if your integration is designed to work with this version of the API.
   * You can validate your support based on the combination of product_type and api_version.
   * Datapoints in this endpoint that are currently available won’t change, but make sure your application can accept new datapoints for future updates.
   *
   * @link https://homewizard-energy-api.readthedocs.io/endpoints.html#basic-information-api
   */
  async getBasicInformation(): Promise<HomeWizardApiBasicInformationResponse> {
    const url = this.endpoints.basic;

    this.log.debug(this.loggerPrefix, `Fetching the basic information at ${url}`);

    const method = 'GET';
    const response = await request(url, {
      method,
    });

    if (!this.isResponseOk(response)) {
      return this.throwApiError(url, method, response);
    }

    const data = (await response.body.json()) as HomeWizardApiBasicInformationResponse;

    this.log.debug(this.loggerPrefix, `Fetched basic information: ${JSON.stringify(data)}`);

    return data;
  }

  /**
   * Returns the actual state of the Energy Socket. This endpoint is only available for the HWE-SKT.
   *
   * @link https://homewizard-energy-api.readthedocs.io/endpoints.html#state-api-v1-state
   */
  async getState(): Promise<HomeWizardApiStateResponse> {
    const url = this.endpoints.state;

    this.log.debug(this.loggerPrefix, `Fetching the state at ${url}`);

    const method = 'GET';
    const response = await request(url, {
      method,
    });

    if (!this.isResponseOk(response)) {
      return this.throwApiError(url, method, response);
    }

    const data = (await response.body.json()) as HomeWizardApiStateResponse;

    this.log.info(this.loggerPrefix, `Energy Socket state is ${data.power_on ? 'ON' : 'OFF'}`);

    return data;
  }

  /**
   * Control the state of the Energy Socket. This endpoint is only available for the HWE-SKT.
   *
   * @link https://homewizard-energy-api.readthedocs.io/endpoints.html#state-api-v1-state
   */
  async putState(params: HomeWizardApiStatePutParams): Promise<HomeWizardApiStatePutResponse> {
    const url = this.endpoints.state;

    this.log.debug(
      this.loggerPrefix,
      `Setting the state to ${JSON.stringify(params)} at ${this.endpoints.state}`,
    );

    const method = 'PUT';
    const response = await request(this.endpoints.state, {
      method,
      body: JSON.stringify(params),
    });

    if (!this.isResponseOk(response)) {
      return this.throwApiError(url, method, response);
    }

    const data = (await response.body.json()) as HomeWizardApiStatePutResponse;

    this.log.debug(
      this.loggerPrefix,
      `Energy Socket state is updated to ${data.power_on ? 'ON' : 'OFF'}`,
    );

    return data;
  }

  /**
   * The /api/v1/identify endpoint can be used to let the user identify the device. The status light will blink for a few seconds after calling this endpoint.
   *
   * This feature is currently only available for HWE-SKT running firmware version 3.00 or later.
   *
   * @link https://homewizard-energy-api.readthedocs.io/endpoints.html#identify-api-v1-identify
   */
  async putIdentify(firmwareVersion: number | null): Promise<HomeWizardApiIdentifyResponse> {
    if (!firmwareVersion) {
      throw new HomeWizardApiError(
        'Cannot identify this Energy Socket. The firmware version is not set.',
      );
    }

    // Check the required firmware version, otherwise we cannot identify the device
    if (firmwareVersion < 3) {
      throw new HomeWizardApiError(
        `Cannot identify this Energy Socket. Firmware version is ${firmwareVersion}. But the identify feature is only available on Energy Sockets with firmware version 3.00 or later.`,
      );
    }

    const url = this.endpoints.identify;

    this.log.debug(this.loggerPrefix, `Fetching identify at ${url}`);

    const method = 'PUT';

    const response = await request(url, {
      method,
    });

    if (!this.isResponseOk(response)) {
      return this.throwApiError(url, method, response);
    }

    const data = (await response.body.json()) as HomeWizardApiIdentifyResponse;

    this.log.debug(this.loggerPrefix, `Energy Socket identified: ${JSON.stringify(data)}`);

    return data;
  }
}
