import {
  mockApiPath,
  mockApiUrl,
  mockFirmwareVersion,
  mockHostname,
  mockPort,
  mockProductName,
  mockProductType,
  mockSerialNumber,
} from '@/api/mocks/api';
import { EnergySocketAccessoryProperties } from '@/api/types';
import hap from 'hap-nodejs';

export const mockDisplayName = `${mockProductType} ${mockSerialNumber}`;
export const mockUUID = hap.uuid.generate(mockSerialNumber);

export const mockAccessoryContext = {
  ip: 'localhost', // use localhost instead of ip for mocking the endpoint
  port: mockPort,
  path: mockApiPath,
  serialNumber: mockSerialNumber,
  displayName: mockDisplayName,
  productType: mockProductType,
  productName: mockProductName,
  apiUrl: mockApiUrl,
  hostname: mockHostname, // energy-socket-123456
  uuid: mockUUID,
  firmwareVersion: mockFirmwareVersion,
} satisfies EnergySocketAccessoryProperties;
