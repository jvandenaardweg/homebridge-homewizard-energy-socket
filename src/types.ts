import { PlatformConfig } from "homebridge";

export interface TxtRecord {
  /** Indicates if the "Local API" is enabled. `"1"` = enabled, `"0"` = disabled */
  api_enabled: string;
  /** The path to the API. Example: `"/api/v1"` */
  path: string;
  /** The serial number of the device. Example: `"3c12e7659852"`. This is also a the Mac address of the device. */
  serial: string;
  /** The product name of this device. Example: `"Energy Socket"` */
  product_name: string;
  /** A device type identifier. Example: `"HWE-SKT"` */
  product_type: string;
}

export interface EnergySocketAccessoryProperties {
  /** Accessory UUID, used to identify the accessory within HomeBridge. This uuid is generated from the `id` and `serialNumber`, which are the same. */
  uuid: string;
  /** A unique identifier for the device, required by HomeBridge to generated the `uuid`. We use the serial number like: "3c23e75825d0" */
  id: string;
  /** Hostname of the device. Example: `"energysocket-185952.local"` */
  hostname: string;
  /** The IP address of the device. Example: `"192.168.1.20"` */
  ip: string;
  /** The Mac Address of the device. This is generated from the `serialNumber`. Example: `"3c:12:e7:65:98:52"`. */
  mac: string;
  /** The port at which the API of this device is running. Example: 80 */
  port: number;
  /** The path to the API. Example: `"/api/v1"` */
  path: string;
  /** The API url of this device, without trailing slash. Example: "`http://192.168.1.20`" */
  apiUrl: string;
  /** The serial number of the device. Example: `"3c12e7659852"`. This is also a the Mac address of the device. */
  serialNumber: string;
  /** The product name of this device. Example: `"Energy Socket"` */
  name: string;
  /** The `name` with the `serialNumber` included, like: `"Energy Socket (3c12e7659852)"` */
  displayName: string;
  /** A device type identifier. Example: `"HWE-SKT"` */
  type: string;
}

// extend when needed
export interface HomeWizardEnergyConfig extends PlatformConfig {
  empty: boolean;
}

/**
 * This response tells that the socket is ‘on’, switch-lock is ‘off’ and the brightness of the LED ring is set to maximum.
 *
 * @link: https://homewizard-energy-api.readthedocs.io/endpoints.html#state-api-v1-state
 */
export interface HomeWizardEnergySocketState {
  /** The state of the switch. Returns true when the relay is in the ‘on’ state */
  power_on: boolean;
  /** When set to true, the socket cannot be turned off. */
  switch_lock: boolean;
  /** Brightness of LED ring when socket is ‘on’. Value from 0 (0%) to 255 (100%) */
  brightness: number;
}

/**
 * The /api endpoint allows you to get basic information from the device.
 *
 * @link: https://homewizard-energy-api.readthedocs.io/endpoints.html#basic-information-api
 * @link: https://homewizard-energy-api.readthedocs.io/getting-started.html#supported-devices
 */
export interface HomeWizardApiResponse {
  /** The product type, see Supported devices. Make sure your application can handle other values for future products. Supported devices: https://homewizard-energy-api.readthedocs.io/getting-started.html#supported-devices */
  product_type: string;
  /** A fixed, user-friendly name. This name is not the same that is set by the user in the app. */
  product_name: string;
  /** Serial, also the MAC address. Consists of 12 hexadecimal values. */
  serial: string;
  /** The current firmware version. Make sure your application can handle other version formats. See Versioning and updates */
  firmware_version: string;
  /** The current api version, currently ‘v1’ */
  api_version: string;
}

export interface HomeWizardEnergyPlatformAccessoryContext {
  energySocket: EnergySocketAccessoryProperties;
}
