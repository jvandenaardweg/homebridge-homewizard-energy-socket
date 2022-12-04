/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 */
export const PLATFORM_NAME = "HomebridgeHomeWizardEnergy";

/**
 * This must match the name of your plugin as defined the package.json
 */
export const PLUGIN_NAME = "homebridge-homewizard-energy";

export const ENERGY_SOCKET_PRODUCT_TYPE = "HWE-SKT";

export const PLATFORM_MANUFACTURER = "HomeWizard";

/**
 * We can discover devices on the local network using the `_hwenergy._tcp` domain.
 *
 * The Bonjour service we use in our plugin only needs `hwenergy` and use the option `protocol: 'tcp'`.
 *
 * @link: https://homewizard-energy-api.readthedocs.io/discovery.html#discovery
 */
export const MDNS_DISCOVERY_TYPE = "hwenergy";
export const MDNS_DISCOVERY_PROTOCOL = "tcp";
