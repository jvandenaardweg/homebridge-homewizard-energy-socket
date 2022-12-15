import { Logger } from 'homebridge';
import {
  HomeWizardApiBasicInformationResponse,
  HomeWizardApiIdentifyResponse,
  HomeWizardApiStatePutParams,
  HomeWizardApiStateResponse,
  EnergySocketDataResponse,
  P1MeterDataResponse,
  HomeWizardDeviceTypes,
} from '@/api/types';
import { Dispatcher, request as undiciRequest } from 'undici';

type RequestArgs = Parameters<typeof undiciRequest>;

// Set a default timeout on all requests
const request = (...args: RequestArgs) =>
  undiciRequest(args[0], {
    ...args[1],
    bodyTimeout: 1000, // 1 seconds, we are on a local network, so all request should be fast
    headersTimeout: 1000,
  });

export class HomeWizardApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HomeWizardApiError';
  }
}
export class HomeWizardApiResponseError extends HomeWizardApiError {
  url: string;
  statusCode: number;
  response: string;

  constructor(message: string, url: string, statusCode: number, response: string) {
    super(message);
    this.name = 'HomeWizardApiResponseError';
    this.url = url;
    this.statusCode = statusCode;
    this.response = response;
  }
}

interface HomeWizardApiOptions {
  apiVersion?: 'v1';
  logger: Logger;
}

/**
 * HomeWizard Energy API
 *
 * @link: https://homewizard-energy-api.readthedocs.io
 */
export class HomeWizardApi {
  private readonly log: Logger;
  private readonly url: string;
  private apiVersion: 'v1' | undefined;

  constructor(url: string, options: HomeWizardApiOptions) {
    this.log = options.logger;

    this.url = url;
    this.apiVersion = options.apiVersion || 'v1';
  }

  get endpoints() {
    const { url } = this;

    return {
      basic: `${url}/api`,
      state: `${url}/api/${this.apiVersion}/state`,
      identify: `${url}/api/${this.apiVersion}/identify`,
      data: `${url}/api/${this.apiVersion}/data`,
    };
  }

  get loggerPrefix(): string {
    return `[Api] -> ${this.url} -> `;
  }

  isResponseOk(response: Dispatcher.ResponseData): boolean {
    return response.statusCode >= 200 && response.statusCode < 300;
  }

  async throwApiResponseError(
    url: string,
    method: string,
    response: Dispatcher.ResponseData,
  ): Promise<never> {
    const { statusCode, body } = response;
    const text = await body.text();

    throw new HomeWizardApiResponseError(
      `Api ${method} call at ${url} failed with status ${statusCode} and response data: ${text}`,
      url,
      statusCode,
      text,
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
      return this.throwApiResponseError(url, method, response);
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
      return this.throwApiResponseError(url, method, response);
    }

    const data = (await response.body.json()) as HomeWizardApiStateResponse;

    this.log.debug(
      this.loggerPrefix,
      `Received state ${JSON.stringify(data)} from ${this.endpoints.state}`,
    );

    return data;
  }

  /**
   * Control the state of the Energy Socket. This endpoint is only available for the HWE-SKT.
   *
   * @link https://homewizard-energy-api.readthedocs.io/endpoints.html#state-api-v1-state
   */
  async putState<Keys extends keyof HomeWizardApiStateResponse>(
    params: HomeWizardApiStatePutParams<Keys>,
  ): Promise<HomeWizardApiStatePutParams<Keys>> {
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
      return this.throwApiResponseError(url, method, response);
    }

    const data = (await response.body.json()) as HomeWizardApiStatePutParams<Keys>;

    this.log.debug(
      this.loggerPrefix,
      `Received updated state ${JSON.stringify(data)} from ${this.endpoints.state}`,
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
      return this.throwApiResponseError(url, method, response);
    }

    const data = (await response.body.json()) as HomeWizardApiIdentifyResponse;

    this.log.debug(this.loggerPrefix, `Energy Socket identified: ${JSON.stringify(data)}`);

    return data;
  }

  /**
   * The /api/v1/data endpoint allows you to get the most recent measurement from the device.
   *
   * Note #1: All datapoints are “optional”; The API does not send datapoints that are null. Make sure your application can handle this.
   *
   * Note #2: The API for the watermeter can only be used when the watermeter is powered over USB. To save energy, the watermeter only connects to Wi-Fi a couple of times per day when powered with batteries.
   *
   * @link https://homewizard-energy-api.readthedocs.io/endpoints.html#recent-measurement-api-v1-data
   */
  async getData<T extends EnergySocketDataResponse>(
    productType: HomeWizardDeviceTypes.WIFI_ENERGY_SOCKET,
    disableLogs?: boolean,
  ): Promise<T>;
  async getData<T extends P1MeterDataResponse>(
    productType: HomeWizardDeviceTypes.WIFI_PI_METER,
    disableLogs?: boolean,
  ): Promise<T>;
  async getData<T extends EnergySocketDataResponse | P1MeterDataResponse>(
    productType: HomeWizardDeviceTypes.WIFI_PI_METER | HomeWizardDeviceTypes.WIFI_ENERGY_SOCKET,
    disableLogs?: boolean,
  ): Promise<T> {
    if (
      productType !== HomeWizardDeviceTypes.WIFI_PI_METER &&
      productType !== HomeWizardDeviceTypes.WIFI_ENERGY_SOCKET
    ) {
      throw new HomeWizardApiError(
        `Product type "${productType}" is not supported for this API call.`,
      );
    }

    const url = this.endpoints.data;

    if (!disableLogs) {
      this.log.debug(this.loggerPrefix, `Fetching the data at ${url}`);
    }

    const method = 'GET';
    const response = await request(url, {
      method,
    });

    if (!this.isResponseOk(response)) {
      return this.throwApiResponseError(url, method, response);
    }

    const data = (await response.body.json()) as T;

    if (!disableLogs) {
      this.log.debug(this.loggerPrefix, `Fetched data: ${JSON.stringify(data)}`);
    }

    return data;
  }
}
