import { mockFirmwareVersion } from '@/api/mocks/api';
import { HomeWizardEnergyPlatformAccessoryContext } from '@/api/types';
import { HomebridgeHomeWizardEnergySocket } from '@/platform';
import { Accessory } from 'hap-nodejs';
import { PlatformAccessory } from 'homebridge';
import { mockAccessoryContext, mockDisplayName, mockUUID } from './energy-socket-accessory';
import { loggerMock } from './logger';

// export const mockSetCharacteristics = vi.fn((category, value) => {
export const mockSetCharacteristics = vi.fn(() => {
  //   console.log('set', category, value);

  return {
    updateValue: vi.fn().mockReturnThis(),
    onSet: vi.fn().mockReturnThis(),
    onGet: vi.fn().mockReturnThis(),
    setCharacteristic: mockSetCharacteristics,
    getCharacteristics: mockGetCharacteristics,
  };
});

const mockGetCharacteristics = category => {
  //   console.log('get', category);
  if (category === 'FirmwareRevision') {
    return {
      value: mockFirmwareVersion,
    };
  }

  return {
    updateValue: vi.fn().mockReturnThis(),
    onSet: vi.fn().mockReturnThis(),
    onGet: vi.fn().mockReturnThis(),
    getCharacteristics: mockGetCharacteristics,
    setCharacteristics: mockSetCharacteristics,
  };
};

export const getServiceMock = () => {
  // const getServiceMock = category => {
  // console.log('get service', category);
  return {
    setCharacteristic: mockSetCharacteristics,
    getCharacteristic: mockGetCharacteristics,
    updateCharacteristic: vi.fn(),
  };
};

export const addServiceMock = () => {
  // const addServiceMock = category => {
  // console.log('add service', category);
  return {
    setCharacteristic: mockSetCharacteristics,
    getCharacteristic: mockGetCharacteristics,
    updateCharacteristic: vi.fn(),
  };
};

export const platformMock = {
  log: loggerMock,
  api: {
    hap: {
      Service: {
        AccessoryInformation: 'AccessoryInformation',
      },
      Characteristic: {
        Manufacturer: 'Manufacturer',
        FirmwareRevision: 'FirmwareRevision',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
      },
      HapStatusError: vi.fn(),
      HAPStatus: {
        SUCCESS: 'SUCCESS',
        SERVICE_COMMUNICATION_FAILURE: 'SERVICE_COMMUNICATION_FAILURE',
      },
    },
  },
  Service: {
    AccessoryInformation: 'AccessoryInformation',
    Outlet: 'Outlet',
  },
  Characteristic: {
    Manufacturer: 'Manufacturer',
    FirmwareRevision: 'FirmwareRevision',
    Model: 'Model',
    SerialNumber: 'SerialNumber',
    On: 'On',
    Name: 'Name',
    OutletInUse: 'OutletInUse',
  },
} as unknown as HomebridgeHomeWizardEnergySocket;

export const mockServices = {
  getService: getServiceMock,
  addService: addServiceMock,
};

export const accessoryMock = {
  context: {
    energySocket: mockAccessoryContext,
  },
  getService: getServiceMock,
  addService: addServiceMock,
  // addService: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
  removeService: vi.fn(),
  displayName: mockDisplayName,
  UUID: mockUUID,
  _associatedHAPAccessory: {} as Accessory,
  category: '' as any,
  reachable: true,
  services: [],
  getServiceById: vi.fn(),
  getServiceByUUIDAndSubType: vi.fn(),
  updateReachability: vi.fn(),
  configureCameraSource: vi.fn(),
  configureController: vi.fn(),
  removeController: vi.fn(),
  addListener: vi.fn(),
  once: vi.fn(),
  removeListener: vi.fn(),
  off: vi.fn(),
  removeAllListeners: vi.fn(),
  setMaxListeners: vi.fn(),
  getMaxListeners: vi.fn(),
  listeners: vi.fn(),
  rawListeners: vi.fn(),
  listenerCount: vi.fn(),
  prependListener: vi.fn(),
  prependOnceListener: vi.fn(),
  eventNames: vi.fn(),
} as unknown as PlatformAccessory<HomeWizardEnergyPlatformAccessoryContext>;
