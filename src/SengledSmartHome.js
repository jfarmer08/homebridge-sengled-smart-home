const { homebridge, Accessory, UUIDGen } = require('./types')
const { LightModels, LightMeshModels, LightWifiModels } = require('./enums')

//const SengledAPI = require('sengled-api') // Uncomment for Release
const SengledAPI = require('./sengled-api/src') // Comment for Release
const Light = require('./accessories/Light')
const LightMesh = require('./accessories/LightMesh')
const LightWifi = require('./accessories/LightWifi')

const PLUGIN_NAME = 'homebridge-sengled-smart-home'
const PLATFORM_NAME = 'SengledSmartHome'

const DEFAULT_REFRESH_INTERVAL = 60000

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = class SengledSmartHome {
  constructor(log, config, api) {
    this.log = log
    this.config = config
    this.api = api
    this.client = this.getClient()

    this.accessories = []

    this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this))
  }

  static register() {
    homebridge.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, SengledSmartHome)
  }

  getClient() {
    return new SengledAPI({
      // User login parameters
      username: this.config.username,
      password: this.config.password,
      countryCode: this.config.countryCode,
      wifi: this.config.wifi,

      //Storage Path
      persistPath: homebridge.user.persistPath(),

      //URLs
      authBaseUrl: this.config.authBaseUrl,
      apiBaseUrl: this.config.apiBaseUrl,

    }, this.log, this.config.logLevel || 'info')
  }

  didFinishLaunching() {
    this.runLoop()
  }

  async runLoop() {
    const interval = this.config.refreshInterval || DEFAULT_REFRESH_INTERVAL
    // eslint-disable-next-line no-constant-condition

    await this.client.getServerInfo()
    await this.client.initializeMqtt()

    while (true) {
      try {
        await this.refreshDevices()
      } catch (e) { }

      await delay(interval)
    }
  }

  async refreshDevices() {
    this.log.info('Refreshing devices...')

    try {
      const objectList = await this.client.getAllDeviceList()
      const devices = objectList

      this.log.info(`Found ${devices.length} device(s)`)
      await this.loadDevices(devices)
    } catch (e) {
      this.log.error(`Error getting devices: ${e}`)
      throw e
    }
  }

  async loadDevices(devices) {
    const foundAccessories = []

    for (const device of devices) {
      const accessory = await this.loadDevice(device)
      if (accessory) {
        foundAccessories.push(accessory)
      }
    }

    const removedAccessories = this.accessories.filter(a => !foundAccessories.includes(a))
    if (removedAccessories.length > 0) {
      this.log(`Removing ${removedAccessories.length} device(s)`)
      const removedHomeKitAccessories = removedAccessories.map(a => a.homeKitAccessory)
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, removedHomeKitAccessories)
    }

    this.accessories = foundAccessories
  }

  async loadDevice(device) {
    const accessoryClass = this.getAccessoryClass(device.attributes.typeCode)
    if (!accessoryClass) {
      this.log.info(`[${device.attributes.productCode}] Unsupported device type: (Name: ${device.attributes.name}) (MAC: ${device.deviceUuid}) (Model: ${device.attributes.productCode})`)
      return
    }

    let accessory = this.accessories.find(a => a.matches(device))
    if (!accessory) {
      const homeKitAccessory = this.createHomeKitAccessory(device)
      accessory = new accessoryClass(this, homeKitAccessory)
      this.accessories.push(accessory)
    } else {
      this.log.info(`[${device.attributes.productCode}] Loading accessory from cache ${device.attributes.name} (MAC: ${device.deviceUuid})`)
    }
    accessory.update(device)

    return accessory
  }

  getAccessoryClass(typeCode) {
    switch (true) {
      case Object.values(LightModels).includes(typeCode):
        return Light
      case Object.values(LightMeshModels).includes(typeCode):
        return LightMesh
      case Object.values(LightWifiModels).includes(typeCode):
        return LightWifi
    }
  }

  createHomeKitAccessory(device) {
    const uuid = UUIDGen.generate(device.deviceUuid)

    const homeKitAccessory = new Accessory(device.attributes.name, uuid)

    homeKitAccessory.context = {
      mac: device.deviceUuid,
      product_type: device.attributes.typeCode,
      product_model: device.attributes.productCode,
      nickname: device.attributes.name
    }

    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [homeKitAccessory])
    return homeKitAccessory
  }

  // Homebridge calls this method on boot to reinitialize previously-discovered devices
  configureAccessory(homeKitAccessory) {
    // Make sure we haven't set up this accessory already
    let accessory = this.accessories.find(a => a.homeKitAccessory === homeKitAccessory)
    if (accessory) {
      return
    }

    const accessoryClass = this.getAccessoryClass(homeKitAccessory.context.product_type, homeKitAccessory.context.product_model)
    if (accessoryClass) {
      accessory = new accessoryClass(this, homeKitAccessory)
      this.accessories.push(accessory)
    } else {
      try {
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [homeKitAccessory])
      } catch (error) {
        this.log.error(`Error removing accessory ${homeKitAccessory.context.nickname} (MAC: ${homeKitAccessory.context.mac}) : ${error}`)
      }
    }
  }
}