import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  PlatformAccessoryEvent,
} from "homebridge";
import fetch from "node-fetch";

import { HomebridgeHomeWizardEnergySocket } from "./platform";
import {
  EnergySocketAccessoryProperties,
  HomeWizardApiBasicInformationResponse,
  HomeWizardEnergyPlatformAccessoryContext,
  HomeWizardApiStateResponse,
  PLATFORM_MANUFACTURER,
  HomeWizardApiIdentifyResponse,
} from "./types";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class EnergySocketAccessory {
  private service: Service;
  private energySocket: EnergySocketAccessoryProperties;
  private loggerPrefix: string;
  private stateApiUrl: string;
  private identifyApiUrl: string;

  constructor(
    private readonly platform: HomebridgeHomeWizardEnergySocket,
    private readonly accessory: PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>
  ) {
    const energySocket = accessory.context.energySocket;

    this.energySocket = energySocket;

    this.loggerPrefix = `${energySocket.hostname} (${energySocket.serialNumber}) -> `;

    this.platform.log.debug(
      this.loggerPrefix,
      "Initializing platform accessory",
      accessory.UUID,
      accessory.displayName,
      accessory.context.energySocket
    );

    this.stateApiUrl = `${energySocket.apiUrl}/api/v1/state`;
    this.identifyApiUrl = `${energySocket.apiUrl}/api/v1/identify`;

    // Set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)
      ?.setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        PLATFORM_MANUFACTURER
      );

    // Get the Outlet service if it exists, otherwise create a new Outlet service
    // We can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);

    // Set the service name, this is what is displayed as the default name on the Home app
    this.service
      .setCharacteristic(
        this.platform.Characteristic.Name,
        accessory.context.energySocket.name
      )
      .setCharacteristic(this.platform.Characteristic.OutletInUse, true);

    // Get additional characteristics async by calling the API
    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Outlet
    this.setAsyncRequiredCharacteristic();

    // Register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.handleSetOn.bind(this))
      .onGet(this.handleGetOn.bind(this));

    // Listen for the "identify" event for this Accessory
    this.accessory.on(
      PlatformAccessoryEvent.IDENTIFY,
      this.handleIdentify.bind(this)
    );
  }

  /**
   * This method is called when the user uses the "Identify" feature in the Home app when adding
   * new accessories.
   *
   * This method should blink the status light of the Energy Socket to help the user identify it.
   */
  async handleIdentify(): Promise<void> {
    const firmwareVersionString = this.accessory
      .getService(this.platform.Service.AccessoryInformation)
      ?.getCharacteristic(this.platform.Characteristic.FirmwareRevision).value;
    const firmwareVersion = firmwareVersionString
      ? Number(firmwareVersionString)
      : null;

    if (!firmwareVersion) {
      this.platform.log.warn(
        this.loggerPrefix,
        "Cannot identify, firmware version is not set"
      );

      return;
    }

    // Check if firmware version is 3.00 or later, as the identify API is not available in earlier versions
    // See: https://homewizard-energy-api.readthedocs.io/endpoints.html#identify-api-v1-identify
    if (firmwareVersion < 3) {
      this.platform.log.warn(
        this.loggerPrefix,
        "Cannot identify, this feature is only available on Energy Sockets with firmware version 3.00 or later"
      );

      return;
    }

    this.platform.log.debug(this.loggerPrefix, "Identify requested!");

    try {
      const response = await fetch(this.identifyApiUrl, {
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error(
          `Api PUT call at ${this.identifyApiUrl} failed, with status ${
            response.status
          } and response data ${JSON.stringify(response)}`
        );
      }

      const data = (await response.json()) as HomeWizardApiIdentifyResponse;

      this.platform.log.debug(
        this.loggerPrefix,
        `Energy Socket identified: ${data.identify}`
      );

      // this.state.On = value as boolean;
    } catch (err) {
      let errorMessage =
        "A unknown error occurred while identifying the Energy Socket";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      this.platform.log.debug(this.loggerPrefix, errorMessage);

      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      );
    }
  }

  async setAsyncRequiredCharacteristic(): Promise<void> {
    try {
      const apiUrl = `${this.energySocket.apiUrl}/api`;

      this.platform.log.debug(this.loggerPrefix, `Fetching ${apiUrl}...`);

      const result = await fetch(apiUrl);

      const data =
        (await result.json()) as HomeWizardApiBasicInformationResponse;

      this.platform.log.debug(
        this.loggerPrefix,
        "Set required characteristics using API data: ",
        JSON.stringify(data)
      );

      this.accessory
        .getService(this.platform.Service.AccessoryInformation)
        ?.setCharacteristic(
          this.platform.Characteristic.Model,
          `${data.product_name} (${data.product_type})` // "Energy Socket (HWE-SKT"
        )
        .setCharacteristic(
          this.platform.Characteristic.SerialNumber,
          data.serial // Like: "1c23e7280952"
        )
        // The firmware version of the device. Some API features may not work with different firmware versions.
        .setCharacteristic(
          this.platform.Characteristic.FirmwareRevision,
          data.firmware_version // Like: "3.02"
        );
    } catch (error) {
      this.platform.log.error(
        this.loggerPrefix,
        "setAsyncCharacteristic",
        error
      );

      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      );
    }
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async handleSetOn(value: CharacteristicValue): Promise<void> {
    this.platform.log.debug(
      this.loggerPrefix,
      `Setting the ON state to ${value} at ${this.stateApiUrl}`
    );

    try {
      const response = await fetch(this.stateApiUrl, {
        method: "PUT",
        body: JSON.stringify({ power_on: value }),
      });

      if (!response.ok) {
        throw new Error(
          `Api PUT call at ${this.stateApiUrl} failed, with status ${
            response.status
          } and response data ${JSON.stringify(response)}`
        );
      }

      // TODO: use better type
      const state =
        (await response.json()) as Partial<HomeWizardApiStateResponse>;

      this.platform.log.debug(
        this.loggerPrefix,
        `Energy Socket is set to ${state.power_on ? "ON" : "OFF"}`
      );

      // this.state.On = value as boolean;
    } catch (err) {
      let errorMessage = "A unknown error occurred while setting the ON state";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      this.platform.log.debug(this.loggerPrefix, errorMessage);

      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      );
    }
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async handleGetOn(): Promise<CharacteristicValue> {
    try {
      this.platform.log.debug(
        this.loggerPrefix,
        `Fetching the ON state at ${this.stateApiUrl}`
      );

      // TODO: move to using this.service.updateCharacteristic(this.platform.Characteristic.On, true) and remove await here?
      const response = await fetch(this.stateApiUrl);

      if (!response.ok) {
        throw new Error(
          `Api GET call at ${this.stateApiUrl} failed, with status ${
            response.status
          } and response data ${JSON.stringify(response.body)}`
        );
      }

      const state = (await response.json()) as HomeWizardApiStateResponse;

      this.platform.log.debug(
        this.loggerPrefix,
        `Got response from ${this.stateApiUrl}: ${JSON.stringify(state)}`
      );

      this.platform.log.info(
        this.loggerPrefix,
        `Energy Socket is ${state.power_on ? "ON" : "OFF"}`
      );

      return state.power_on;
    } catch (err) {
      let errorMessage = "A unknown error occurred while getting the ON state";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      this.platform.log.debug(this.loggerPrefix, errorMessage);

      // TODO: handle scenario where the device is offline, is fetched in homekit and shows as non responsive. But then comes back online again. The status is not being updated and api keeps coming back as 403
      //
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      );
    }
  }
}
