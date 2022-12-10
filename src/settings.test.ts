import configSchemaJson from '../config.schema.json';
import packageJson from '../package.json';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

describe('settings', () => {
  it('PLATFORM_NAME should match pluginAlias in config.schema.json', async () => {
    expect(PLATFORM_NAME).toBe(configSchemaJson.pluginAlias);
  });

  it('PLUGIN_NAME should match name in package.json', async () => {
    expect(PLUGIN_NAME).toBe(packageJson.name);
  });
});
