<p align="center">
<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">
</p>
<p align="center">
<a href="https://badge.fury.io/js/homebridge-homewizard-energy-socket"><img src="https://badge.fury.io/js/homebridge-homewizard-energy-socket.svg" alt="npm version" /></a>
<a href="https://github.com/jvandenaardweg/homebridge-homewizard-energy-socket/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="mit license" /></a>
</p>

# Homebridge plugin for HomeWizard Energy Socket

This Homebridge plugin exposes your [HomeWizard Energy Sockets](https://www.homewizard.com/shop/wi-fi-energy-socket/) to Apple HomeKit. So you can use the Home App to switch your Energy Sockets on or off and integrate the Energy Sockets into your Home Automations.

## Getting started

For Homebridge to communicate with your Energy Sockets, it is required to enable the "Local API" setting and disable the "Switch lock" setting from within the HomeWizard [Energy App](https://apps.apple.com/app/homewizard-energy/id1492427207) for each Energy Socket you want to expose to Apple HomeKit. It is also adviced to assign fixed/static IP addresses to each Energy Socket in your network to improve reliability.

### Enabling the Local API setting and disable the Switch lock setting (required)

1. Open your HomeWizard Energy app
2. Go to settings and choose "Meters"
3. Tap on each Energy Socket you want to use and follow step 4 and 5
4. Enable the "Local API" setting
5. Disable the "Switch lock" setting

More on this on the HomeWizard support page: [Integrating Energy with other systems (API)](https://helpdesk.homewizard.com/en/articles/5935977-integrating-energy-with-other-systems-api)

After installing this plugin, the plugin will automatically discover the Energy Sockets in your network that have "Local API" enabled.

### Set fixed IP addresses
To add to the reliability of your HomeKit accessories, it is adviced to assign static/fixed IP addresses to devices you use within Apple's Home App. Not doing this might result in your Energy Socket not responding when controlling within the Home App.

1. Open your local router or network settings
2. Find the IP addresses of each Energy Socket you want to use
3. Make sure they use a fixed IP address

## Installation in Homebridge

This package is published on NPM, so available on the Homebridge plugin page

1. Go to your Homebridge UI and click on "Plugins"
2. Search for `HomeWizard Energy` and select the plugin `Homebridge HomeWizard Energy Socket` from `@jvandenaardweg` and click "Install"
3. No additional configuration is required. But make sure to follow the instructions provided by Homebridge after you enabled the plugin.

After enabling the plugin, the plugin will automatically discover the Energy Sockets in your network. Is your Energy Socket not discovered? Make sure you enabled the "Local API" setting in the HomeWizard "Energy" app and then restart the Homebridge plugin and/or server.

Make sure to read this Wiki article about [Identifying the Energy Socket in the Home App](https://github.com/jvandenaardweg/homebridge-homewizard-energy-socket/wiki/Identifying-the-Energy-Socket-in-the-Home-App)
