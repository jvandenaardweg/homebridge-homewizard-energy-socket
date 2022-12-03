
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# Homebridge plugin for HomeWizard Energy
This Homebridge plugin exposes your HomeWizard Energy Sockets to Apple HomeKit. So you can use the Home App to manually switch - or automate - your Energy Sockets.

## Getting started
For Homebridge to communicate with your Energy Sockets, they need to have a fixed IP address on your network. You also need to enable the "Local API" setting from within the HomeWizard "Energy" app for each Energy Socket. 

### Set fixed IP addresses
First, verify if all
Emergy Sockets have a fixed IP address in your network. If not, adjust your router settings to give each Energy Socket a fixed IP address. If you don't know how to do this, or you can't set fixed IP addresses, then this plugin will not work properly.

### Get the IP address for each Energy Socket
1. Open your local router or network settings
2. Find the IP addresses of each Energy Socket you want to use
3. Make sure they use a fixed IP address
3. Save them somewhere, and include a name for each Energy Socket. You'll need both when you setup this plugin in Homebridge

### Enabling the Local API setting
1. Open your HomeWizard "Energy" app
2. Go to settings and choose "Meters"
3. Tap on each Energy Socket you want to use and enable the "Local API" setting

work in progress...