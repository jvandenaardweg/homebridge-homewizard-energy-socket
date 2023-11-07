import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
  APIEvent,
} from 'homebridge';
import { Bonjour, Service as BonjourService } from 'bonjour-service';

import { PLATFORM_NAME, PLUGIN_NAME, POLLING_INTERVAL } from '@/settings';
import { EnergySocketAccessory } from '@/energy-socket-accessory';
import { EnergySocketAccessoryPowerStatus } from '@/energy-socket-accessory-power-status';
import { ZodError } from 'zod';
import { ConfigSchema, configSchema } from './config.schema';
import {
  EnergySocketApi,
  MdnsTxtRecord,
  MDNS_DISCOVERY_PROTOCOL,
  MDNS_DISCOVERY_TYPE,
  SupportedDevices,
} from 'homewizard-energy-api';
import { EnergySocketAccessoryProperties, HomeWizardEnergyPlatformAccessoryContext } from './types';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgeHomeWizardEnergySocket implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public cachedAccessories: PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>[] = [];

  private config: ConfigSchema;

  private bonjour: Bonjour | null = null;

  private loggerPrefix: string;

  constructor(public readonly log: Logger, config: PlatformConfig, public readonly api: API) {
    const loggerPrefix = `[Platform Setup] -> `;
    this.loggerPrefix = loggerPrefix;

    this.config = config as ConfigSchema;

    this.log.debug(loggerPrefix, 'Finished initializing platform:', config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they were not added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      this.log.debug(loggerPrefix, 'Executed didFinishLaunching callback');

      // Check if the config is valid. We do this here to prevent bugs later.
      // It also helps the user in setting the config properly, if not used from within the UI, but manually adjusted in the config.json file.
      if (!this.isValidConfigSchema(this.config)) {
        this.log.error(
          this.loggerPrefix,
          `Please fix the issues in your config.json file for this plugin. Once fixed, restart Homebridge.`,
        );
        return;
      }

      // Automatically discover Energy Sockets if no Energy Sockets are configured
      if (!this.config.energySockets?.length) {
        this.startDiscoveringDevices();

        return;
      }

      // When we end up here, there are Energy Sockets found in the config, so we skip automatic discovery

      this.handleEnergySocketsFromConfig();
    });

    // On Homebridge shutdown, cleanup some things
    // Note: this is not called when our plugin is uninstalled
    this.api.on(APIEvent.SHUTDOWN, () => {
      this.stopDiscoveringDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>): void {
    this.log.debug(this.loggerPrefix, `Loading accessory from cache: ${accessory.displayName}`);

    this.cachedAccessories.push(accessory);
  }

  /**
   * An accessory is stale if it is not present in the config anymore, but is found in the cache.
   *
   * We should remove the accessory from the bridge if it's considered stale.
   */
  isStaleCachedAccessory(
    cachedAccessory: PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>,
    energySocketsConfig: ConfigSchema['energySockets'],
  ): boolean {
    if (!energySocketsConfig) return false;

    const configIps = energySocketsConfig.map(energySocket => energySocket.ip);

    const accessoryIp = cachedAccessory.context.energySocket.ip;

    const isIpStillInConfig = configIps.includes(accessoryIp);

    // It is stale if the IP is not present in the config anymore
    return !isIpStillInConfig;
  }

  stopDiscoveringDevices(): void {
    if (this.bonjour) {
      this.log.info(
        this.loggerPrefix,
        'Stopping automatic discovering Energy Sockets in your network...',
      );

      this.bonjour.destroy();

      this.bonjour = null;
    }
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  startDiscoveringDevices(): void {
    this.log.info(this.loggerPrefix, 'Automatically discovering Energy Sockets in your network...');

    this.bonjour = new Bonjour();

    const browser = this.bonjour.find({
      protocol: MDNS_DISCOVERY_PROTOCOL,
      type: MDNS_DISCOVERY_TYPE,
    });

    browser.on('up', (service: BonjourService) => {
      this.handleDiscoveredService(service);
    });

    browser.on('down', (service: BonjourService) => {
      this.log.info(this.loggerPrefix, `HomeWizard device appears to be down: ${service.host}`);
      // TODO: handle?
    });

    browser.on('error', (error: Error) => {
      this.log.error(this.loggerPrefix, `Error while discovering devices: ${error.message}`);
    });
  }

  isDeviceApiEnabled(txtRecord: MdnsTxtRecord): boolean {
    return txtRecord.api_enabled === '1';
  }

  isDeviceProductTypeSupported(txtRecord: MdnsTxtRecord): boolean {
    return txtRecord.product_type === 'HWE-SKT';
  }

  async handleDiscoveredService(service: BonjourService): Promise<void> {
    const txtRecord = service.txt as MdnsTxtRecord;

    // Skip if the device is not an Energy Socket
    if (!this.isDeviceProductTypeSupported(txtRecord)) {
      this.log.debug(
        this.loggerPrefix,
        `Found a device that is not an Energy Socket, skipping`,
        JSON.stringify(txtRecord),
      );
      return;
    }

    // Skip if the device has not enabled the "Local API" setting
    if (!this.isDeviceApiEnabled(txtRecord)) {
      this.log.info(
        this.loggerPrefix,
        `Found a Energy Socket, but it has not enabled the "Local API" setting, skipping. If you want to use this device, please enable the "Local API" setting in the HomeWizard app for Energy Socket with ID: ${txtRecord.serial}. Otherwise, you can ignore this message.`,
        JSON.stringify(txtRecord),
      );
      return;
    }

    // Service is an Energy Socket, and the Local API is enabled, so we can use it
    try {
      const { energySocketProperties, api } = await this.getEnergySocketPropertiesFromService(
        service,
      );

      this.addAccessory(energySocketProperties, api);
    } catch (error) {
      this.log.error(
        this.loggerPrefix,
        `Error while handling discovered service: ${JSON.stringify(error)}`,
      );
    }
  }

  /**
   * We should prevent the plugin from starting if the config is invalid.
   */
  isValidConfigSchema(config: ConfigSchema): boolean {
    try {
      configSchema.parse(config);

      return true;
    } catch (err) {
      if (err instanceof ZodError) {
        const mappedErrors = err.errors.map(err => {
          return `${err.message} at ${err.path.join('.')}`;
        });

        this.log.error(
          this.loggerPrefix,
          `There is an error in your config: ${JSON.stringify(mappedErrors)}`,
        );

        return false;
      }

      this.log.error(
        this.loggerPrefix,
        `A unknown error happened while validation your config: ${JSON.stringify(err)}`,
      );

      return false;
    }
  }

  async handleEnergySocketsFromConfig(): Promise<void> {
    const energySocketsConfig = this.config.energySockets;

    if (!energySocketsConfig || !energySocketsConfig.length) {
      this.log.warn(
        this.loggerPrefix,
        `No Energy Sockets are configured, we stop. You can configure them in the config.json`,
      );

      return;
    }

    this.log.debug(
      this.loggerPrefix,
      `Found ${energySocketsConfig?.length} Energy Sockets in config, skipping automatic discovery...`,
    );

    // First, check if there are accessories in the cache that do not exist anymore in the config
    // We should remove these
    const staleCachedAccessories = this.cachedAccessories.filter(accessory => {
      return this.isStaleCachedAccessory(accessory, energySocketsConfig);
    });

    if (staleCachedAccessories.length) {
      this.log.debug(
        this.loggerPrefix,
        `Found ${staleCachedAccessories.length} stale cached accessories. We will remove them...`,
      );

      for (const staleCachedAccessory of staleCachedAccessories) {
        this.log.debug(
          this.loggerPrefix,
          `Removing stale cached accessory: ${staleCachedAccessory.displayName} (${staleCachedAccessory.UUID})`,
        );

        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [staleCachedAccessory]);

        const updatedCachedAccessories = this.cachedAccessories.filter(
          accessory => accessory.UUID !== staleCachedAccessory.UUID,
        );

        this.cachedAccessories = [...updatedCachedAccessories];
      }
    }

    for (const energySocket of energySocketsConfig) {
      try {
        const { energySocketProperties, api } = await this.getEnergySocketPropertiesFromIp(
          energySocket.ip,
          energySocket.name,
        );

        this.addAccessory(energySocketProperties, api);
      } catch (error) {
        this.log.error(
          this.loggerPrefix,
          `Error while handling energy socket from config: ${JSON.stringify(error)}`,
        );
      }
    }
  }

  addAccessory(energySocketProperties: EnergySocketAccessoryProperties, api: EnergySocketApi) {
    try {
      const existingAccessory = this.cachedAccessories.find(
        accessory => accessory.UUID === energySocketProperties.uuid,
      ) as PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>;

      if (!existingAccessory) {
        // The accessory does not yet exist, so we need to create it

        this.log.info(
          this.loggerPrefix,
          'Adding new accessory:',
          energySocketProperties.displayName,
          energySocketProperties.apiUrl,
          energySocketProperties.uuid,
        );

        // Create a new accessory
        const newAccessory =
          new this.api.platformAccessory<HomeWizardEnergyPlatformAccessoryContext>(
            energySocketProperties.displayName,
            energySocketProperties.uuid,
          );

        // Store a copy of our `energySocketProperties` in the `accessory.context`
        // The `context` property can be used to store any data about the accessory we need to control this device
        newAccessory.context.energySocket = energySocketProperties;

        // Create the accessory handler for the newly create accessory
        this.attachAccessoryToPlatform(newAccessory, api);

        // Link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [newAccessory]);

        return;
      }

      // When we end up here, accessory is found in cache

      // The accessory already exists, so we can restore it from our cache
      this.log.info(
        this.loggerPrefix,
        `Restoring existing accessory from cache: ${existingAccessory.displayName}`,
      );

      // Update the existing accessory with the new data, for example, the IP address might have changed
      existingAccessory.context.energySocket = energySocketProperties;
      this.api.updatePlatformAccessories([existingAccessory]);

      // Create the accessory handler for the restored accessory
      this.attachAccessoryToPlatform(existingAccessory, api);
    } catch (error) {
      this.log.error(
        this.loggerPrefix,
        `Error while adding the accessory: ${JSON.stringify(error)}`,
      );
    }
  }

  attachAccessoryToPlatform(
    accessory: PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>,
    api: EnergySocketApi,
  ): void {
    this.log.debug(this.loggerPrefix, 'Attaching accessory to platform:', accessory.displayName);

    // Create the accessory handler for the restored accessory
    new EnergySocketAccessory(this, accessory, api);
    new EnergySocketAccessoryPowerStatus(this, accessory, api);
  }

  async getEnergySocketPropertiesFromIp(
    ip: string,
    configName?: string,
  ): Promise<{
    energySocketProperties: EnergySocketAccessoryProperties;
    api: EnergySocketApi;
  }> {
    this.log.info(
      this.loggerPrefix,
      `Using IP ${ip} to find information about the Energy Socket...`,
    );

    const energySocketConfig = this.config.energySockets?.find(
      energySocket => energySocket.ip === ip,
    );

    // do not use hostname, because its too slow for Homekit, because it will need to resolve the hostname to an IP address first,
    // the lookup is blocking nodejs I/O, so it can take longer than homekit and homebridge likes
    // apiUrl: `http://${hostname}:${port}`,
    const apiUrl = `http://${ip}`;

    try {
      const api = new EnergySocketApi(apiUrl, {
        polling: {
          interval: POLLING_INTERVAL,
        },
      });

      // Call the basic endpoint to get the firmware version
      // this is not available in the txt record, but required for our accessory
      const [basicInformation, data] = await Promise.all([
        api.getBasicInformation(),
        api.getData(),
      ]);

      // Get the initial active power value, even if
      const activePower = data.active_power_w || null;

      const firmwareVersion = basicInformation.firmware_version;
      const productName = basicInformation.product_name;
      const productType = basicInformation.product_type as SupportedDevices; // TODO: check for valid product type
      const serialNumber = basicInformation.serial;
      const apiVersion = basicInformation.api_version;

      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(serialNumber);

      const displayName = configName ? configName : `${productName} ${serialNumber}`; // "Energy Socket 3c12e7659852", which is used as the name in HomeKit

      const energySocketProperties = {
        uuid,
        ip,
        apiVersion,
        apiUrl,
        serialNumber: serialNumber,
        productName,
        displayName,
        productType,
        firmwareVersion,
        activePower,
        config: energySocketConfig,
      } satisfies EnergySocketAccessoryProperties;

      this.log.debug(
        this.loggerPrefix,
        'Will use this info from service to setup the accessory: ',
        JSON.stringify(energySocketProperties),
      );

      this.log.info(
        this.loggerPrefix,
        'Found Energy Socket: ',
        JSON.stringify(energySocketProperties),
      );

      return { energySocketProperties, api };
    } catch (error) {
      const errorMessage = `Could not get basic information from the Energy Socket, skipping: ${JSON.stringify(
        error,
      )}`;
      this.log.error(this.loggerPrefix, errorMessage);

      throw new Error(errorMessage);
    }
  }

  /**
   * Method to extract relevant accessory information from a Bonjour service
   */
  async getEnergySocketPropertiesFromService(service: BonjourService): Promise<{
    energySocketProperties: EnergySocketAccessoryProperties;
    api: EnergySocketApi;
  }> {
    this.log.debug(
      this.loggerPrefix,
      `Received data from Bonjour service: ${JSON.stringify(service)}`,
    );

    const ip = service.addresses?.[0] as string; // get the first address

    try {
      const energySocketProperties = await this.getEnergySocketPropertiesFromIp(ip);

      return energySocketProperties;
    } catch (error) {
      const errorMessage = `Could not get basic information from the Energy Socket, skipping: ${JSON.stringify(
        error,
      )}`;
      this.log.error(this.loggerPrefix, errorMessage);

      throw new Error(errorMessage);
    }
  }
}
