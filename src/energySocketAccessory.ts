import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  PlatformAccessoryEvent,
} from 'homebridge';
import { HomeWizardApi, HomeWizardApiError } from '@/api';
// import dns from 'dns';

import { HomebridgeHomeWizardEnergySocket } from '@/platform';
import {
  EnergySocketNetworkStatus,
  HomeWizardApiStateResponse,
  HomeWizardEnergyPlatformAccessoryContext,
  PLATFORM_MANUFACTURER,
} from '@/api/types';
import { HttpTimeoutError } from './utils/http-request';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class EnergySocketAccessory {
  private readonly service: Service;
  private readonly homeWizardApi: HomeWizardApi;

  private localStateResponse: HomeWizardApiStateResponse | undefined;

  constructor(
    private readonly platform: HomebridgeHomeWizardEnergySocket,
    private readonly accessory: PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>,
  ) {
    const energySocket = accessory.context.energySocket;
    // const HOSTNAME_LOOKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

    this.platform.log.debug(
      this.loggerPrefix,
      `Initializing platform accessory ${accessory.UUID} ${accessory.displayName}`,
    );

    this.homeWizardApi = new HomeWizardApi(
      energySocket.ip,
      energySocket.port,
      energySocket.path,
      energySocket.hostname,
      energySocket.serialNumber,
      this.platform.log,
    );

    // Set an interval to check if the IP address changed by using a DNS lookup on the hostname.
    // The mDNS service does not always detect changes in the network quickly
    // setInterval(() => {
    //   dns.lookup(energySocket.hostname, (error, address) => {
    //     if (error) {
    //       this.platform.log.debug(
    //         this.loggerPrefix,
    //         `DNS lookup failed for hostname ${energySocket.hostname}`,
    //         JSON.stringify(error),
    //       );
    //       return;
    //     }

    //     // If the IP address changed, update the IP address the API uses
    //     if (address !== this.homeWizardApi.ip) {
    //       this.homeWizardApi.updateIpAddress(address);

    //       this.energySocket.ip = address;
    //       accessory.context.energySocket.ip = address;
    //     }
    //   });
    // }, HOSTNAME_LOOKUP_INTERVAL); // Check DNS every 5 minutes if the IP address changed

    // Set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)
      ?.setCharacteristic(this.platform.Characteristic.Manufacturer, PLATFORM_MANUFACTURER)
      .setCharacteristic(
        this.platform.Characteristic.Model,
        `${energySocket.productName} (${energySocket.productType})`, // "Energy Socket (HWE-SKT"
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        energySocket.serialNumber, // Like: "1c23e7280952"
      )
      .setCharacteristic(
        this.platform.Characteristic.FirmwareRevision,
        '1.0', // Set a default firmware version, this will be updated async later
      )
      .setCharacteristic(
        this.platform.Characteristic.Active, // The corresponding value is a Boolean. A value of true indicates the service is working.
        true, // TODO: set false when device is offline?
      );

    // Get the Outlet service if it exists, otherwise create a new Outlet service
    // We can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);

    // Set the service name, this is what is displayed as the default name on the Home app
    this.service
      .setCharacteristic(this.platform.Characteristic.Name, energySocket.displayName)
      .setCharacteristic(this.platform.Characteristic.OutletInUse, true);

    // Get additional characteristics async by calling the API
    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Outlet
    this.setAsyncFirmwareVersion();

    // Register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.handleSetOn.bind(this))
      .onGet(this.handleGetOn.bind(this));

    // Listen for the "identify" event for this Accessory
    this.accessory.on(PlatformAccessoryEvent.IDENTIFY, this.handleIdentify.bind(this));
  }

  get loggerPrefix(): string {
    const energySocket = this.accessory.context.energySocket;

    return `[Accessory] -> ${energySocket.hostname} (${energySocket.serialNumber}) (${energySocket.ip}) (${energySocket.networkStatus}) -> `;
  }

  /**
   * The firmware version of the device. Some API features may not work with different firmware versions.
   */
  get firmwareVersion(): number | null {
    const firmwareVersionString = this.accessory
      .getService(this.platform.Service.AccessoryInformation)
      ?.getCharacteristic(this.platform.Characteristic.FirmwareRevision).value;
    const firmwareVersion = firmwareVersionString ? Number(firmwareVersionString) : null;

    return firmwareVersion;
  }

  setNetworkStatusOnline(): void {
    this.accessory.context.energySocket.networkStatus = EnergySocketNetworkStatus.ONLINE;
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

      // Keep local network status in sync with the API
      this.setNetworkStatusOnline();
    } catch (error) {
      const fallbackErrorMessage = 'A unknown error occurred while identifying the Energy Socket';

      throw this.handleAccessoryApiError(error, fallbackErrorMessage);
    }
  }

  async setAsyncFirmwareVersion(): Promise<void> {
    try {
      const response = await this.homeWizardApi.getBasicInformation();

      // Keep local network status in sync with the API
      this.setNetworkStatusOnline();

      // The firmware version of the device. Some API features may not work with different firmware versions.
      this.accessory.getService(this.platform.Service.AccessoryInformation)?.setCharacteristic(
        this.platform.Characteristic.FirmwareRevision,
        response.firmware_version, // Like: "3.02"
      );
    } catch (error) {
      if (error instanceof HttpTimeoutError) {
        return this.handleApiTimeoutError();
      }

      let errorMessage = 'A unknown error occurred while setting the required characteristics';

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.platform.log.error(this.loggerPrefix, errorMessage);

      // IMPORTANT: do not throw this error below, it will make homebridge crash, because it's not handled in the constructor
      // throw this.handleAccessoryApiError(error, fallbackErrorMessage);
    }
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async handleSetOn(value: CharacteristicValue): Promise<void> {
    try {
      // If the switch_lock setting is true, we cannot enable the Energy Socket through the API
      // The user first has to enable the Switch Lock in the HomeWizard Energy app
      if (this.localStateResponse?.switch_lock === true) {
        this.platform.log.warn(
          this.loggerPrefix,
          `This Energy Socket (${this.accessory.context.energySocket.serialNumber}) is locked. Please enable the "Switch lock" setting in the HomeWizard Energy app for this Energy Socket.`,
        );

        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE,
        );
      }

      await this.homeWizardApi.putState({
        power_on: value as boolean,
      });

      // Keep local network status in sync with the API
      this.setNetworkStatusOnline();
    } catch (error) {
      const fallbackErrorMessage = 'A unknown error occurred while setting the ON state';

      throw this.handleAccessoryApiError(error, fallbackErrorMessage);
    }
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possible. A long delay here will result in
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

      // Keep local network status in sync with the API
      this.setNetworkStatusOnline();

      // Put it in the local state, so we can keep track of the switch_lock setting, this must be enabled
      // If not, we can show a warning in the log
      this.localStateResponse = response;

      return response.power_on;
    } catch (error) {
      const errorMessage = 'A unknown error occurred while getting the ON state';

      throw this.handleAccessoryApiError(error, errorMessage);
    }
  }

  handleApiTimeoutError(): void {
    this.accessory.context.energySocket.networkStatus = EnergySocketNetworkStatus.OFFLINE;

    this.accessory.getService(this.platform.Service.AccessoryInformation)?.setCharacteristic(
      // An indicator of whether the service is working
      // Read more: https://developer.apple.com/documentation/homekit/hmcharacteristictypestatusactive
      this.platform.Characteristic.Active,
      false,
    );

    this.platform.api.updatePlatformAccessories([this.accessory]);

    this.platform.log.debug(
      this.loggerPrefix,
      'Energy Socket is probably offline due to a timeout error on an API call. Internal network status of this accessory is set to "offline".',
    );
  }

  handleAccessoryApiError(error: unknown, fallbackErrorMessage?: string) {
    let errorMessage = fallbackErrorMessage || 'A unknown error occurred';

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    this.platform.log.error(this.loggerPrefix, errorMessage);

    if (error instanceof HttpTimeoutError) {
      this.handleApiTimeoutError();
    }

    return new this.platform.api.hap.HapStatusError(
      this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
    );
  }
}
