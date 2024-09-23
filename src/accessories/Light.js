const { Service, Characteristic } = require("../types");
const Accessory = require("./Accessory");

// Error object for handling no response cases
const noResponse = new Error("No Response");
noResponse.toString = () => {
  return noResponse.message;
};

// Main class definition for Light
module.exports = class Light extends Accessory {
  constructor(plugin, homeKitAccessory) {
    super(plugin, homeKitAccessory);

    /** 
     * Set up characteristic handlers
     * Bind the setOn and setBrightness methods to their respective events.
     */
    this.getCharacteristic(Characteristic.On).on("set", this.setOn.bind(this));
    this.getCharacteristic(Characteristic.Brightness).on("set", this.setBrightness.bind(this));
  }

  /** 
   * Update the characteristics of the light accessory 
   * @param {Object} device - The device object containing current attributes.
   */
  async updateCharacteristics(device) {
    this.plugin.log.info(`[Light] Updating characteristics for ${this.mac} (${this.display_name})`);

    if (device.attributes.isOnline === 0) {
      // Device is offline; log and set no response
      this.plugin.log.warn(`[Light] Device is offline for ${this.mac} (${this.display_name}), setting no response.`);
      this.getCharacteristic(Characteristic.On).updateValue(noResponse);
    } else {
      // Device is online; update power and brightness
      this.plugin.log.info(`[Light] Device is online. Updating power and brightness for ${this.mac} (${this.display_name})`);
      this.getCharacteristic(Characteristic.On).updateValue(device.attributes.onoff);
      this.getCharacteristic(Characteristic.Brightness).updateValue(this.plugin.client.calculateBrightnessPercentage(device.attributes.brightness));
    }
  }

  /** 
   * Update brightness value 
   * @param {number} value - The new brightness value to be set.
   */
  updateBrightness(value) {
    this.plugin.log.info(`[Light] Updating brightness for ${this.mac} (${this.display_name}) to ${value}`);
    this.getCharacteristic(Characteristic.Brightness).updateValue(this.plugin.client.calculateBrightnessPercentage(value));
  }

  /** 
   * Retrieve the light service 
   * @returns {Service} - The HomeKit Lightbulb service.
   */
  getService() {
    this.plugin.log.debug(`[Light] Getting service for ${this.mac} (${this.display_name})`);
    
    let service = this.homeKitAccessory.getService(Service.Lightbulb);

    if (!service) {
      // If the service doesn't exist, add it
      this.plugin.log.info(`[Light] Service not found. Adding new service for ${this.mac} (${this.display_name})`);
      service = this.homeKitAccessory.addService(Service.Lightbulb);
    } else {
      // If the service already exists, log that information
      this.plugin.log.debug(`[Light] Service already exists for ${this.mac} (${this.display_name})`);
    }

    return service;
  }

  /** 
   * Retrieve a specific characteristic 
   * @param {Characteristic} characteristic - The characteristic to retrieve.
   * @returns {Characteristic} - The requested characteristic.
   */
  getCharacteristic(characteristic) {
    this.plugin.log.debug(`[Light] Getting characteristic ${characteristic.UUID} for ${this.mac} (${this.display_name})`);
    return this.getService().getCharacteristic(characteristic);
  }

  /** 
   * Set the power status of the light 
   * @param {boolean} value - The desired power state (on/off).
   * @param {Function} callback - Callback function to execute after setting the power.
   */
  async setOn(value, callback) {
    this.plugin.log.info(`[Light] Setting power status for ${this.mac} (${this.display_name}) to ${value ? "on" : "off"}`);
    
    try {
      await this.plugin.client.setPower(this.mac, value ? "1" : "0");
      this.plugin.log.info(`[Light] Power status updated for ${this.mac} (${this.display_name})`);
      callback();
    } catch (e) {
      this.plugin.log.error(`[Light] Error setting power status for ${this.mac} (${this.display_name}): ${e.message}`);
      callback(e);
    }
  }
  
  /** 
   * Set the brightness level of the light 
   * @param {number} value - The desired brightness level.
   * @param {Function} callback - Callback function to execute after setting the brightness.
   */
  async setBrightness(value, callback) {
    this.plugin.log.info(`[Light] Setting brightness for ${this.mac} (${this.display_name}) to ${value}`);
    
    try {
      await this.plugin.client.setBrightness(this.mac, value);
      this.plugin.log.info(`[Light] Brightness updated for ${this.mac} (${this.display_name}): (${value}%)`);
      callback();
    } catch (e) {
      this.plugin.log.error(`[Light] Error setting brightness for ${this.mac} (${this.display_name}): ${e.message}`);
      callback(e);
    }
  }
};
