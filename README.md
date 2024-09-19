# This plugin adds support for Sengled Smart Home devices to [Homebridge](https://github.com/homebridge/homebridge).
[![npm](https://img.shields.io/npm/dt/homebridge-sengled-smart-home)](https://www.npmjs.com/package/homebridge-sengled-smart-home)
[![npm](https://img.shields.io/npm/v/homebridge-sengled-smart-home.svg?style=flat-square)](https://www.npmjs.com/package/homebridge-sengled-smart-home)

# Funding   [![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square&maxAge=2592000)](https://www.paypal.com/paypalme/AllenFarmer) [![Donate](https://img.shields.io/badge/Donate-Venmo-blue.svg?style=flat-square&maxAge=2592000)](https://venmo.com/u/Allen-Farmer) [![Donate](https://img.shields.io/badge/Donate-Cash_App-blue.svg?style=flat-square&maxAge=2592000)](https://cash.app/$Jfamer08)
If you like what I have done here and want to help I would recommend that you firstly look into supporting Homebridge. None of this could happen without them.

After you have done that if you feel like my work has been valuable to you I welcome your support through Paypal, Venmo or Cash App.

[![homebridge-sengled-smart-home: Sengled Connected Home plugin for Homebridge](https://github.com/jfarmer08/homebridge-sengled-smart-home/blob/main/logo.png?raw=true)](https://github.com/jfarmer08/homebridge-sengled-smart-home)

This plugin adds support for Sengled Smart Home devices to [Homebridge](https://github.com/homebridge/homebridge).

This plugin uses the existing Sengled Element Home app infrastructure to allow you to control your Sengled accessories that uses zigbee. It'll let you turn on/off the lights and control brightness and color temperature using the Home app.

Provide your username and password and register as a platform, and it will auto-detect the light bulb you have registered.

Note that I only have **Element Classic A19 Kit (Light bulbs + Hub)** to test  
https://us.sengled.com/products/element-classic-kit  

This plugin is still in beta.  
If you encounter anything out of this product. Issue and Pull Request is welcome 🙂.

# Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-sengled-smart-home`
3. Update your configuration file. See below for a sample.

# Configuration

![](config.png)

Configuration sample:

```
"platforms": [
  {
    "platform": "Sengled",
    "name": "SengledSmartHome",
    "username": "***",
    "password": "***"
  }
]
```
