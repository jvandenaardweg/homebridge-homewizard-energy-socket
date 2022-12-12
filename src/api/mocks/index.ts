import { EnergySocketAccessoryProperties } from '../types';
import hap from 'hap-nodejs';

export const mockHostname = 'localhost';
export const mockPort = 80;
export const mockApiUrl = `http://${mockHostname}`;
export const mockApiPath = '/api/v1';
export const mockSerialNumber = '1234567890';
export const mockDisplayName = `Energy Socket ${mockSerialNumber}`;
export const mockFirmwareVersion = '3.1';
export const mockUUID = hap.uuid.generate(mockSerialNumber);

export const mockEnergySocketProperties = {
  ip: 'localhost',
  port: mockPort,
  path: '/api/v1',
  serialNumber: mockSerialNumber,
  displayName: mockDisplayName,
  productType: 'HWE-SKT',
  productName: 'Energy Socket',
  apiUrl: mockApiUrl,
  hostname: mockHostname, // energy-socket-123456
  uuid: '123456',
  firmwareVersion: mockFirmwareVersion,
} satisfies EnergySocketAccessoryProperties;
