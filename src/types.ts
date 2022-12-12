import { PlatformConfig } from 'homebridge';

export interface EnergySocketConfig {
  name: string;
  ip: string;
}

/**
 * See config.schema.json for the configuration options.
 */
export interface HomebridgeHomeWizardEnergySocketsConfig extends PlatformConfig {
  energySockets?: EnergySocketConfig[];
}
