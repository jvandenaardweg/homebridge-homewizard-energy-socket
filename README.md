<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

# Homebridge plugin for HomeWizard Energy

This Homebridge plugin exposes your [HomeWizard Energy Sockets](https://www.homewizard.com/shop/wi-fi-energy-socket/) to Apple HomeKit. So you can use the Home App to manually switch - or automate - your Energy Sockets.

## Getting started

For Homebridge to communicate with your Energy Sockets, it is preferred they all have a fixed IP address in your network. You also need to enable the "Local API" setting from within the HomeWizard "Energy" app for each Energy Socket.

More on this on the HomeWizard support page: [Integrating Energy with other systems (API)](https://helpdesk.homewizard.com/en/articles/5935977-integrating-energy-with-other-systems-api)

### Set fixed IP addresses

First, verify if all Energy Sockets have a fixed IP address in your network. If not, adjust your router settings to give each Energy Socket a fixed IP address. If you don't know how to do this, or you can't set fixed IP addresses, then there might be issues when an Energy Socket is assigned a different IP address by your router after setting up this plugin.

1. Open your local router or network settings
2. Find the IP addresses of each Energy Socket you want to use
3. Make sure they use a fixed IP address

### Enabling the Local API setting

1. Open your HomeWizard "Energy" app
2. Go to settings and choose "Meters"
3. Tap on each Energy Socket you want to use and enable the "Local API" setting

After installing this plugin, the plugin will automatically discover the Energy Sockets in your network.

## Installation in Homebridge

This package is published on NPM, so available on the Homebridge plugin page

1. Go to your Homebridge UI and click on "Plugins"
2. Find `homebridge-homewizard-energy` and click "Install"
3. Follow the instructions provided by Homebridge.
