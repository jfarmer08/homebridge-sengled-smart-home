const { Service, Characteristic } = require("../types");
const Accessory = require("./Accessory");

const WYZE_COLOR_TEMP_MIN = 2700;
const WYZE_COLOR_TEMP_MAX = 6500;
const HOMEKIT_COLOR_TEMP_MIN = 500;
const HOMEKIT_COLOR_TEMP_MAX = 140;

const noResponse = new Error("No Response");
noResponse.toString = () => {
  return noResponse.message;
};

module.exports = class LightMesh extends Accessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    this.getCharacteristic(Characteristic.On).on("set", this.setOn.bind(this));
    this.getCharacteristic(Characteristic.Brightness).on("set", this.setBrightness.bind(this));
    this.getCharacteristic(Characteristic.ColorTemperature).on("set", this.setColorTemperature.bind(this));
    this.getCharacteristic(Characteristic.Hue).on("set", this.setHue.bind(this));
    this.getCharacteristic(Characteristic.Saturation).on("set", this.setSaturation.bind(this));

    // Local caching of HSV color space handling separate Hue & Saturation on HomeKit
    // Caching idea for handling HSV colors from:
    //    https://github.com/QuickSander/homebridge-http-rgb-push/blob/master/index.js
    this.cache = {};
    this.cacheUpdated = false;
  }

  async updateCharacteristics(device) {
    if (device.attributes.isOnline == 0) {
      this.getCharacteristic(Characteristic.On).updateValue(noResponse);
    } else {
      this.getCharacteristic(Characteristic.On).updateValue(device.attributes.onoff);

      this.plugin.client.subscribeMqtt(`wifielement/${device.deviceUuid}/status`, this.updateStatus.bind(this));
    }
  }

  updateStatus(message) {
    let data;

    try {
      data = JSON.parse(message);
      this.plugin.log.debug(`Update Status from MQTT ${JSON.stringify(data)}`);
    } catch (error) {
      this.plugin.log.error('Failed to parse MQTT message:', error);
      return;
    }

    for (const status of data) {
      if (!status.type || !status.dn) {
        continue;
      }

      if (status.dn === this.device_mac) {
        if (status.type === "color") {
          this.color = status.value;
        }
        if (status.type === "colorMode") {
          this.color_mode = status.value;
        }
        if (status.type === "brightness") {
          this.brightness = status.value;
          this.updateBrightness(this.brightness)
        }
        if (status.type === "colorTemperature") {
          this.color_temperature = status.value;
          this.updateColorTemp(this.color_temperature)
        }
      }
    }
  }


  updateBrightness(value) {
    this.plugin.log(`[MeshLight] Updating brightness record for "${this.display_name} (${this.mac}) to ${value}: ${JSON.stringify(value)}"`);
    this.getCharacteristic(Characteristic.Brightness).updateValue(this.plugin.client.calculateBrightnessPercentage(value));
  }

  updateColorTemp(value) {
    this.plugin.log(`[MeshLight] Updating color Temp record for "${this.display_name} (${this.mac}) to ${value}: ${JSON.stringify(value)}"`);
    this.getCharacteristic(Characteristic.ColorTemperature).updateValue(value);
  }

  updateColor(value) {
    // Convert a Hex color from Sengled into the HSL values recognized by HomeKit.
    const hslValue = colorsys.hex2Hsv(value);
    this.plugin.log(`[MeshLight] Updating color record for "${this.display_name} (${this.mac}) to ${value}: ${JSON.stringify(hslValue)}"`);

    // Update Hue
    this.updateHue(hslValue.h);
    this.cache.hue = hslValue.h;

    // Update Saturation
    this.updateSaturation(hslValue.s);
    this.cache.saturation = hslValue.s;
  }

  updateHue(value) {
    this.getCharacteristic(Characteristic.Hue).updateValue(value);
  }

  updateSaturation(value) {
    this.getCharacteristic(Characteristic.Saturation).updateValue(value);
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

  async setOn(value, callback) {
    this.plugin.log(`[MeshLight] Setting power for "${this.display_name} (${this.mac})" to ${value}"`);
    try {
      await this.plugin.client.setPower(
        this.mac,
        value ? "1" : "0",
        true
      );
      callback();
    } catch (e) {
      callback(e);
    }
  }

  async setBrightness(value, callback) {
    this.plugin.log(`[MeshLight] Setting brightness for "${this.display_name} (${this.mac}) to ${value}"`);
    try {
      await this.plugin.client.setBrightness(
        this.mac,
        value,
        true
      );
      callback();
    } catch (e) {
      callback(e);
    }
  }

  async setColorTemperature(value, callback) {
    if (value != null) {
      let floatValue = this.plugin.client.rangeToFloat(
        value,
        HOMEKIT_COLOR_TEMP_MIN,
        HOMEKIT_COLOR_TEMP_MAX
      );
      let wyzeValue = this.plugin.client.floatToRange(
        floatValue,
        WYZE_COLOR_TEMP_MIN,
        WYZE_COLOR_TEMP_MAX
      );
      this.plugin.log(`[MeshLight] Setting color temperature for "${this.display_name} (${this.mac}) to ${value} : ${wyzeValue}"`);
      try {
        await this.plugin.client.setColorTemperature(
          this.mac,
          wyzeValue
        );
        callback();
      } catch (e) {
        callback(e);
      }
    }
  }

  async setHue(value, callback) {
    if (value != null) {
      this.plugin.log(`[MeshLight] Setting hue (color) for "${this.display_name} (${this.mac}) to ${value} : (H)S Values: ${value}, ${this.cache.saturation}"`);

      try {
        this.cache.hue = value;
        if (this.cacheUpdated) {
          let hexValue = colorsys.hsv2Hex(
            this.cache.hue,
            this.cache.saturation,
            100
          );
          hexValue = hexValue.replace("#", "");
          this.plugin.log(hexValue);
          await this.plugin.client.setMeshHue(
            this.mac,
            this.product_model,
            hexValue
          );
          this.cacheUpdated = false;
        } else {
          this.cacheUpdated = true;
        }
        callback();
      } catch (e) {
        callback(e);
      }
    }
  }

  async setSaturation(value, callback) {
    if (value != null) {
      this.plugin.log(`[MeshLight] Setting saturation (color) for "${this.display_name} (${this.mac}) to ${value}"`);
      this.plugin.log(`[MeshLight] H(S) Values: ${this.cache.saturation}, ${value}`);

      try {
        this.cache.saturation = value;
        if (this.cacheUpdated) {
          let hexValue = colorsys.hsv2Hex(
            this.cache.hue,
            this.cache.saturation,
            100
          );
          hexValue = hexValue.replace("#", "");
          await this.plugin.client.setMeshSaturation(
            this.mac,
            this.product_model,
            hexValue
          );
          this.cacheUpdated = false;
        } else {
          this.cacheUpdated = true;
        }
        callback();
      } catch (e) {
        callback(e);
      }
    }
  }
};