import {
  mockApiUrl,
  mockApiVersion,
  mockFirmwareVersion,
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
  serialNumber: mockSerialNumber,
  displayName: mockDisplayName,
  productType: mockProductType,
  productName: mockProductName,
  apiUrl: mockApiUrl,
  uuid: mockUUID,
  firmwareVersion: mockFirmwareVersion,
  apiVersion: mockApiVersion,
} satisfies EnergySocketAccessoryProperties;
