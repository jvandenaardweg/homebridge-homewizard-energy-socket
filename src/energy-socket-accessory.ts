import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  PlatformAccessoryEvent,
} from 'homebridge';
import { HomeWizardApi } from '@/api/api';

import { HomebridgeHomeWizardEnergySocket } from '@/platform';
import {
  EnergySocketAccessoryProperties,
  HomeWizardApiIdentifyResponse,
  HomeWizardApiStateResponse,
  HomeWizardDeviceTypes,
  HomeWizardEnergyPlatformAccessoryContext,
  PLATFORM_MANUFACTURER,
} from '@/api/types';

const POWER_USAGE_THRESHOLD = 5;
const POLLING_INTERVAL = 3000; // in ms
const SHOW_POLLING_ERRORS_INTERVAL = (15 * 60 * 1000) / POLLING_INTERVAL; // Show error every 15 minutes, if we poll every 3 seconds that's every 300 errors

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class EnergySocketAccessory {
  private service: Service;
  private informationService: Service | undefined;
  private properties: EnergySocketAccessoryProperties;
  private loggerPrefix: string;
  private homeWizardApi: HomeWizardApi;
  private localStateResponse: HomeWizardApiStateResponse | undefined;
  longPollErrorCount = 0;

  constructor(
    private readonly platform: HomebridgeHomeWizardEnergySocket,
    private readonly accessory: PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>,
    api: HomeWizardApi,
  ) {
    const properties = accessory.context.energySocket;

    this.properties = properties;

    const loggerPrefix = `[Energy Socket: ${properties.displayName}] -> `;

    this.loggerPrefix = loggerPrefix;

    this.platform.log.debug(
      this.loggerPrefix,
      `Initializing platform accessory ${JSON.stringify(properties)}`,
    );

    this.homeWizardApi = api;

    const informationService = this.accessory.getService(
      this.platform.Service.AccessoryInformation,
    );

    informationService?.setCharacteristic(
      this.platform.Characteristic.Manufacturer,
      PLATFORM_MANUFACTURER,
    );
    informationService?.setCharacteristic(
      this.platform.Characteristic.Model,
      this.getModel(properties.productName, properties.productType), // "Energy Socket (HWE-SKT"
    );
    informationService?.setCharacteristic(
      this.platform.Characteristic.SerialNumber,
      properties.serialNumber, // Like: "1c23e7280952"
    );
    informationService?.setCharacteristic(
      this.platform.Characteristic.FirmwareRevision,
      properties.firmwareVersion, // Like: "3.02"
    );

    // Set accessory information
    this.informationService = informationService;

    // Get the Outlet service if it exists, otherwise create a new Outlet service
    // We can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);

    // Set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, properties.displayName);

    // We update this characteristic by polling the /data endpoint
    // So we set it to false by default, because we don't know the current state yet
    this.service.setCharacteristic(this.platform.Characteristic.OutletInUse, false);

    // Register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.handleSetOn.bind(this))
      .onGet(this.handleGetOn.bind(this));

    // Listen for the "identify" event for this Accessory
    this.accessory.on(PlatformAccessoryEvent.IDENTIFY, this.handleIdentify.bind(this));

    // Start long polling the /data endpoint to get the current power usage
    this.longPollData();
  }

  async longPollData() {
    if (this.properties.productType !== HomeWizardDeviceTypes.WIFI_ENERGY_SOCKET) {
      return;
    }

    try {
      // Get the current state of the device
      // We need to pass true as the second argument to disable logging, to not flood the Homebridge logs
      // We'll only log errors here
      const energySocketData = await this.homeWizardApi.getData(this.properties.productType, true);

      const outletInUse = this.service.getCharacteristic(
        this.platform.Characteristic.OutletInUse,
      ).value;

      const isThresholdMet =
        energySocketData.active_power_w && energySocketData.active_power_w > POWER_USAGE_THRESHOLD;

      // console.log(
      //   'active_power_w',
      //   this.properties.displayName,
      //   energySocketData.active_power_w,
      //   'outletInUse?',
      //   outletInUse,
      // );

      if (isThresholdMet && !outletInUse) {
        // If threshold is met, set to true
        // And only set to true if it's not already true
        this.service.setCharacteristic(this.platform.Characteristic.OutletInUse, true);
      } else if (!isThresholdMet && outletInUse) {
        // If threshold is not met, set to false
        // And only set to false if it's not already false
        this.service.setCharacteristic(this.platform.Characteristic.OutletInUse, false);
      }

      this.longPollErrorCount = 0;

      // Always run the setTimeout after above logic
      setTimeout(this.longPollData.bind(this), POLLING_INTERVAL);
    } catch (error) {
      let errorMessage = 'A unknown error happened while polling the /data endpoint.';

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // If error threshold is met, show an error
      if (this.longPollErrorCount > SHOW_POLLING_ERRORS_INTERVAL) {
        this.platform.log.error(
          this.loggerPrefix,
          'Error during polling the data endpoint',
          errorMessage,
        );

        // Reset the counter after showing the error
        this.longPollErrorCount = 0;
      } else {
        // Continue counting
        this.longPollErrorCount += 1;
      }

      // Continue polling, device is probably offline, maybe it will come back online
      setTimeout(this.longPollData.bind(this), POLLING_INTERVAL);
    }
  }

  /**
   * The firmware version of the device. Some API features may not work with different firmware versions.
   */
  get firmwareVersion(): number | null {
    const firmwareVersionString = this.informationService?.getCharacteristic(
      this.platform.Characteristic.FirmwareRevision,
    ).value;
    const firmwareVersion = firmwareVersionString ? Number(firmwareVersionString) : null;

    return firmwareVersion;
  }

  /**
   * This method is called when the user uses the "Identify" feature in the Home app when adding
   * new accessories.
   *
   * This method should blink the status light of the Energy Socket to help the user identify it.
   */
  async handleIdentify(): Promise<HomeWizardApiIdentifyResponse> {
    try {
      const response = await this.homeWizardApi.putIdentify(this.firmwareVersion);

      return response;
    } catch (error) {
      const fallbackErrorMessage = 'A unknown error occurred while identifying the Energy Socket';

      throw this.handleAccessoryApiError(error, fallbackErrorMessage);
    }
  }

  getModel(productName: string, productType: string): string {
    return `${productName} (${productType})`;
  }

  get isSwitchLockEnabled(): boolean {
    return this.localStateResponse?.switch_lock === true;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   *
   * Do not return anything from this method. Otherwise we'll get this error:
   * SET handler returned write response value, though the characteristic doesn't support write response. See https://homebridge.io/w/JtMGR for more info.
   */
  async handleSetOn(value: CharacteristicValue): Promise<void> {
    try {
      // If the switch_lock setting is true, we cannot enable the Energy Socket through the API
      // The user first has to enable the Switch Lock in the HomeWizard Energy app
      if (this.isSwitchLockEnabled) {
        this.platform.log.warn(
          this.loggerPrefix,
          `This Energy Socket (${this.properties.serialNumber}) is locked. Please enable the "Switch lock" setting in the HomeWizard Energy app for this Energy Socket.`,
        );

        // Throw an error to HomeKit
        // The Energy Socket will show as "No response" and we will log the above warning to the Homebridge log
        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE,
        );
      }

      const response = await this.homeWizardApi.putState({
        power_on: value as boolean,
      });

      this.platform.log.info(
        this.loggerPrefix,
        `Energy Socket state is updated to ${response.power_on ? 'ON' : 'OFF'}`,
      );
    } catch (error) {
      const fallbackErrorMessage = 'A unknown error occurred while setting the ON state';

      throw this.handleAccessoryApiError(error, fallbackErrorMessage);
    }
  }

  setLocalStateResponse(response: HomeWizardApiStateResponse): void {
    this.localStateResponse = response;
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

      // Put it in the local state, so we can keep track of the switch_lock setting, this must be enabled
      // If not, we can show a warning in the log
      this.setLocalStateResponse(response);

      this.platform.log.info(
        this.loggerPrefix,
        `Energy Socket state is ${response.power_on ? 'ON' : 'OFF'}`,
      );

      return response.power_on;
    } catch (error) {
      const errorMessage = 'A unknown error occurred while getting the ON state';

      throw this.handleAccessoryApiError(error, errorMessage);
    }
  }

  handleAccessoryApiError(error: unknown, fallbackErrorMessage?: string) {
    let errorMessage = fallbackErrorMessage || 'A unknown error occurred';

    if (error instanceof Error) {
      errorMessage = error.message;
    }

    this.platform.log.error(this.loggerPrefix, errorMessage);

    // TODO: handle scenario where the device is offline, is fetched in homekit and shows as non responsive. But then comes back online again. The status is not being updated and api keeps coming back as 403
    return new this.platform.api.hap.HapStatusError(
      this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
    );
  }
}
