/**
 * See config.schema.json for the configuration options.
 *
 * All properties are optional, even if the config.schema.json says otherwise.
 * Because the user can adjust the config schema manually, we cannot entirely rely on the config.schema.json to be the source of truth.
 */
export interface EnergySocketConfig {
  name?: string;
  ip?: string;
  outletInUse?: {
    /** When enabled, the "OutletInUse" characteristic will be shown as "Yes" if the Energy Socket is drawing power. You can trigger automations based on this characteristic. By default this characteristic is "No". */
    isActive?: boolean;
    /** When the power consumption is higher than this threshold, the "OutletInUse" characteristic will be shown as "Yes" in the Home app. Defaults to 1 watt. */
    threshold?: number;
    /** When the power consumption is higher than the threshold for this duration, the "OutletInUse" characteristic will be shown as "Yes" in the Home app. Defaults to 10 seconds. */
    thresholdDuration?: number;
  };
}

export type WithRequiredProperty<Type, Key extends keyof Type> = Type & {
  [Property in Key]-?: Type[Property];
};
