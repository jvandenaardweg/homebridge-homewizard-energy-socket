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

import { PLATFORM_NAME, PLUGIN_NAME } from '@/settings';
import { EnergySocketAccessory } from '@/energySocketAccessory';
import {
  EnergySocketAccessoryProperties,
  HomeWizardSupportedDeviceTypes,
  HomeWizardEnergyConfig,
  HomeWizardEnergyPlatformAccessoryContext,
  MDNS_DISCOVERY_TYPE,
  TxtRecord,
  MDNS_DISCOVERY_PROTOCOL,
  EnergySocketNetworkStatus,
} from '@/api/types';
import mdns from 'mdns';

type EnergySocketPlatformAccessory = PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>;

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgeHomeWizardEnergySocket implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly cachedAccessories: Record<string, EnergySocketPlatformAccessory> = {};
  public readonly attachedAccessories: Record<string, EnergySocketPlatformAccessory> = {};

  private config: HomeWizardEnergyConfig;
  private mdnsBrowser: mdns.Browser | null = null;
  private handleNotFoundCachedAccessoriesTimeout: NodeJS.Timeout | null = null;

  constructor(public readonly log: Logger, config: PlatformConfig, public readonly api: API) {
    this.config = config as HomeWizardEnergyConfig;

    this.log.debug(this.loggerPrefix, 'Finished initializing platform:', config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      this.discoverDevicesStart();

      // Handling not found cached accessories
      this.handleNotFoundCachedAccessoriesStart();
    });

    // On Homebridge shutdown, cleanup some things
    // Note: this is not called when our plugin is uninstalled
    this.api.on(APIEvent.SHUTDOWN, () => {
      this.discoverDevicesStop();

      this.handleNotFoundCachedAccessoriesStop();
    });
  }

  get loggerPrefix(): string {
    return `[Platform] -> `;
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(cachedAccessory: EnergySocketPlatformAccessory): void {
    this.log.info(
      this.loggerPrefix,
      `Loading accessory from cache: ${cachedAccessory.displayName} ${cachedAccessory.context.energySocket.hostname} ${cachedAccessory.context.energySocket.ip}`,
    );

    // Add the restored accessory to the accessories cache so we can track if it has already been registered
    this.cachedAccessories[cachedAccessory.UUID] = cachedAccessory;
  }

  /**
   * Discover HomeWizard devices on the network and register them as accessories.
   *
   * We use mDNS to discover devices on the network. We use the `serviceUp` event to register new devices.
   * We use the `serviceDown` event to remove devices that are no longer available.
   */
  discoverDevicesStart(): void {
    /**
     * Docs on createBrowser: https://agnat.github.io/node_mdns/user_guide.html
     */
    this.mdnsBrowser = mdns.createBrowser(mdns[MDNS_DISCOVERY_PROTOCOL](MDNS_DISCOVERY_TYPE), {
      resolverSequence: [
        mdns.rst.DNSServiceResolve(),
        'DNSServiceGetAddrInfo' in mdns.dns_sd
          ? mdns.rst.DNSServiceGetAddrInfo()
          : mdns.rst.getaddrinfo({ families: [4] }),
        mdns.rst.makeAddressesUnique(),
      ],
    });

    // Emitted when a new matching service is discovered.
    this.mdnsBrowser.on('serviceUp', this.handleOnDiscoverServiceUp.bind(this));

    // Emitted when a matching service disappears.
    this.mdnsBrowser.on('serviceDown', this.handleOnDiscoverServiceDown.bind(this));

    // Emitted when an error occurs. This sometimes happens on deviceDown events.
    this.mdnsBrowser.on('error', this.handleOnDiscoverError.bind(this));

    // Start discovering devices
    this.mdnsBrowser.start();

    this.log.info(this.loggerPrefix, 'Started finding HomeWizard devices in your network...');
  }

  discoverDevicesStop(): void {
    if (!this.mdnsBrowser) {
      return;
    }

    this.mdnsBrowser.removeAllListeners();
    this.mdnsBrowser.stop();

    this.mdnsBrowser = null;

    this.log.info(this.loggerPrefix, 'Stopped finding HomeWizard devices in your network.');
  }

  /**
   * This function is invoked when we have cached accessories that are not found anymore.
   * We will wait 5 seconds to wait for the mDNS discovery to finish.
   * If there are still cached accessories that are not found, we will restore them without the UNKNOWN status.
   * This is to make sure that the user can remove them from the Home App.
   */
  handleNotFoundCachedAccessoriesStart() {
    const TIMEOUT = 5 * 1000; // 5 seconds

    this.handleNotFoundCachedAccessoriesStop();

    this.handleNotFoundCachedAccessoriesTimeout = setTimeout(() => {
      console.log('timeout!');
      const totalAttachedAccessories = Object.keys(this.attachedAccessories).length;
      const totalCachedAccessories = Object.keys(this.cachedAccessories).length;

      if (totalAttachedAccessories === totalCachedAccessories) {
        this.log.debug(this.loggerPrefix, 'No stale cached accessories found. Which is OK!');
        return;
      }

      // If there's a mismatch...
      console.log('mismatch');

      // Find which cached accessory is not discovered anymore, we will restore it, so it becomes visible in the Home App for you to remove it.
      const staleCachedAccessories = Object.values(this.cachedAccessories).reduce<
        EnergySocketPlatformAccessory[]
      >((prev, cachedAccessory) => {
        const attachedAccessory = this.attachedAccessories[cachedAccessory.UUID];

        // If the accessory is not attached, it was not discovered by mDNS
        // We will add it to the stale cached accessories array
        if (!attachedAccessory) {
          return [...prev, cachedAccessory];
        }

        return prev;
      }, []);

      if (!staleCachedAccessories.length) {
        this.log.warn(
          this.loggerPrefix,
          `There was a mismatch in the total cached accessories (${totalCachedAccessories}) and attached accessories (${totalAttachedAccessories}). But found none stale accessories. This should not happen.`,
        );
        return;
      }

      const notFoundCachedAccessoriesIps = staleCachedAccessories
        .map(c => c.context.energySocket.ip)
        .join(', ');

      this.log.warn(
        `Found ${staleCachedAccessories.length} stale cached accessories (${notFoundCachedAccessoriesIps}) that are not available on your network anymore. We will restore it, so it becomes visible in the Home App for you to remove yourself when necessary. You can also ignore this message if the Energy Socket is just offline temporary.`,
      );

      // Restore each stale accessory with the UNKNOWN status
      // The user can manually remove it from the Home App
      staleCachedAccessories.forEach(staleCachedAccessory => {
        staleCachedAccessory.context.energySocket.networkStatus = EnergySocketNetworkStatus.UNKNOWN;

        this.api.updatePlatformAccessories([staleCachedAccessory]);
        this.attachAndCacheEnergySocketAccessory(staleCachedAccessory);
      });
    }, TIMEOUT);
  }

  handleNotFoundCachedAccessoriesStop() {
    if (this.handleNotFoundCachedAccessoriesTimeout) {
      clearTimeout(this.handleNotFoundCachedAccessoriesTimeout);
    }
  }

  handleOnDiscoverServiceUp(service: mdns.Service): void {
    this.log.info(this.loggerPrefix, `mDNS Network Change - Service Up: ${service.name}`);

    this.handleDiscoveredService(service);
  }

  handleOnDiscoverServiceDown(service: mdns.Service): void {
    // Only service.name is available when service is down
    const serviceName = service.name;

    this.log.info(
      this.loggerPrefix,
      `mDNS Network Change: Service Down: ${serviceName} -> ${JSON.stringify(service)}`,
    );

    const cachedAccessory = this.getCachedAccessoryByServiceName(serviceName);

    if (!cachedAccessory) {
      this.log.debug(
        this.loggerPrefix,
        'Service went down, accessory was not cached anyway, so no need to remove it',
      );
      return;
    }

    this.log.debug(
      this.loggerPrefix,
      'Service went down, accessory was cached, update network status to offline',
    );

    // Update the accessory network status so we can so proper debug messages when a device is offline
    cachedAccessory.context.energySocket.networkStatus = EnergySocketNetworkStatus.OFFLINE;
    this.api.updatePlatformAccessories([cachedAccessory]);
  }

  handleOnDiscoverError({ ...params }): void {
    this.log.error(this.loggerPrefix, 'mDNS Network Change: Error: ', JSON.stringify(params));
  }

  /**
   * Generate a UUID from the MDNS Service. Homebridge uses the UUID to identify accessories.
   */
  getAccessoryUUIDFromService(service: mdns.Service): string {
    const txtRecord = service.txtRecord as TxtRecord;

    return this.api.hap.uuid.generate(txtRecord.serial);
  }

  getCachedAccessoryByUUID(uuid: string): EnergySocketPlatformAccessory | undefined {
    return this.cachedAccessories[uuid];
  }

  getCachedAccessoryFromService(service: mdns.Service): EnergySocketPlatformAccessory | undefined {
    const uuid = this.getAccessoryUUIDFromService(service);

    return this.getCachedAccessoryByUUID(uuid);
  }

  getCachedAccessoryByServiceName(
    serviceName: string | undefined,
  ): EnergySocketPlatformAccessory | undefined {
    const cachedAccessory = Object.values(this.cachedAccessories).find(
      cachedAccessory => cachedAccessory.context.energySocket.serviceName === serviceName,
    );

    return cachedAccessory;
  }

  /**
   * Check if the device API is enabled using the txt record provided by the mDNS service.
   */
  isDeviceApiEnabled(txtRecord: TxtRecord): boolean {
    return txtRecord.api_enabled === '1';
  }

  /**
   * Check if the device is an Energy Socket using the txt record provided by the mDNS service.
   */
  isDeviceProductTypeSupported(txtRecord: TxtRecord): boolean {
    return txtRecord.product_type === HomeWizardSupportedDeviceTypes.WIFI_ENERGY_SOCKET;
  }

  handleDiscoveredService(service: mdns.Service): void {
    const txtRecord = service.txtRecord as TxtRecord;

    // Skip if the device is not an Energy Socket
    if (!this.isDeviceProductTypeSupported(txtRecord)) {
      // Not relevant to know for the user, just use a debug log message
      this.log.debug(
        this.loggerPrefix,
        `Found a device that is not an Energy Socket (${HomeWizardSupportedDeviceTypes.WIFI_ENERGY_SOCKET}), skipping`,
        JSON.stringify(txtRecord),
      );
      return;
    }

    // Device is an Energy Socket, continue...

    // Skip if the device has not enabled the "Local API" setting
    if (!this.isDeviceApiEnabled(txtRecord)) {
      // Very relevant for the user to know, show a warning in the logs
      this.log.warn(
        this.loggerPrefix,
        `Found a Energy Socket, but it has not enabled the "Local Api" setting, skipping`,
        JSON.stringify(txtRecord),
      );
      return;
    }

    // Device is an Energy Socket, and the Local API is enabled, continue...

    // We do not check if Switch lock is disabled, because then we have to re-discover the device
    // We'll handle notifying about the Switch lock setting when the user tries to control the device,
    // so it will automatically work when the user disables the Switch lock setting from within the Energy App

    const energySocketProperties = this.getEnergySocketPropertiesFromDiscoveredService(service);

    const cachedAccessory = this.getCachedAccessoryByUUID(energySocketProperties.uuid);

    if (!cachedAccessory) {
      // The accessory does not yet exist, so we need to create it

      this.log.info(
        this.loggerPrefix,
        'Creating new accessory:',
        energySocketProperties.displayName,
        energySocketProperties.ip,
        energySocketProperties.uuid,
      );

      // Create a new accessory
      const newAccessory = new this.api.platformAccessory<HomeWizardEnergyPlatformAccessoryContext>(
        energySocketProperties.displayName,
        energySocketProperties.uuid,
      );

      // We store a copy of our `energySocketProperties` in the `accessory.context`
      // The `context` property can be used to store any data about the accessory we need to control this device
      newAccessory.context.energySocket = energySocketProperties;

      // Create the accessory handlers for the newly create accessory
      this.attachAndCacheEnergySocketAccessory(newAccessory);

      // Link the accessory to our platform
      // this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [newAccessory]);

      // Publish the accessory as a "external" accessory, so you can manually remove this accessory from the Home app
      // Not publishing this accessory as external will make it impossible to remove it from the Home app without deleting the whole bridge and thus all accessories.
      this.api.publishExternalAccessories(PLUGIN_NAME, [newAccessory]);

      return;
    }

    // The accessory already exists, so we can restore it from our cache
    this.log.info(
      this.loggerPrefix,
      `Energy Socket is found in accessory cache. Restoring and updating: ${cachedAccessory.displayName}`,
    );

    // Update the existing accessory with the new data, for example, some data might have changed over time
    cachedAccessory.context.energySocket = energySocketProperties;
    this.api.updatePlatformAccessories([cachedAccessory]);

    this.log.debug(
      this.loggerPrefix,
      `Updated existing accessory from cache with: ${JSON.stringify(energySocketProperties)}`,
    );

    // Create the accessory handler for the restored accessory
    // This will run the constructor function again, which is needed to update event handlers
    this.attachAndCacheEnergySocketAccessory(cachedAccessory);
  }

  removeAccessory(cachedAccessory: EnergySocketPlatformAccessory) {
    // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
    // remove platform accessories when no longer present
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [cachedAccessory]);

    delete this.cachedAccessories[cachedAccessory.UUID];
    delete this.attachedAccessories[cachedAccessory.UUID];

    this.log.info(
      this.loggerPrefix,
      'Removing existing accessory from cache:',
      cachedAccessory.displayName,
    );
  }

  /**
   * This method is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   *
   * Keep track of what accessories are attached.
   *
   */
  attachAndCacheEnergySocketAccessory(cachedAccessory: EnergySocketPlatformAccessory) {
    new EnergySocketAccessory(this, cachedAccessory);

    this.attachedAccessories[cachedAccessory.UUID] = cachedAccessory;
    this.cachedAccessories[cachedAccessory.UUID] = cachedAccessory;
  }

  /**
   * Method to extract relevant accessory information from a Bonjour service
   */
  getEnergySocketPropertiesFromDiscoveredService(
    service: mdns.Service,
  ): EnergySocketAccessoryProperties {
    const txtRecord = service.txtRecord as TxtRecord;

    const hostname = service.host; // Example: energysocket-220852.local. (with trailing dot)

    const serialNumber = txtRecord.serial;
    const path = txtRecord.path;
    const productName = txtRecord.product_name;
    const productType = txtRecord.product_type;
    const ip = service.addresses?.[0] as string; // get the first address
    const port = service.port; // 80
    const displayName = `${productName} ${serialNumber}`; // "Energy Socket 3c12e7659852", which is used as the name in HomeKit
    const serviceName = service.name || service.host.split('.')[0]; // service.name could be undefined according to the types, fallback to using the host without .local, which is the same "energysocket-220852"
    const networkStatus = EnergySocketNetworkStatus.ONLINE;

    // generate a unique id for the accessory this should be generated from
    // something globally unique, but constant, for example, the device serial
    // number or MAC address
    const uuid = this.getAccessoryUUIDFromService(service);

    const energySocketProperties = {
      uuid,
      ip,
      port,
      hostname,
      serviceName,
      path,
      serialNumber,
      displayName,
      productName,
      productType,
      networkStatus,
    } satisfies EnergySocketAccessoryProperties;

    this.log.info(
      this.loggerPrefix,
      'Found Energy Socket using mdns: ',
      JSON.stringify(energySocketProperties),
    );

    return energySocketProperties;
  }
}
