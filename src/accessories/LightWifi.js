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
    this.cache = {};
    this.cacheUpdated = false;

    this.plugin.log.info(`[LightMesh] Initialized for "${this.display_name} (${this.mac})"`);
  }

  async updateCharacteristics(device) {
    this.plugin.log.debug(`[LightMesh] Updating characteristics for device: ${JSON.stringify(device)}`);

    if (device.attributes.isOnline == 0) {
      this.plugin.log.warn(`[LightMesh] Device "${this.display_name} (${this.mac})" is offline`);
      this.getCharacteristic(Characteristic.On).updateValue(noResponse);
    } else {
      this.getCharacteristic(Characteristic.On).updateValue(device.attributes.onoff);
      this.plugin.log.info(`[LightMesh] Device "${this.display_name} (${this.mac})" is online, On state: ${device.attributes.onoff}`);

      this.plugin.client.subscribeMqtt(`wifielement/${device.deviceUuid}/status`, this.updateStatus.bind(this));
      this.plugin.log.info(`[LightMesh] Subscribed to MQTT status updates for device ${device.deviceUuid}`);
    }
  }

  updateStatus(message) {
    let data;

    try {
      data = JSON.parse(message);
      this.plugin.log.debug(`Update Status from MQTT: ${JSON.stringify(data)}`);
    } catch (error) {
      this.plugin.log.error('Failed to parse MQTT message:', error);
      return;
    }

    for (const status of data) {
      if (!status.type || !status.dn) {
        this.plugin.log.warn('Received status update with missing type or device ID:', status);
        continue;
      }

      if (status.dn === this.device_mac) {
        this.plugin.log.debug(`[LightMesh] Processing status update for device ${this.device_mac}`);

        if (status.type === "color") {
          this.color = status.value;
          this.plugin.log.info(`[LightMesh] Updated color for "${this.display_name} (${this.mac})" to ${this.color}`);
        }
        if (status.type === "colorMode") {
          this.color_mode = status.value;
          this.plugin.log.info(`[LightMesh] Updated color mode for "${this.display_name} (${this.mac})" to ${this.color_mode}`);
        }
        if (status.type === "brightness") {
          this.brightness = status.value;
          this.updateBrightness(this.brightness);
        }
        if (status.type === "colorTemperature") {
          this.color_temperature = status.value;
          this.updateColorTemp(this.color_temperature);
        }
      }
    }
  }

  updateBrightness(value) {
    this.plugin.log(`[MeshLight] Updating brightness record for "${this.display_name} (${this.mac})" to ${value}: ${JSON.stringify(value)}`);
    this.getCharacteristic(Characteristic.Brightness).updateValue(this.plugin.client.calculateBrightnessPercentage(value));
    this.plugin.log.info(`[MeshLight] Brightness for "${this.display_name} (${this.mac})" updated to ${value}`);
  }

  updateColorTemp(value) {
    this.plugin.log(`[MeshLight] Updating color temperature for "${this.display_name} (${this.mac})" to ${value}: ${JSON.stringify(value)}`);
    this.getCharacteristic(Characteristic.ColorTemperature).updateValue(value);
    this.plugin.log.info(`[MeshLight] Color temperature for "${this.display_name} (${this.mac})" updated to ${value}`);
  }

  updateColor(value) {
    // Convert a Hex color from Sengled into the HSL values recognized by HomeKit.
    const hslValue = colorsys.hex2Hsv(value);
    this.plugin.log(`[MeshLight] Updating color record for "${this.display_name} (${this.mac})" to ${value}: ${JSON.stringify(hslValue)}`);

    // Update Hue
    this.updateHue(hslValue.h);
    this.cache.hue = hslValue.h;

    // Update Saturation
    this.updateSaturation(hslValue.s);
    this.cache.saturation = hslValue.s;
  }

  updateHue(value) {
    this.plugin.log(`[MeshLight] Updating hue for "${this.display_name} (${this.mac})" to ${value}`);
    this.getCharacteristic(Characteristic.Hue).updateValue(value);
  }

  updateSaturation(value) {
    this.plugin.log(`[MeshLight] Updating saturation for "${this.display_name} (${this.mac})" to ${value}`);
    this.getCharacteristic(Characteristic.Saturation).updateValue(value);
  }

  getService() {
    let service = this.homeKitAccessory.getService(Service.Lightbulb);

    if (!service) {
      service = this.homeKitAccessory.addService(Service.Lightbulb);
      this.plugin.log.info(`[LightMesh] Added new Lightbulb service for "${this.display_name} (${this.mac})"`);
    }

    return service;
  }

  getCharacteristic(characteristic) {
    return this.getService().getCharacteristic(characteristic);
  }

  async setOn(value, callback) {
    this.plugin.log(`[MeshLight] Setting power for "${this.display_name} (${this.mac})" to ${value}`);
    try {
      await this.plugin.client.setPower(this.mac, value ? "1" : "0", true);
      this.plugin.log.info(`[MeshLight] Power set successfully for "${this.display_name} (${this.mac})"`);
      callback();
    } catch (e) {
      this.plugin.log.error(`[MeshLight] Failed to set power for "${this.display_name} (${this.mac})": ${e.message}`);
      callback(e);
    }
  }

  async setBrightness(value, callback) {
    this.plugin.log(`[MeshLight] Setting brightness for "${this.display_name} (${this.mac})" to ${value}`);
    try {
      await this.plugin.client.setBrightness(this.mac, value, true);
      this.plugin.log.info(`[MeshLight] Brightness set successfully for "${this.display_name} (${this.mac})"`);
      callback();
    } catch (e) {
      this.plugin.log.error(`[MeshLight] Failed to set brightness for "${this.display_name} (${this.mac})": ${e.message}`);
      callback(e);
    }
  }

  async setColorTemperature(value, callback) {
    if (value != null) {
      let floatValue = this.plugin.client.rangeToFloat(value, HOMEKIT_COLOR_TEMP_MIN, HOMEKIT_COLOR_TEMP_MAX);
      let wyzeValue = this.plugin.client.floatToRange(floatValue, WYZE_COLOR_TEMP_MIN, WYZE_COLOR_TEMP_MAX);
      this.plugin.log(`[MeshLight] Setting color temperature for "${this.display_name} (${this.mac})" to ${value} (Wyze value: ${wyzeValue})`);
      
      try {
        await this.plugin.client.setColorTemperature(this.mac, wyzeValue);
        this.plugin.log.info(`[MeshLight] Color temperature set successfully for "${this.display_name} (${this.mac})"`);
        callback();
      } catch (e) {
        this.plugin.log.error(`[MeshLight] Failed to set color temperature for "${this.display_name} (${this.mac})": ${e.message}`);
        callback(e);
      }
    } else {
      this.plugin.log.warn(`[MeshLight] Received null value for color temperature for "${this.display_name} (${this.mac})"`);
      callback(new Error("Color temperature value cannot be null"));
    }
  }

  async setHue(value, callback) {
    if (value != null) {
      this.plugin.log(`[MeshLight] Setting hue for "${this.display_name} (${this.mac})" to ${value} (Current saturation: ${this.cache.saturation})`);

      try {
        this.cache.hue = value;
        if (this.cacheUpdated) {
          let hexValue = colorsys.hsv2Hex(this.cache.hue, this.cache.saturation, 100);
          hexValue = hexValue.replace("#", "");
          this.plugin.log(`[MeshLight] Setting mesh hue for "${this.display_name} (${this.mac})" with hex value: ${hexValue}`);
          await this.plugin.client.setMeshHue(this.mac, this.product_model, hexValue);
          this.cacheUpdated = false;
          this.plugin.log.info(`[MeshLight] Hue set successfully for "${this.display_name} (${this.mac})"`);
        } else {
          this.cacheUpdated = true;
          this.plugin.log.info(`[MeshLight] Cached hue updated for "${this.display_name} (${this.mac})", awaiting saturation update`);
        }
        callback();
      } catch (e) {
        this.plugin.log.error(`[MeshLight] Failed to set hue for "${this.display_name} (${this.mac})": ${e.message}`);
        callback(e);
      }
    } else {
      this.plugin.log.warn(`[MeshLight] Received null value for hue for "${this.display_name} (${this.mac})"`);
      callback(new Error("Hue value cannot be null"));
    }
  }

  async setSaturation(value, callback) {
    if (value != null) {
      this.plugin.log(`[MeshLight] Setting saturation for "${this.display_name} (${this.mac})" to ${value} (Current hue: ${this.cache.hue})`);
      try {
        this.cache.saturation = value;
        if (this.cacheUpdated) {
          let hexValue = colorsys.hsv2Hex(this.cache.hue, this.cache.saturation, 100);
          hexValue = hexValue.replace("#", "");
          this.plugin.log(`[MeshLight] Setting mesh saturation for "${this.display_name} (${this.mac})" with hex value: ${hexValue}`);
          await this.plugin.client.setMeshSaturation(this.mac, this.product_model, hexValue);
          this.cacheUpdated = false;
          this.plugin.log.info(`[MeshLight] Saturation set successfully for "${this.display_name} (${this.mac})"`);
        } else {
          this.cacheUpdated = true;
          this.plugin.log.info(`[MeshLight] Cached saturation updated for "${this.display_name} (${this.mac})", awaiting hue update`);
        }
        callback();
      } catch (e) {
        this.plugin.log.error(`[MeshLight] Failed to set saturation for "${this.display_name} (${this.mac})": ${e.message}`);
        callback(e);
      }
    } else {
      this.plugin.log.warn(`[MeshLight] Received null value for saturation for "${this.display_name} (${this.mac})"`);
      callback(new Error("Saturation value cannot be null"));
    }
  }
};
