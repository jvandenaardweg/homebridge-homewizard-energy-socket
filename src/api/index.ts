import { Logger } from 'homebridge';
import {
  HomeWizardApiBasicInformationResponse,
  HomeWizardApiIdentifyResponse,
  HomeWizardApiStatePutParams,
  HomeWizardApiStatePutResponse,
  HomeWizardApiStateResponse,
} from '@/api/types';
import { httpRequest, HttpRequestResponse } from '@/utils/http-request';

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
  public ip: string;
  public readonly port: number;
  public readonly path: string;
  public readonly hostname: string;
  public readonly serialNumber: string;

  constructor(
    ip: string,
    port: number,
    path: string,
    hostname: string,
    serialNumber: string,
    logger: Logger,
  ) {
    this.log = logger;

    this.ip = ip;
    this.port = port;
    this.path = path;
    this.hostname = hostname;
    this.serialNumber = serialNumber;
  }

  get endpoints() {
    const { ip, port, path } = this;

    return {
      basic: `http://${ip}:${port}/api`,
      state: `http://${ip}:${port}${path}/state`,
      identify: `http://${ip}:${port}${path}/identify`,
    };
  }

  get loggerPrefix(): string {
    return `[Api] -> ${this.hostname} (${this.serialNumber}) (${this.ip}) -> `;
  }

  /**
   * Updates the IP address of the HomeWizard Energy device.
   * Useful when the IP address changed within the network if the user does not use fixed IP addresses.
   */
  public updateIpAddress(newIp: string) {
    this.log.debug(this.loggerPrefix, `Updated IP address from ${this.ip} to ${newIp}`);

    this.ip = newIp;
  }

  async throwApiError<T>(method: string, response: HttpRequestResponse<T>): Promise<never> {
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
    const response = await httpRequest<HomeWizardApiBasicInformationResponse>(
      this.endpoints.basic,
      {
        method,
      },
    );

    if (!response.ok) {
      return this.throwApiError(method, response);
    }

    const data = await response.json();

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
    const response = await httpRequest<HomeWizardApiStateResponse>(this.endpoints.state, {
      method,
    });

    if (!response.ok) {
      return this.throwApiError(method, response);
    }

    const data = await response.json();

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
    const response = await httpRequest<HomeWizardApiStatePutResponse>(this.endpoints.state, {
      method,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      return this.throwApiError(method, response);
    }

    const data = await response.json();

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

    const response = await httpRequest<HomeWizardApiIdentifyResponse>(this.endpoints.identify, {
      method,
    });

    if (!response.ok) {
      return this.throwApiError(method, response);
    }

    const data = await response.json();

    this.log.debug(this.loggerPrefix, `Energy Socket identified: ${JSON.stringify(data)}`);

    return data;
  }
}
