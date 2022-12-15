import { ZodError } from 'zod';
import configSchemaJson from '../config.schema.json';
import {
  configSchema,
  ConfigSchema,
  DEFAULT_OUTLETINUSE_THRESHOLD,
  DEFAULT_OUTLETINUSE_THRESHOLD_DURATION,
  DEFAULT_OUTLETINUSE_THRESHOLD_DURATION_MAX,
  DEFAULT_OUTLETINUSE_THRESHOLD_DURATION_MIN,
  DEFAULT_OUTLETINUSE_THRESHOLD_MAX,
  DEFAULT_OUTLETINUSE_THRESHOLD_MIN,
} from './config.schema';
import { PLATFORM_NAME } from './settings';

// Sanity check, as we don't import config.schema.json in our code, we have no type-safety over the config.schema.json values and our types
// These tests will fail if we change names or requirements in config.schema.json that are not reflected in our types
describe('config.schema.json', () => {
  it('should have the correct energySocket property', async () => {
    const energySocketsProperty: keyof ConfigSchema = 'energySockets';

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
    expect(outletInUseProperties.threshold.minimum).toBe(DEFAULT_OUTLETINUSE_THRESHOLD_MIN); // do not allow 0, as that would mean that the outlet is always in use, which is not where this config option is for
    expect(outletInUseProperties.threshold.maximum).toBe(DEFAULT_OUTLETINUSE_THRESHOLD_MAX); // the max power of a socket is 3680W, see: https://www.homewizard.com/energy-socket/
    expect(outletInUseProperties.threshold.required).toBe(true);

    // outletInUse thresholdDuration
    expect(outletInUseProperties.thresholdDuration.type).toBe('number');
    expect(outletInUseProperties.thresholdDuration.default).toBe(
      DEFAULT_OUTLETINUSE_THRESHOLD_DURATION,
    );
    expect(outletInUseProperties.thresholdDuration.minimum).toBe(
      DEFAULT_OUTLETINUSE_THRESHOLD_DURATION_MIN,
    );
    expect(outletInUseProperties.thresholdDuration.maximum).toBe(
      DEFAULT_OUTLETINUSE_THRESHOLD_DURATION_MAX,
    ); // 1 day in seconds
    expect(outletInUseProperties.thresholdDuration.required).toBe(true);
  });

  it('should have the correct name property', async () => {
    const nameProperty: keyof ConfigSchema = 'name';

    const properties = configSchemaJson.schema.properties;

    // now we get an error if we change the property name in config.schema.json and/or our types
    expect(properties).toHaveProperty(nameProperty);
    expect(properties.name).toHaveProperty('required');
    expect(properties.name.required).toBe(true);
    expect(properties.name.type).toBe('string');
    expect(properties.name.default).toBe('HomeWizard Energy Socket');
  });

  it('should succeed the validation with valid config values', () => {
    const configSchemaValues: ConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [
        {
          name: 'Energy Socket 1',
          ip: '192.168.1.20',
          outletInUse: {
            isActive: true,
            threshold: 5,
            thresholdDuration: 60,
          },
        },
      ],
    };

    const schemaValidation = () => {
      configSchema.parse(configSchemaValues);
    };

    expect(schemaValidation).not.toThrowError();
  });

  it('should error when bridge Name is missing', () => {
    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).toThrowError('A bridge name is required');
  });

  it('should not error when there is no energySockets array', () => {
    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).not.toThrowError();
  });

  it('should not error when there is no energySockets array', () => {
    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).not.toThrowError();
  });

  it('should error when the energySocket is missing a Name', () => {
    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [{ ip: '192.168.1.20' }],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).toThrowError('Name is required for each Energy Socket');
  });

  it('should error when the energySocket is missing an IP', () => {
    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [
        {
          name: 'Energy Socket 1',
        },
      ],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).toThrowError('IP address is required for each Energy Socket');
  });

  it('should error when the energySocket IP is not a valid ipv4 address', () => {
    const mockIp = '192.168.1.';

    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [{ name: 'Energy Socket 1', ip: mockIp }],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).toThrowError(`'${mockIp}' is not a valid IPv4 address`);
  });

  it('should error when the energySocket IP is an empty string', () => {
    const mockIp = '';

    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [{ name: 'Energy Socket 1', ip: mockIp }],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).toThrowError(`'${mockIp}' is not a valid IPv4 address`);
  });

  it('should error when the energySocket IP is not a valid ipv4 address', () => {
    const mockIp = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';

    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [{ name: 'Energy Socket 1', ip: mockIp }],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).toThrowError(`'${mockIp}' is not a valid IPv4 address`);
  });

  it('should error when the energySocket is an empty object', () => {
    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [{}],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).toThrowError();
  });

  it('should error when the energySocket outletInUse is active, but threshold and thresholdDuration are not set', () => {
    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [
        {
          name: 'Energy Socket 1',
          ip: '192.168.1.20',
          outletInUse: {
            isActive: true,
          },
        },
      ],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    try {
      schemaValidation();
    } catch (error) {
      if (error instanceof ZodError) {
        expect(error.errors[0].message).toBe(
          'A threshold is required when outletInUse.isActive is true',
        );
        expect(error.errors[1].message).toBe(
          'A thresholdDuration is required when outletInUse.isActive is true',
        );
      }
    }
  });

  it('should error when the energySocket outletInUse is active, threshold is set but thresholdDuration is not set', () => {
    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [
        {
          name: 'Energy Socket 1',
          ip: '192.168.1.20',
          outletInUse: {
            isActive: true,
            threshold: 5,
          },
        },
      ],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).toThrowError(
      'A thresholdDuration is required when outletInUse.isActive is true',
    );
  });

  it('should error when the energySocket outletInUse is active, thresholdDuration is set but threshold is not set', () => {
    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [
        {
          name: 'Energy Socket 1',
          ip: '192.168.1.20',
          outletInUse: {
            isActive: true,
            thresholdDuration: 60,
          },
        },
      ],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).toThrowError(
      'A threshold is required when outletInUse.isActive is true',
    );
  });

  it('should not error when outLetInUse.isActive is false and the other required fields are set', () => {
    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [
        {
          name: 'Energy Socket 1',
          ip: '192.168.1.20',
          outletInUse: {
            isActive: false,
            threshold: 5,
            thresholdDuration: 60,
          },
        },
      ],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).not.toThrowError();
  });

  it('should not error when outLetInUse.verboseLogging is true', () => {
    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [
        {
          name: 'Energy Socket 1',
          ip: '192.168.1.20',
          outletInUse: {
            isActive: true,
            threshold: 5,
            thresholdDuration: 60,
            verboseLogging: true,
          },
        },
      ],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).not.toThrowError();
  });

  it('should error when outLetInUse.verboseLogging is a string', () => {
    const invalidConfigSchema = {
      platform: PLATFORM_NAME,
      name: 'HomeWizard Energy Socket',
      energySockets: [
        {
          name: 'Energy Socket 1',
          ip: '192.168.1.20',
          outletInUse: {
            isActive: true,
            threshold: 5,
            thresholdDuration: 60,
            verboseLogging: 'true',
          },
        },
      ],
    };

    const schemaValidation = () => {
      configSchema.parse(invalidConfigSchema);
    };

    expect(schemaValidation).toThrowError("'verboseLogging' must be a boolean");
  });
});
