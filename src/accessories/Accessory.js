const { Service, Characteristic } = require("../types");

// Responses from the Sengled API can lag a little after a new value is set
const UPDATE_THROTTLE_MS = 1000;

module.exports = class Accessory {
  constructor(plugin, homeKitAccessory) {
    this.updating = false;
    this.lastTimestamp = null;

    this.plugin = plugin;
    this.homeKitAccessory = homeKitAccessory;
  }

  // Default Prop
  get display_name() {
    return this.homeKitAccessory.displayName;
  }
  get mac() {
    return this.homeKitAccessory.context.mac;
  }
  get product_type() {
    return this.homeKitAccessory.context.product_type;
  }
  get product_model() {
    return this.homeKitAccessory.context.product_model;
  }

  /** Determines whether this accessory matches the given Sengled device */
  matches(device) {
    return this.mac === device.deviceUuid;
  }

  async update(device, timestamp) {
    const productType = device.attributes.typeCode;

    switch (productType) {
      default:
        this.homeKitAccessory.context = {
            mac: device.deviceUuid,
            product_type: device.attributes.typeCode,
            product_model: device.attributes.productCode,
            nickname: device.attributes.name
        };
        break;
    }

    this.homeKitAccessory
      .getService(Service.AccessoryInformation)
      .updateCharacteristic(Characteristic.Name, device.attributes.name)
      .updateCharacteristic(Characteristic.Manufacturer, "Sengled")
      .updateCharacteristic(Characteristic.Model, device.attributes.productCode)
      .updateCharacteristic(Characteristic.SerialNumber, device.deviceUuid)

    if (this.shouldUpdateCharacteristics(timestamp)) {
      this.updateCharacteristics(device);
    }
  }
  shouldUpdateCharacteristics(timestamp) {
    if (this.updating) {
      return false;
    }

    if (
      this.lastTimestamp &&
      timestamp <= this.lastTimestamp + UPDATE_THROTTLE_MS
    ) {
      return false;
    }

    return true;
  }

  updateCharacteristics(device) {
    //
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms * 1000));
  }
};