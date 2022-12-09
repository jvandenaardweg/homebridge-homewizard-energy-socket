<p align="center">
<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">
</p>
<p align="center">
<a href="https://badge.fury.io/js/homebridge-homewizard-energy-socket"><img src="https://badge.fury.io/js/homebridge-homewizard-energy-socket.svg" alt="npm version" /></a>
<a href="https://github.com/jvandenaardweg/homebridge-homewizard-energy-socket/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="mit license" /></a>
</p>

# Homebridge plugin for HomeWizard Energy Socket

This Homebridge plugin exposes your [HomeWizard Energy Sockets](https://www.homewizard.com/shop/wi-fi-energy-socket/) to Apple HomeKit. So you can use the Home App to switch your Energy Sockets on or off and integrate the Energy Sockets into your Home Automations.

## Features

- Control Energy Sockets from within the Home App
- Use Energy Sockets in your Home Automations
- Automatically discovers Energy Sockets in your network

This plugin does not provide a way to show the current power consumption of the Energy Sockets. This is a limitation of HomeKit and not of this plugin.

## Getting started

For Homebridge to communicate with your Energy Sockets, it is required to enable the "Local API" setting and disable the "Switch lock" setting from within the HomeWizard [Energy App](https://apps.apple.com/app/homewizard-energy/id1492427207) for each Energy Socket you want to expose to Apple HomeKit. It is also advised to assign fixed/static IP addresses to each Energy Socket in your network to improve reliability.

### 1. Enabling the Local API setting and disable the Switch lock setting

1. Open your HomeWizard Energy app
2. Go to settings and choose "Meters"
3. Tap on each Energy Socket you want to use and follow step 4 and 5
4. Enable the "Local API" setting
5. Disable the "Switch lock" setting

More on this on the HomeWizard support page: [Integrating Energy with other systems (API)](https://helpdesk.homewizard.com/en/articles/5935977-integrating-energy-with-other-systems-api)

### 2. Installation of the plugin bridge

This package is published on NPM, so available on the Homebridge plugin page

1. Go to your Homebridge UI and click on "Plugins"
2. Search for `HomeWizard Energy` and select the plugin `Homebridge HomeWizard Energy Socket` from `@jvandenaardweg` and click "Install"
3. On the plugin Settings, set the name you want to use for this plugin, or leave it empty to use the default. Click Save.
4. Click the little QR code icon for the plugin and enable the bridge. Save it and restart Homebridge.
5. After restarting Homebridge, click the QR code icon again and scan the QR code with your iPhone using the Home App. This will add the plugin bridge to your Home App.

After enabling the plugin, the plugin will automatically discover the Energy Sockets in your network that have the "Local API" setting enabled using Multicast DNS. More on this in the [HomeWizard API documentation about Discovery](https://homewizard-energy-api.readthedocs.io/discovery.html).

Is your Energy Socket not discovered? Try a restart of the Homebridge plugin and/or server and verify if the Energy Socket is still available/online in the Energy App.

### 3. Adding Energy Sockets to your Home

Each Energy socket is published as an "external accessory" within Homebridge. This means you need to add each Energy Socket to your Home manually and they are not automatically added into your Home when you add this plugin as a new bridge. External accessories allow you to choose only the Energy Sockets you want to use within the Home App and gives you the ability to remove Energy Sockets without having to delete the entire plugin's bridge from the Home App.

1. Open the Home App, select "Add accessory" and select "More options". You should now see all the Energy Sockets that are found in your network that have the "Local API" option enabled.
2. Select each Energy Socket and follow the instructions to add it to your Home. Use the "Setup code" (example: `123-45-678`) provided by Homebridge on the Homebridge dashboard to add the Energy Socket to your Home. It's the same Setup code you used to add Homebridge to your Home.
3. Done! You can now use the Energy Sockets within your Home App.

Make sure to read this Wiki article about [Identifying the Energy Socket in the Home App](https://github.com/jvandenaardweg/homebridge-homewizard-energy-socket/wiki/Identifying-the-Energy-Socket-in-the-Home-App)

## Removing Energy Sockets from your Home

1. Open the Home App and select the Energy Socket you want to remove
2. Tap on the settings icon and select "Remove Accessory"
3. Done! The Energy Socket is now removed from your Home.

Additionally, disable the "Local API" setting for the Energy Socket in the Energy App. This will prevent the Energy Socket from being discovered by the plugin again.
