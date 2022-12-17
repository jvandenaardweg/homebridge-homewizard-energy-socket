import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  PlatformAccessoryEvent,
} from 'homebridge';

import { HomebridgeHomeWizardEnergySocket } from '@/platform';
import { isNil } from './utils';
import { ConfigSchemaEnergySocket } from './config.schema';
import { EnergySocketApi, StateResponse, IdentifyResponse } from 'homewizard-energy-api';
import {
  EnergySocketAccessoryProperties,
  HomeWizardEnergyPlatformAccessoryContext,
  PLATFORM_MANUFACTURER,
} from './types';
import { SHOW_POLLING_ERRORS_INTERVAL } from './settings';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class EnergySocketAccessory {
  private service: Service;
  private informationService: Service | undefined;
  private properties: EnergySocketAccessoryProperties;
  private energySocketApi: EnergySocketApi;
  private localStateResponse: StateResponse | undefined;
  private config: ConfigSchemaEnergySocket | undefined;

  longPollErrorCount = 0;
  longPollCrossedThresholdAboveAt: Date | null = null;
  longPollCrossedThresholdBelowAt: Date | null = null;

  constructor(
    private readonly platform: HomebridgeHomeWizardEnergySocket,
    private readonly accessory: PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>,
    api: EnergySocketApi,
  ) {
    const properties = accessory.context.energySocket;

    this.properties = properties;
    this.config = properties.config;

    this.log.debug(`Initializing platform accessory ${JSON.stringify(this.properties)}`);

    this.energySocketApi = api;

    const informationService = this.accessory.getService(
      this.platform.Service.AccessoryInformation,
    );

    informationService?.setCharacteristic(
      this.platform.Characteristic.Manufacturer,
      PLATFORM_MANUFACTURER,
    );
    informationService?.setCharacteristic(
      this.platform.Characteristic.Model,
      this.modelName, // "Energy Socket (HWE-SKT"
    );
    informationService?.setCharacteristic(
      this.platform.Characteristic.SerialNumber,
      this.properties.serialNumber, // Like: "1c23e7280952"
    );
    informationService?.setCharacteristic(
      this.platform.Characteristic.FirmwareRevision,
      this.properties.firmwareVersion, // Like: "3.02"
    );

    // Set accessory information
    this.informationService = informationService;

    // Get the Outlet service if it exists, otherwise create a new Outlet service
    // We can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);

    // Set the service name, this is what is displayed as the default name on the Home app
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.properties.displayName);

    // We update this characteristic by polling the /data endpoint
    // Set the initial value by using the activePower property from the properties object
    // When there is no isActive property, we assume the outlet is always in use
    if (!this.config?.outletInUse?.isActive) {
      this.service.setCharacteristic(
        this.platform.Characteristic.OutletInUse,
        this.initialIsOutletInUse,
      );
    }

    // Register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.handleSetOn.bind(this))
      .onGet(this.handleGetOn.bind(this));

    // Listen for the "identify" event for this Accessory
    this.accessory.on(PlatformAccessoryEvent.IDENTIFY, this.handleIdentify.bind(this));

    this.log.info(
      `OutletInUse initial value is ${this.isOutletInUse ? 'ON' : 'OFF'} (${
        this.properties.activePower
      } watt)`,
    );

    // Start long polling the /data endpoint to get the current power usage
    this.longPollData();
  }

  get log() {
    const loggerPrefix = `[Energy Socket: ${this.properties.displayName}] -> `;

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      info: (...parameters: any[]) => {
        this.platform.log.info(loggerPrefix, ...parameters);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      warn: (...parameters: any[]) => {
        this.platform.log.warn(loggerPrefix, ...parameters);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (...parameters: any[]) => {
        this.platform.log.error(loggerPrefix, ...parameters);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      debug: (...parameters: any[]) => {
        this.platform.log.debug(loggerPrefix, ...parameters);
      },
    };
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

  get isSwitchLockEnabled(): boolean {
    return this.localStateResponse?.switch_lock === true;
  }

  get modelName(): string {
    return `${this.properties.productName} (${this.properties.productType})`;
  }

  getIsActivePowerAboveThreshold(activePower: number | null | undefined): boolean {
    return !!(activePower && activePower > (this.config?.outletInUse?.threshold || 0));
  }

  setOutletInUse(value: boolean, activePower: number | null | undefined) {
    this.service.setCharacteristic(this.platform.Characteristic.OutletInUse, value);

    this.longPollCrossedThresholdAboveAt = null;
    this.longPollCrossedThresholdBelowAt = null;

    this.log.info(`OutletInUse is changed to ${value ? 'ON' : 'OFF'} (${activePower} watt)`);
  }

  setLocalStateResponse(response: StateResponse): void {
    this.localStateResponse = response;
  }

  /**
   * Keep the OutletInUse characteristic in sync with the ON state if the config for outletInUse is not set.
   *
   * Only setting the OutletInUse characteristic when the config is not set, because when the config is set, the OutletInUse characteristic is set by the long polling.
   */
  syncOutletInUseStateWithOnState(isOn: boolean) {
    if (!this.config?.outletInUse?.isActive) {
      this.log.debug(`Energy Socket OutletInUse state is updated to ${isOn ? 'ON' : 'OFF'}`);
      this.service.setCharacteristic(this.platform.Characteristic.OutletInUse, isOn);
    }
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
      this.log.debug(
        'outletInUse.isActive config option is false or not set, not long polling the /data endpoint',
      );

      return;
    }

    if (this.properties.productType !== 'HWE-SKT') {
      // this should not happen, but acts as a type guard
      this.log.debug('Not a Energy Socket, not long polling the /data endpoint');

      return;
    }

    const polling = this.energySocketApi.polling;

    polling.getData.start();

    polling.getData.on('response', response => {
      const { active_power_w } = response;

      if (!isNil(active_power_w)) {
        this.properties.activePower = active_power_w;
      }

      const isActivePowerAboveThreshold = this.getIsActivePowerAboveThreshold(active_power_w);

      // If threshold is met, set to true
      // And only set to true if the current isOutletInUse value is false
      if (isActivePowerAboveThreshold && !this.longPollCrossedThresholdAboveAt) {
        this.longPollCrossedThresholdAboveAt = new Date();
        this.longPollCrossedThresholdBelowAt = null;
      }

      // If threshold is not met, set to false
      // And only set to false if the current isOutletInUse value is true
      if (!isActivePowerAboveThreshold && !this.longPollCrossedThresholdBelowAt) {
        this.longPollCrossedThresholdBelowAt = new Date();
        this.longPollCrossedThresholdAboveAt = null;
      }

      // Specifically check for true, because it could be null
      if (this.isThresholdCrossedAboveAfterDuration === true && !this.isOutletInUse) {
        this.log.debug(
          `OutletInUse threshold crossed above ${this.config?.outletInUse?.threshold} watt for ${this.config?.outletInUse?.thresholdDuration} seconds, set OutletInUse to true`,
        );

        this.setOutletInUse(true, active_power_w);
      }

      // Specifically check for true, because it could be null
      if (this.isThresholdCrossedBelowAfterDuration === true && this.isOutletInUse) {
        this.log.debug(
          `OutletInUse threshold crossed below ${this.config?.outletInUse?.threshold} watt for ${this.config?.outletInUse?.thresholdDuration} seconds, set OutletInUse to false`,
        );

        this.setOutletInUse(false, active_power_w);
      }

      if (this.config?.outletInUse?.verboseLogging) {
        // Verbose logging for debug purposes while developing
        this.log.debug(
          `${active_power_w?.toFixed(3).padStart(8, '0')} watt`,
          '|',
          'Threshold:',
          `${this.config.outletInUse.threshold} watt`,

          '|',
          'OutletInUse:',
          this.isOutletInUse ? 'Yes' : 'No',
          '|',

          'Above threshold @',
          this.longPollCrossedThresholdAboveAt?.toLocaleTimeString('nl-NL', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }) || 'Never',
          '|',
          'Below threshold @',
          this.longPollCrossedThresholdBelowAt?.toLocaleTimeString('nl-NL', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }) || 'Never',
          '|',
          `After duration (${this.config.outletInUse.thresholdDuration} sec):`,
          this.isThresholdCrossedAboveAfterDuration ? 'Yes' : 'No',
        );
      }

      // Reset the error count, because we received a response
      this.longPollErrorCount = 0;
    });

    polling.getData.on('error', error => {
      let errorMessage = 'A unknown error happened while polling the /data endpoint.';

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      const isFirstError = this.longPollErrorCount === 0;
      const isErrorCountAfterInterval = this.longPollErrorCount > SHOW_POLLING_ERRORS_INTERVAL;

      // Only show the error if it's the first error or the last error
      // The first error to not wait for the SHOW_POLLING_ERRORS_INTERVAL to show any error
      if (isErrorCountAfterInterval || isFirstError) {
        this.log.error('Error during polling the data endpoint', errorMessage);
      }

      if (isErrorCountAfterInterval) {
        // Reset the counter after showing the error
        this.longPollErrorCount = 0;
      } else {
        // Continue counting
        this.longPollErrorCount += 1;
      }
    });
  }

  /**
   * This method is called when the user uses the "Identify" feature in the Home app when adding
   * new accessories.
   *
   * This method should blink the status light of the Energy Socket to help the user identify it.
   */
  async handleIdentify(): Promise<IdentifyResponse> {
    try {
      const response = await this.energySocketApi.identify();

      return response;
    } catch (error) {
      const fallbackErrorMessage = 'A unknown error occurred while identifying the Energy Socket';

      throw this.handleAccessoryApiError(error, fallbackErrorMessage);
    }
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
        this.log.warn(
          `This Energy Socket (${this.properties.serialNumber}) is locked. Please enable the "Switch lock" setting in the HomeWizard Energy app for this Energy Socket.`,
        );

        // Throw an error to HomeKit
        // The Energy Socket will show as "No response" and we will log the above warning to the Homebridge log
        throw new this.platform.api.hap.HapStatusError(
          this.platform.api.hap.HAPStatus.NOT_ALLOWED_IN_CURRENT_STATE,
        );
      }

      const response = await this.energySocketApi.updateState({
        power_on: value as boolean,
      });

      const isOn = response.power_on;

      this.log.info(`On state is updated to ${isOn ? 'ON' : 'OFF'}`);

      // Keep the OutletInUse characteristic in sync with the ON/OFF state if the config for outletInUse is not set
      this.syncOutletInUseStateWithOnState(isOn);
    } catch (error) {
      const fallbackErrorMessage = 'A unknown error occurred while setting the ON state';

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
      const response = await this.energySocketApi.getState();

      // Put it in the local state, so we can keep track of the switch_lock setting, this must be enabled
      // If not, we can show a warning in the log
      this.setLocalStateResponse(response);

      const isOn = response.power_on;

      this.log.info(`On state is fetched as ${isOn ? 'ON' : 'OFF'}`);

      if (this.config?.outletInUse?.isActive) {
        this.log.info(`Current power consumption is ${this.properties.activePower} watt`);
      }

      // Keep the OutletInUse characteristic in sync with the ON state if the config for outletInUse is not set
      this.syncOutletInUseStateWithOnState(isOn);

      return isOn;
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

    this.log.error(errorMessage);

    // TODO: handle scenario where the device is offline, is fetched in homekit and shows as non responsive. But then comes back online again. The status is not being updated and api keeps coming back as 403
    return new this.platform.api.hap.HapStatusError(
      this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE,
    );
  }
}
