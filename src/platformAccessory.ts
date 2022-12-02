import { Service, PlatformAccessory, CharacteristicValue } from "homebridge";
import fetch from "node-fetch";

import { EnergySocket, HomebridgeHomeWizardEnergy } from "./platform";

interface HomeWizardEnergySocketState {
  power_on: boolean;
  switch_lock: boolean;
  brightness: number;
}

interface HomeWizardApiResponse {
  /** The product type, see Supported devices. Make sure your application can handle other values for future products. */
  product_type: string;
  /** A fixed, user-friendly name. This name is not the same that is set by the user in the app. */
  product_name: string;
  /** Serial, also the MAC address. Consists of 12 hexadecimal values. */
  serial: string;
  /** The current firmware version. Make sure your application can handle other version formats. See Versioning and updates */
  firmware_version: string;
  /** The current api version, currently ‘v1’ */
  api_version: string;
}

export interface HomeWizardEnergyPlatformAccessoryContext {
  socket: EnergySocket;
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HomeWizardEnergyAccessory {
  private service: Service;
  private socket: EnergySocket;
  private socketId: string;
  private baseApiUrl: string;
  private stateApiUrl: string;

  constructor(
    private readonly platform: HomebridgeHomeWizardEnergy,
    private readonly accessory: PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>
  ) {
    const socket = accessory.context.socket;

    this.socket = socket;

    this.socketId = `${socket.name} (${socket.ip}) -> `;

    this.platform.log.debug(
      this.socketId,
      "Initializing platform accessory",
      accessory.UUID,
      accessory.displayName,
      accessory.context.socket
    );

    const baseApiUrl = `http://${socket.ip}/api`;

    this.baseApiUrl = baseApiUrl;
    this.stateApiUrl = `${baseApiUrl}/v1/state`;

    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        "HomeWizard"
      );

    // get the Outlet service if it exists, otherwise create a new Outlet service
    // you can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.Outlet) ||
      this.accessory.addService(this.platform.Service.Outlet);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service
      .setCharacteristic(
        this.platform.Characteristic.Name,
        accessory.context.socket.name
      )
      .setCharacteristic(this.platform.Characteristic.OutletInUse, true);

    this.setAsyncRequiredCharacteristic();

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Outlet

    // register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.handleOnSet.bind(this)) // SET - bind to the `handleOnSet` method below
      .onGet(this.handleOnGet.bind(this)); // GET - bind to the `handleOnGet` method below
  }

  async setAsyncRequiredCharacteristic() {
    try {
      const result = await fetch(this.baseApiUrl);

      const data = (await result.json()) as HomeWizardApiResponse;

      this.platform.log.debug(
        this.socketId,
        "Set required characteristics using API data: ",
        JSON.stringify(data)
      );

      this.accessory
        .getService(this.platform.Service.AccessoryInformation)!
        .setCharacteristic(
          this.platform.Characteristic.Model,
          data.product_name
        ) // Energy Socket
        .setCharacteristic(
          this.platform.Characteristic.SerialNumber,
          data.serial
        ) // Like: "1c23e7280952"
        .setCharacteristic(
          this.platform.Characteristic.FirmwareRevision,
          data.firmware_version
        ); // Like: "3.02"
    } catch (error) {
      this.platform.log.error(this.socketId, "setAsyncCharacteristic", error);

      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      );
    }
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async handleOnSet(value: CharacteristicValue) {
    this.platform.log.debug(
      this.socketId,
      `Setting the ON state to ${value} at ${this.stateApiUrl}`
    );

    try {
      const response = await fetch(this.stateApiUrl, {
        method: "PUT",
        body: JSON.stringify({ power_on: value }),
      });

      if (!response.ok) {
        throw new Error(
          `Api PUT call at ${this.stateApiUrl} failed, with status ${
            response.status
          } and response data ${JSON.stringify(response.data)}`
        );
      }

      // TODO: use better type
      const state =
        (await response.json()) as Partial<HomeWizardEnergySocketState>;

      this.platform.log.debug(
        this.socketId,
        `Set ON state to: ${state.power_on}`
      );

      // this.state.On = value as boolean;
    } catch (err) {
      let errorMessage = "A unknown error occurred while setting the ON state";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      this.platform.log.debug(this.socketId, errorMessage);

      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      );
    }
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async handleOnGet(): Promise<CharacteristicValue> {
    try {
      this.platform.log.debug(
        this.socketId,
        `Getting the ON state at ${this.stateApiUrl}`
      );

      const response = await fetch(this.stateApiUrl);

      if (!response.ok) {
        throw new Error(
          `Api GET call at ${this.stateApiUrl} failed, with status ${
            response.status
          } and response data ${JSON.stringify(response.data)}`
        );
      }

      const state = (await response.json()) as HomeWizardEnergySocketState;

      this.platform.log.debug(this.socketId, `Got ON state: ${state.power_on}`);

      return state.power_on;
    } catch (err) {
      let errorMessage = "A unknown error occurred while getting the ON state";

      if (err instanceof Error) {
        errorMessage = err.message;
      }

      this.platform.log.debug(this.socketId, errorMessage);

      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      );
    }
  }
}
