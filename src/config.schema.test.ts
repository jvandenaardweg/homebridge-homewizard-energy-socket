import configSchemaJson from '../config.schema.json';
import { DEFAULT_OUTLETINUSE_THRESHOLD, DEFAULT_OUTLETINUSE_THRESHOLD_DURATION } from './settings';

import { HomebridgeHomeWizardEnergySocketsConfig } from './types';

// Sanity check, as we don't import config.schema.json in our code, we have no type-safety over the config.schema.json values and our types
// These tests will fail if we change names or requirements in config.schema.json that are not reflected in our types
describe('config.schema.json', () => {
  it('Should have the correct energySocket property', async () => {
    const energySocketsProperty: keyof HomebridgeHomeWizardEnergySocketsConfig = 'energySockets';

    const properties = configSchemaJson.schema.properties;

    // now we get an error if we change the property name in config.schema.json and/or our types
    expect(properties).toHaveProperty(energySocketsProperty);
    expect(properties.energySockets).not.toHaveProperty('required');
    expect(properties.energySockets.type).toBe('array');

    expect(properties.energySockets.items.type).toBe('object');

    const energySocketProperties = properties.energySockets.items.properties;

    // name
    expect(energySocketProperties.name.type).toBe('string');
    expect(energySocketProperties.name.required).toBe(true);

    // ip
    expect(energySocketProperties.ip.type).toBe('string');
    expect(energySocketProperties.ip.required).toBe(true);
    expect(energySocketProperties.ip.format).toBe('ipv4');

    // outletInUse
    expect(energySocketProperties.outletInUse.type).toBe('object');

    const outletInUseProperties = energySocketProperties.outletInUse.properties;

    // outletInUse isActive
    expect(outletInUseProperties.isActive.type).toBe('boolean');
    expect(outletInUseProperties.isActive.default).toBe(false);
    expect(outletInUseProperties.isActive.required).toBe(false);

    // outletInUse threshold
    expect(outletInUseProperties.threshold.type).toBe('number');
    expect(outletInUseProperties.threshold.default).toBe(DEFAULT_OUTLETINUSE_THRESHOLD);
    expect(outletInUseProperties.threshold.minimum).toBe(0.1); // do not allow 0, as that would mean that the outlet is always in use, which is not where this config option is for
    expect(outletInUseProperties.threshold.maximum).toBe(3680); // the max power of a socket is 3680W, see: https://www.homewizard.com/energy-socket/
    expect(outletInUseProperties.threshold.required).toBe(true);

    // outletInUse thresholdDuration
    expect(outletInUseProperties.thresholdDuration.type).toBe('number');
    expect(outletInUseProperties.thresholdDuration.default).toBe(
      DEFAULT_OUTLETINUSE_THRESHOLD_DURATION,
    );
    expect(outletInUseProperties.thresholdDuration.minimum).toBe(0);
    expect(outletInUseProperties.thresholdDuration.maximum).toBe(86400); // 1 day in seconds
    expect(outletInUseProperties.thresholdDuration.required).toBe(true);
  });

  it('Should have the correct name property', async () => {
    const nameProperty: keyof HomebridgeHomeWizardEnergySocketsConfig = 'name';

    const properties = configSchemaJson.schema.properties;

    // now we get an error if we change the property name in config.schema.json and/or our types
    expect(properties).toHaveProperty(nameProperty);
    expect(properties.name).toHaveProperty('required');
    expect(properties.name.required).toBe(true);
    expect(properties.name.type).toBe('string');
    expect(properties.name.default).toBe('HomeWizard Energy Socket');
  });
});
