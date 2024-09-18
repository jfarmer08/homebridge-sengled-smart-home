const { Service, Characteristic } = require("../types");
const Accessory = require("./Accessory");

const HOMEKIT_COLOR_TEMP_MIN = 500;
const HOMEKIT_COLOR_TEMP_MAX = 140;

const noResponse = new Error("No Response");
noResponse.toString = () => {
  return noResponse.message;
};

module.exports = class Light extends Accessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getCharacteristic(Characteristic.On).on("set", this.setOn.bind(this));
    this.getCharacteristic(Characteristic.Brightness).on("set", this.setBrightness.bind(this));
  }

  async updateCharacteristics(device) {
    if (device.attributes.isOnline === 0) {
      this.getCharacteristic(Characteristic.On).updateValue(noResponse);
    } else {
      this.getCharacteristic(Characteristic.On).updateValue(device.attributes.onoff);
      this.getCharacteristic(Characteristic.Brightness).updateValue(this.plugin.client.calculateBrightnessPercentage(device.attributes.brightness));
    }
  }

  updateBrightness(value) {
    this.getCharacteristic(Characteristic.Brightness).updateValue(this.plugin.client.calculateBrightnessPercentage(value));
  }

  getService() {
    let service = this.homeKitAccessory.getService(Service.Lightbulb);

    if (!service) {
      service = this.homeKitAccessory.addService(Service.Lightbulb);
    }

    return service;
  }

  getCharacteristic(characteristic) {
    return this.getService().getCharacteristic(characteristic);
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async setOn(value, callback) {
    try {
      await this.plugin.client.setPower(this.mac,this.display_name,value ? "1" : "0");
      callback();
    } catch (e) {
      callback(e);
    }
  }

  async setBrightness(value, callback) {
    try {
      await this.plugin.client.setBrightness(
        this.mac,
        this.display_name,
        value
      );
      callback();
    } catch (e) {
      callback(e);
    }
  }
};