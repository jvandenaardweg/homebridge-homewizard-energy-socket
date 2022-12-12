import configSchemaJson from '../config.schema.json';

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

    // name
    expect(properties.energySockets.items.properties.name.type).toBe('string');
    expect(properties.energySockets.items.properties.name.required).toBe(true);

    // ip
    expect(properties.energySockets.items.properties.ip.type).toBe('string');
    expect(properties.energySockets.items.properties.ip.required).toBe(true);
    expect(properties.energySockets.items.properties.ip.format).toBe('ipv4');
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
