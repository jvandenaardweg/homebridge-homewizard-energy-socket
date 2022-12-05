import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
  APIEvent,
} from "homebridge";
import Bonjour, { Service as BonjourService } from "bonjour-service";

import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";
import { EnergySocketAccessory } from "./energySocketAccessory";
import {
  EnergySocketAccessoryProperties,
  ENERGY_SOCKET_PRODUCT_TYPE,
  HomeWizardEnergyConfig,
  HomeWizardEnergyPlatformAccessoryContext,
  MDNS_DISCOVERY_PROTOCOL,
  MDNS_DISCOVERY_TYPE,
  TxtRecord,
} from "./types";

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgeHomeWizardEnergySocket implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  public readonly cachedAccessories: PlatformAccessory[] = [];

  private config: HomeWizardEnergyConfig;

  private bonjour: Bonjour;

  private loggerPrefix: string;

  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    public readonly log: Logger,
    config: PlatformConfig,
    public readonly api: API
  ) {
    const loggerPrefix = `Platform Setup -> `;
    this.loggerPrefix = loggerPrefix;

    this.config = config as HomeWizardEnergyConfig;

    this.bonjour = new Bonjour();

    this.log.debug(
      loggerPrefix,
      "Finished initializing platform:",
      config.name
    );

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren`t added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.debug(loggerPrefix, "Executed didFinishLaunching callback");
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });

    // On Homebridge shutdown, cleanup some things
    // Note: this is not called when our plugin is uninstalled
    // TODO: handle uninstall/restart of plugin due to intervals and watchers
    this.api.on(APIEvent.SHUTDOWN, () => {
      this.bonjour.destroy();

      if (this.interval) {
        clearInterval(this.interval);
      }
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(
    accessory: PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>
  ): void {
    this.log.info(
      this.loggerPrefix,
      `Loading accessory from cache: ${accessory.displayName} ${accessory.context.energySocket.hostname}`
    );

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.cachedAccessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }

    // const SCAN_INTERVAL_IN_MINUTES = 0.1;

    this.log.info(
      this.loggerPrefix,
      "Finding HomeWizard devices in your network..."
    );

    // TODO: handle device ip changes
    // TODO: handle device down

    const browser = this.bonjour.find({
      protocol: MDNS_DISCOVERY_PROTOCOL,
      type: MDNS_DISCOVERY_TYPE,
    });

    browser.on("up", (service: BonjourService) => {
      this.handleDiscoveredService(service);
    });

    browser.on("down", (service: BonjourService) => {
      this.log.info(
        this.loggerPrefix,
        `HomeWizard device appears to be down: ${service.host}`
      );
      // TODO: handle?
    });

    browser.on("error", (error: Error) => {
      this.log.error(
        this.loggerPrefix,
        `Error while discovering devices: ${error.message}`
      );
    });

    // Broadcast the find query again every 15 minutes
    // so if devices change ip addresses, we can find them again
    // this.interval = setInterval(() => {
    //   this.log.info(
    //     this.loggerPrefix,
    //     `Scanning for updates on HomeWizard devices in your network... (${SCAN_INTERVAL_IN_MINUTES} minutes interval)`
    //   );
    //   browser.start();
    // }, SCAN_INTERVAL_IN_MINUTES * 60 * 1000);
  }

  isDeviceApiEnabled(txtRecord: TxtRecord): boolean {
    return txtRecord.api_enabled === "1";
  }

  isDeviceProductTypeSupported(txtRecord: TxtRecord): boolean {
    return txtRecord.product_type === ENERGY_SOCKET_PRODUCT_TYPE;
  }

  handleDiscoveredService(service: BonjourService): void {
    const txtRecord = service.txt as TxtRecord;

    // Skip if the device has not enabled the "Local API" setting
    if (!this.isDeviceApiEnabled(txtRecord)) {
      this.log.info(
        this.loggerPrefix,
        `Found a Energy Socket, but it has not enabled the "Local Api" setting, skipping`,
        JSON.stringify(txtRecord)
      );
      return;
    }

    // Skip if the device is not an Energy Socket
    if (!this.isDeviceProductTypeSupported(txtRecord)) {
      this.log.info(
        this.loggerPrefix,
        `Found a device that is not an Energy Socket (${ENERGY_SOCKET_PRODUCT_TYPE}), skipping`,
        JSON.stringify(txtRecord)
      );
      return;
    }

    // TODO: Skip if "Switch lock" setting is on

    // Service is an Energy Socket, and the Local API is enabled, so we can use it

    const energySocketProperties =
      this.getEnergySocketPropertiesFromService(service);

    const existingAccessory = this.cachedAccessories.find(
      (accessory) => accessory.UUID === energySocketProperties.uuid
    ) as PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>;

    if (!existingAccessory) {
      // The accessory does not yet exist, so we need to create it
      const displayName = `${energySocketProperties.name} ${energySocketProperties.serialNumber}`; // Energy Socket (3c12e7659852)
      const uuid = energySocketProperties.uuid;

      this.log.info(
        this.loggerPrefix,
        "Adding new accessory:",
        displayName,
        energySocketProperties.apiUrl,
        energySocketProperties.uuid
      );

      // Create a new accessory
      const newAccessory =
        new this.api.platformAccessory<HomeWizardEnergyPlatformAccessoryContext>(
          displayName,
          uuid
        );

      // Store a copy of our `energySocketProperties` in the `accessory.context`
      // The `context` property can be used to store any data about the accessory we need to control this device
      newAccessory.context.energySocket = energySocketProperties;

      // Create the accessory handler for the newly create accessory
      new EnergySocketAccessory(this, newAccessory);

      // Link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        newAccessory,
      ]);

      return;
    }

    // The accessory already exists, so we can restore it from our cache
    this.log.info(
      this.loggerPrefix,
      `Restoring existing accessory from cache: ${existingAccessory.displayName}`
    );

    // Update the existing accessory with the new data, for example, the IP address might have changed
    existingAccessory.context.energySocket = energySocketProperties;
    this.api.updatePlatformAccessories([existingAccessory]);

    // Create the accessory handler for the restored accessory
    new EnergySocketAccessory(this, existingAccessory);

    // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
    // remove platform accessories when no longer present
    // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
    // this.log.info(this.loggerPrefix,'Removing existing accessory from cache:', existingAccessory.displayName);
  }

  /**
   * Method to extract relevant accessory information from a Bonjour service
   */
  getEnergySocketPropertiesFromService(
    service: BonjourService
  ): EnergySocketAccessoryProperties {
    const txtRecord = service.txt as TxtRecord;

    this.log.debug(
      this.loggerPrefix,
      `Received data from Bonjour service: ${JSON.stringify(service)}`
    );

    const hostname = service.host; // Example: energysocket-220852.local

    const serialNumber = txtRecord.serial;
    const mac =
      txtRecord.serial
        .match(/.{1,2}/g)
        ?.join(":")
        .toUpperCase() || ""; // The serial is the MAC address, but without the colons, so we add them here
    const path = txtRecord.path;
    const name = txtRecord.product_name;
    const type = txtRecord.product_type;
    const ip = service.addresses?.[0] as string; // get the first address
    const port = service.port; // 80
    const displayName = `${name} ${serialNumber}`; // Energy Socket (3c12e7659852)

    // generate a unique id for the accessory this should be generated from
    // something globally unique, but constant, for example, the device serial
    // number or MAC address
    const uuid = this.api.hap.uuid.generate(serialNumber);

    const energySocketInfo = {
      uuid,
      id: serialNumber,
      ip,
      mac,
      port,
      hostname,
      path,
      // do not use hostname, because its too slow for Homekit, because it will need to resolve the hostname to an IP address first,
      // the lookup is blocking nodejs I/O, so it can take longer than homekit and homebridge likes
      // apiUrl: `http://${hostname}:${port}`,
      apiUrl: `http://${ip}:${port}`,
      serialNumber: serialNumber,
      name,
      displayName,
      type,
    } satisfies EnergySocketAccessoryProperties;

    this.log.debug(
      this.loggerPrefix,
      "Will use this info from service to setup the accessory: ",
      JSON.stringify(energySocketInfo)
    );

    this.log.info(
      this.loggerPrefix,
      "Found Energy Socket: ",
      JSON.stringify(energySocketInfo)
    );

    return energySocketInfo;
  }
}
