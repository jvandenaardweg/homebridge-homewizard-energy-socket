import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  PlatformAccessoryEvent,
} from "homebridge";
import { HomeWizardApi } from "@/api";

import { HomebridgeHomeWizardEnergySocket } from "@/platform";
import {
  EnergySocketAccessoryProperties,
  HomeWizardEnergyPlatformAccessoryContext,
  PLATFORM_MANUFACTURER,
} from "@/api/types";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class EnergySocketAccessory {
  private service: Service;
  private properties: EnergySocketAccessoryProperties;
  private loggerPrefix: string;
  private homeWizardApi: HomeWizardApi;

  constructor(
    private readonly platform: HomebridgeHomeWizardEnergySocket,
    private readonly accessory: PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>
  ) {
    const properties = accessory.context.energySocket;

    this.properties = properties;

    const loggerPrefix = `${properties.hostname} (${properties.serialNumber}) -> `;

    this.loggerPrefix = loggerPrefix;

    this.platform.log.debug(
      this.loggerPrefix,
      "Initializing platform accessory",
      accessory.UUID,
      accessory.displayName,
      accessory.context.energySocket
    );

    this.homeWizardApi = new HomeWizardApi(
      properties.apiUrl,
      loggerPrefix,
      this.platform.log
    );

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
   * The firmware version of the device. Some API features may not work with different firmware versions.
   */
  get firmwareVersion(): number | null {
    const firmwareVersionString = this.accessory
      .getService(this.platform.Service.AccessoryInformation)
      ?.getCharacteristic(this.platform.Characteristic.FirmwareRevision).value;
    const firmwareVersion = firmwareVersionString
      ? Number(firmwareVersionString)
      : null;

    return firmwareVersion;
  }

  /**
   * This method is called when the user uses the "Identify" feature in the Home app when adding
   * new accessories.
   *
   * This method should blink the status light of the Energy Socket to help the user identify it.
   */
  async handleIdentify(): Promise<void> {
    try {
      await this.homeWizardApi.putIdentify(this.firmwareVersion);
    } catch (error) {
      const fallbackErrorMessage =
        "A unknown error occurred while identifying the Energy Socket";

      throw this.handleAccessoryApiError(error, fallbackErrorMessage);
    }
  }

  async setAsyncRequiredCharacteristic(): Promise<void> {
    try {
      const response = await this.homeWizardApi.getBasicInformation();

      this.accessory
        .getService(this.platform.Service.AccessoryInformation)
        ?.setCharacteristic(
          this.platform.Characteristic.Model,
          `${response.product_name} (${response.product_type})` // "Energy Socket (HWE-SKT"
        )
        .setCharacteristic(
          this.platform.Characteristic.SerialNumber,
          response.serial // Like: "1c23e7280952"
        )
        // The firmware version of the device. Some API features may not work with different firmware versions.
        .setCharacteristic(
          this.platform.Characteristic.FirmwareRevision,
          response.firmware_version // Like: "3.02"
        );
    } catch (error) {
      const fallbackErrorMessage =
        "A unknown error occurred while setting the required characteristics";

      throw this.handleAccessoryApiError(error, fallbackErrorMessage);
    }
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async handleSetOn(value: CharacteristicValue): Promise<void> {
    try {
      await this.homeWizardApi.putState({
        power_on: value as boolean,
      });
    } catch (error) {
      const fallbackErrorMessage =
        "A unknown error occurred while setting the ON state";

      throw this.handleAccessoryApiError(error, fallbackErrorMessage);
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
      // TODO: move to using this.service.updateCharacteristic(this.platform.Characteristic.On, true) and remove await here?
      const response = await this.homeWizardApi.getState();

      return response.power_on;
    } catch (error) {
      const errorMessage =
        "A unknown error occurred while getting the ON state";

      throw this.handleAccessoryApiError(error, errorMessage);
    }
  }

  handleAccessoryApiError(error: unknown, fallbackErrorMessage?: string) {
    let errorMessage = fallbackErrorMessage || "A unknown error occurred";

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    this.platform.log.error(this.loggerPrefix, errorMessage);

    // TODO: handle scenario where the device is offline, is fetched in homekit and shows as non responsive. But then comes back online again. The status is not being updated and api keeps coming back as 403
    return new this.platform.api.hap.HapStatusError(
      this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
    );
  }
}
