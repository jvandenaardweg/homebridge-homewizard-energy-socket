import { Logger } from "homebridge";
import fetch, { Response } from "node-fetch";
import {
  HomeWizardApiBasicInformationResponse,
  HomeWizardApiIdentifyResponse,
  HomeWizardApiStatePutParams,
  HomeWizardApiStatePutResponse,
  HomeWizardApiStateResponse,
} from "@/types";

interface Endpoints {
  basic: string;
  state: string;
  identify: string;
}

/**
 * HomeWizard Energy API
 *
 * @link: https://homewizard-energy-api.readthedocs.io
 */
export class HomeWizardApi {
  public endpoints: Endpoints;
  private log: Logger;
  private loggerPrefix: string;

  constructor(apiUrl: string, loggerPrefix: string, logger: Logger) {
    this.log = logger;
    this.loggerPrefix = loggerPrefix;

    this.endpoints = {
      basic: `${apiUrl}/api`,
      state: `${apiUrl}/api/v1/state`,
      identify: `${apiUrl}/api/v1/identify`,
    };
  }

  throwApiError(method: string, response: Response): never {
    throw new Error(
      `Api ${method.toUpperCase()} call at ${
        response.url
      } failed, with status ${
        response.status
      } and response data ${JSON.stringify(response)}`
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
    this.log.debug(
      this.loggerPrefix,
      `Fetching the basic information at ${this.endpoints.state}`
    );

    const method = "GET";
    const response = await fetch(this.endpoints.basic, {
      method,
    });

    if (!response.ok) {
      return this.throwApiError(method, response);
    }

    const data =
      response.json() as unknown as HomeWizardApiBasicInformationResponse;

    this.log.debug(
      this.loggerPrefix,
      `Fetched basic information: ${JSON.stringify(data)}`
    );

    return data;
  }

  /**
   * Returns the actual state of the Energy Socket. This endpoint is only available for the HWE-SKT.
   *
   * @link https://homewizard-energy-api.readthedocs.io/endpoints.html#state-api-v1-state
   */
  async getState(): Promise<HomeWizardApiStateResponse> {
    this.log.debug(
      this.loggerPrefix,
      `Fetching the state at ${this.endpoints.state}`
    );

    const method = "GET";
    const response = await fetch(this.endpoints.state, {
      method,
    });

    if (!response.ok) {
      return this.throwApiError(method, response);
    }

    const data = response.json() as unknown as HomeWizardApiStateResponse;

    this.log.info(
      this.loggerPrefix,
      `Energy Socket state is ${data.power_on ? "ON" : "OFF"}`
    );

    return data;
  }

  /**
   * Control the state of the Energy Socket. This endpoint is only available for the HWE-SKT.
   *
   * @link https://homewizard-energy-api.readthedocs.io/endpoints.html#state-api-v1-state
   */
  async putState(
    params: HomeWizardApiStatePutParams
  ): Promise<HomeWizardApiStatePutResponse> {
    this.log.debug(
      this.loggerPrefix,
      `Setting the state to ${JSON.stringify(params)} at ${
        this.endpoints.state
      }`
    );

    const method = "PUT";
    const response = await fetch(this.endpoints.state, {
      method,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      return this.throwApiError(method, response);
    }

    const data = response.json() as unknown as HomeWizardApiStatePutResponse;

    this.log.debug(
      this.loggerPrefix,
      `Energy Socket state is updated to ${data.power_on ? "ON" : "OFF"}`
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
  async putIdentify(
    firmwareVersion: number | null
  ): Promise<HomeWizardApiIdentifyResponse> {
    if (!firmwareVersion) {
      throw new Error("Cannot identify, firmware version is not set");
    }

    // Check the required firmware version, otherwise we cannot identify the device
    if (firmwareVersion < 3) {
      throw new Error(
        `Cannot identify, this Energy Socket uses firmware version ${firmwareVersion}. But the identify feature is only available on Energy Sockets with firmware version 3.00 or later`
      );
    }

    this.log.debug(
      this.loggerPrefix,
      `Fetching identify at ${this.endpoints.identify}`
    );

    const method = "PUT";

    const response = await fetch(this.endpoints.identify, {
      method,
    });

    if (!response.ok) {
      return this.throwApiError(method, response);
    }

    const data = response.json() as unknown as HomeWizardApiIdentifyResponse;

    this.log.debug(
      this.loggerPrefix,
      `Energy Socket identified: ${JSON.stringify(data)}`
    );

    return data;
  }
}
