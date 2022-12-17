import { SupportedDevices } from 'homewizard-energy-api';
import { ConfigSchemaEnergySocket } from './config.schema';

export interface EnergySocketAccessoryProperties {
  /** Accessory UUID, used to identify the accessory within HomeBridge. This uuid is generated from the `id` and `serialNumber`, which are the same. */
  uuid: string;
  /** The IP address of the device. Example: `"192.168.1.20"` */
  ip: string;
  /** The version of the API. Example: `"v1"` */
  apiVersion: string;
  /** The API url of this device, without trailing slash. Example: "`http://192.168.1.20`" */
  apiUrl: string;
  /** The serial number of the device. Example: `"3c12e7659852"`. This is also a the Mac address of the device. */
  serialNumber: string;
  /** The product name of this device. Example: `"Energy Socket"` */
  productName: string;
  /** A device type identifier. Example: `"HWE-SKT"` */
  productType: SupportedDevices;
  /** The name we display to the user during first setup in the Home App, like: `"Energy Socket 3c12e7659852"` */
  displayName: string;
  /** The firmware version of the device. Some API features are not available based on the firmware version. Example: `"3.0"` */
  firmwareVersion: string;
  /** The initial active power value in watts. Example: `2.45` */
  activePower: number | null;
  /** The config options for this energy socket as defined by the user. Attached to this energy socket by IP. */
  config?: ConfigSchemaEnergySocket;
}

export interface HomeWizardEnergyPlatformAccessoryContext {
  energySocket: EnergySocketAccessoryProperties;
}

export const PLATFORM_MANUFACTURER = 'HomeWizard';

/**
 * We can discover devices on the local network using the `_hwenergy._tcp` domain.
 *
 * The Bonjour service we use in our plugin only needs `hwenergy` and use the option `protocol: 'tcp'`.
 *
 * @link: https://homewizard-energy-api.readthedocs.io/discovery.html#discovery
 */
export const MDNS_DISCOVERY_TYPE = 'hwenergy';
export const MDNS_DISCOVERY_PROTOCOL = 'tcp';
