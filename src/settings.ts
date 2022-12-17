/**
 * This is the name of the platform that users will use to register the plugin in the Homebridge config.json
 *
 * This name should match `pluginAlias` in config.schema.json
 */
export const PLATFORM_NAME = 'HomebridgeHomeWizardEnergySocket';

/**
 * This must match the name of your plugin as defined the package.json
 */
export const PLUGIN_NAME = 'homebridge-homewizard-energy-socket';

export const POLLING_INTERVAL = 1000; // in ms
export const SHOW_POLLING_ERRORS_INTERVAL = (15 * 60 * 1000) / POLLING_INTERVAL; // Show error every 15 minutes, if we poll every 1 second that's every 900 errors
