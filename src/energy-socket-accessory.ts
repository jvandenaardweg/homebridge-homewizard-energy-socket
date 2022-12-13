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
import { EnergySocketConfig } from './types';

const POLLING_INTERVAL = 1000; // in ms
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
  private config: EnergySocketConfig | undefined;

  longPollErrorCount = 0;
  longPollCrossedThresholdAboveAt: Date | null = null;
  longPollCrossedThresholdBelowAt: Date | null = null;

  constructor(
    private readonly platform: HomebridgeHomeWizardEnergySocket,
    private readonly accessory: PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>,
    api: HomeWizardApi,
  ) {
    const properties = accessory.context.energySocket;

    this.properties = properties;
    this.config = properties.config;

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
    // Set the initial value by using the activePower property from the properties object
    // When there is no isActive property, we assume the outlet is always in use
    this.service.setCharacteristic(
      this.platform.Characteristic.OutletInUse,
      this.initialIsOutletInUse,
    );

    // Register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.handleSetOn.bind(this))
      .onGet(this.handleGetOn.bind(this));

    // Listen for the "identify" event for this Accessory
    this.accessory.on(PlatformAccessoryEvent.IDENTIFY, this.handleIdentify.bind(this));

    this.logCurrentOutletInUseState();

    // Start long polling the /data endpoint to get the current power usage
    this.longPollData();
  }

  /**
   * Get the initial OutletInUse upon instance creation.
   *
   * We ignore the thresholdDuration here, because we need to set an initial value, that is either true or false.
   *
   * When there is no isActive config property, we assume the outlet is always in use
   */
  get initialIsOutletInUse(): boolean {
    // When there is no isActive config property, we assume the outlet is always in use
    if (!this.config?.outletInUse?.isActive) {
      return true;
    }

    return this.getIsActivePowerAboveThreshold(this.properties.activePower);
  }

  logCurrentOutletInUseState() {
    this.platform.log.info(
      this.loggerPrefix,
      `OutletInUse value is ${this.isOutletInUse ? 'ON' : 'OFF'} (${
        this.properties.activePower
      } watt)`,
    );
  }

  get isOutletInUse(): boolean {
    return this.service.getCharacteristic(this.platform.Characteristic.OutletInUse)
      .value as boolean;
  }

  get thresholdDurationInMs(): number {
    return (this.config?.outletInUse?.thresholdDuration || 0) * 1000;
  }

  get isThresholdCrossedAboveAfterDuration(): boolean | null {
    // Return null when config option is not set
    if (!this.config?.outletInUse?.isActive) {
      return null;
    }

    const currentTime = new Date().getTime();
    const crossedAboveThresholdTime = this.longPollCrossedThresholdAboveAt?.getTime();

    // Return null when we haven't crossed the threshold yet
    if (!crossedAboveThresholdTime) return null;

    // When the threshold is crossed above, and the duration is passed, return true
    return currentTime - crossedAboveThresholdTime >= this.thresholdDurationInMs;
  }

  get isThresholdCrossedBelowAfterDuration(): boolean | null {
    // Return null when config option is not set
    if (!this.config?.outletInUse?.isActive) {
      return null;
    }

    const currentTime = new Date().getTime();
    const crossedBelowThresholdTime = this.longPollCrossedThresholdBelowAt?.getTime();

    // Return null when we haven't crossed the threshold yet
    if (!crossedBelowThresholdTime) return null;

    // When the threshold is crossed below, and the duration is passed, return true
    return currentTime - crossedBelowThresholdTime >= this.thresholdDurationInMs;
  }

  setOutletInUse(value: boolean, activePower: number | null | undefined) {
    this.service.setCharacteristic(this.platform.Characteristic.OutletInUse, value);

    this.longPollCrossedThresholdAboveAt = null;
    this.longPollCrossedThresholdBelowAt = null;

    this.platform.log.info(
      this.loggerPrefix,
      `OutletInUse is changed to ${value ? 'ON' : 'OFF'} (${activePower} watt)`,
    );
  }

  getIsActivePowerAboveThreshold(activePower: number | null | undefined): boolean {
    return !!(activePower && activePower > (this.config?.outletInUse?.threshold || 0));
  }

  /**
   * Long poll the /data endpoint to get the current power usage.
   * This is used to update the OutletInUse characteristic.
   *
   * Errors are logged every 15 minutes, to not flood the Homebridge logs.
   * This is done by counting the number of errors, and only logging an error every X amount of errors.
   *
   * The long polling will never stop, unless the plugin is stopped.
   */
  async longPollData() {
    if (!this.config?.outletInUse?.isActive) {
      this.platform.log.debug(
        this.loggerPrefix,
        'outletInUse.isActive config option is false or not set, not long polling the /data endpoint',
      );

      return;
    }

    if (this.properties.productType !== HomeWizardDeviceTypes.WIFI_ENERGY_SOCKET) {
      // this should not happen, but acts as a type guard
      this.platform.log.debug(
        this.loggerPrefix,
        'Not a Energy Socket, not long polling the /data endpoint',
      );

      return;
    }

    try {
      // Get the current state of the device
      // We need to pass true as the second argument to disable logging, to not flood the Homebridge logs
      // We'll only log errors here
      const { active_power_w } = await this.homeWizardApi.getData(
        this.properties.productType,
        true,
      );

      const isActivePowerAboveThreshold = this.getIsActivePowerAboveThreshold(active_power_w);

      // If threshold is met, set to true
      // And only set to true if the current isOutletInUse value is false
      if (isActivePowerAboveThreshold && !this.isOutletInUse) {
        if (!this.longPollCrossedThresholdAboveAt) {
          this.longPollCrossedThresholdAboveAt = new Date();
          // this.longPollCrossedThresholdBelowAt = null;
        }
      }

      // If threshold is not met, set to false
      // And only set to false if the current isOutletInUse value is true
      if (!isActivePowerAboveThreshold && this.isOutletInUse) {
        if (!this.longPollCrossedThresholdBelowAt) {
          // this.longPollCrossedThresholdAboveAt = null;
          this.longPollCrossedThresholdBelowAt = new Date();
        }
      }

      // Specifically check for true, because it could be null
      if (this.isThresholdCrossedAboveAfterDuration === true && !this.isOutletInUse) {
        this.platform.log.debug(
          this.loggerPrefix,
          `OutletInUse threshold crossed above ${this.config.outletInUse.threshold} watt for ${this.config.outletInUse.thresholdDuration} seconds, set OutletInUse to true`,
        );

        this.setOutletInUse(true, active_power_w);
      }

      // Specifically check for false, because it could be null
      if (this.isThresholdCrossedBelowAfterDuration === true && this.isOutletInUse) {
        this.platform.log.debug(
          this.loggerPrefix,
          `OutletInUse threshold crossed below ${this.config.outletInUse.threshold} watt for ${this.config.outletInUse.thresholdDuration} seconds, set OutletInUse to false`,
        );

        this.setOutletInUse(false, active_power_w);
      }

      // Verbose logging for debug purposes while developing
      // this.platform.log.debug(
      //   'active_power_w',
      //   this.properties.displayName,
      //   active_power_w?.toFixed(3),
      //   'outletInUse?',
      //   this.isOutletInUse,
      //   'longPollCrossedThresholdAboveAt',
      //   this.longPollCrossedThresholdAboveAt?.toLocaleTimeString('nl-NL', {
      //     hour: '2-digit',
      //     minute: '2-digit',
      //     second: '2-digit',
      //   }),
      //   'longPollCrossedThresholdBelowAt',
      //   this.longPollCrossedThresholdBelowAt?.toLocaleTimeString('nl-NL', {
      //     hour: '2-digit',
      //     minute: '2-digit',
      //     second: '2-digit',
      //   }),
      //   'crossedAbove?',
      //   this.isThresholdCrossedAboveAfterDuration,
      // );

      // Reset the error count, because we received a response
      this.longPollErrorCount = 0;

      // Always run the setTimeout after above logic
      setTimeout(this.longPollData.bind(this), POLLING_INTERVAL);
    } catch (error) {
      let errorMessage = 'A unknown error happened while polling the /data endpoint.';

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      const isFirstError = this.longPollErrorCount === 0;
      const isErrorCountAfterInterval = this.longPollErrorCount > SHOW_POLLING_ERRORS_INTERVAL;

      // Only show the error if it's the first error or the last error
      // The first error to not wait for the SHOW_POLLING_ERRORS_INTERVAL to show any error
      if (isErrorCountAfterInterval || isFirstError) {
        this.platform.log.error(
          this.loggerPrefix,
          'Error during polling the data endpoint',
          errorMessage,
        );
      }

      if (isErrorCountAfterInterval) {
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

      // TODO: set OutletInUse to false if power_on is false. Do not set to true if power_on is true, because the outletInUse is set by the longPollData method. When an energy socket is turned on, we don't know if the device connected to it is drawing power.
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
