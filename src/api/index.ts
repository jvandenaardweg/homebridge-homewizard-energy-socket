import { Logger } from 'homebridge';
import {
  HomeWizardApiBasicInformationResponse,
  HomeWizardApiIdentifyResponse,
  HomeWizardApiStatePutParams,
  HomeWizardApiStatePutResponse,
  HomeWizardApiStateResponse,
} from '@/api/types';
import { fetch, Response } from 'undici';

// globalThis.fetch = fetch;

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

  async throwApiError(method: string, response: Response): Promise<never> {
    throw new HomeWizardApiError(
      `Api ${method.toUpperCase()} call at ${response.url} failed, with status ${
        response.status
      } and response data ${JSON.stringify(response)}`,
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
    this.log.debug(this.loggerPrefix, `Fetching the basic information at ${this.endpoints.basic}`);

    const method = 'GET';
    const response = await fetch(this.endpoints.basic, {
      method,
    });

    if (!response.ok) {
      return this.throwApiError(method, response);
    }

    const data = (await response.json()) as HomeWizardApiBasicInformationResponse;

    this.log.debug(this.loggerPrefix, `Fetched basic information: ${JSON.stringify(data)}`);

    return data;
  }

  /**
   * Returns the actual state of the Energy Socket. This endpoint is only available for the HWE-SKT.
   *
   * @link https://homewizard-energy-api.readthedocs.io/endpoints.html#state-api-v1-state
   */
  async getState(): Promise<HomeWizardApiStateResponse> {
    this.log.debug(this.loggerPrefix, `Fetching the state at ${this.endpoints.state}`);

    const method = 'GET';
    const response = await fetch(this.endpoints.state, {
      method,
    });

    if (!response.ok) {
      return this.throwApiError(method, response);
    }

    const data = (await response.json()) as HomeWizardApiStateResponse;

    this.log.info(this.loggerPrefix, `Energy Socket state is ${data.power_on ? 'ON' : 'OFF'}`);

    return data;
  }

  /**
   * Control the state of the Energy Socket. This endpoint is only available for the HWE-SKT.
   *
   * @link https://homewizard-energy-api.readthedocs.io/endpoints.html#state-api-v1-state
   */
  async putState(params: HomeWizardApiStatePutParams): Promise<HomeWizardApiStatePutResponse> {
    this.log.debug(
      this.loggerPrefix,
      `Setting the state to ${JSON.stringify(params)} at ${this.endpoints.state}`,
    );

    const method = 'PUT';
    const response = await fetch(this.endpoints.state, {
      method,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      return this.throwApiError(method, response);
    }

    const data = (await response.json()) as HomeWizardApiStatePutResponse;

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

    this.log.debug(this.loggerPrefix, `Fetching identify at ${this.endpoints.identify}`);

    const method = 'PUT';

    const response = await fetch(this.endpoints.identify, {
      method,
    });

    if (!response.ok) {
      return this.throwApiError(method, response);
    }

    const data = (await response.json()) as HomeWizardApiIdentifyResponse;

    this.log.debug(this.loggerPrefix, `Energy Socket identified: ${JSON.stringify(data)}`);

    return data;
  }
}
