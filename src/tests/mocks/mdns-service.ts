// import { MDNS_DISCOVERY_PROTOCOL, MDNS_DISCOVERY_TYPE } from '@/api/types';
import mdns from 'mdns';

const mockServiceType = {
  name: 'hwenergy',
  protocol: 'tcp',
  subtypes: [],
  fullyQualified: true,
} as any;
// const mockServiceType = mdns.makeServiceType({
//   name: MDNS_DISCOVERY_TYPE,
//   protocol: MDNS_DISCOVERY_PROTOCOL,
//   subtypes: [''],
//   fullyQualified: true,
// });

export const mockMdnsServiceUp: mdns.Service = {
  interfaceIndex: 16,
  type: mockServiceType,
  replyDomain: 'local.',
  flags: 3, // TODO: flag correct?
  name: 'energysocket-2817F6',
  networkInterface: 'en0',
  fullname: 'energysocket-2817F6._hwenergy._tcp.local.',
  host: 'energysocket-2817F6.local.',
  port: 80,
  rawTxtRecord: Buffer.alloc(5), // mock
  txtRecord: {
    api_enabled: '1',
    path: '/api/v1',
    serial: '3c39e72817f6',
    product_name: 'Energy Socket',
    product_type: 'HWE-SKT',
  },
  addresses: ['192.168.1.31'],
};

export const mockMdnsServiceNew: mdns.Service = {
  ...mockMdnsServiceUp,
  flags: mdns.kDNSServiceFlagsAdd, // new flag
};

// real example i could find
export const mockMdnsServiceDown = {
  interfaceIndex: 16,
  type: mockServiceType,
  replyDomain: 'local.',
  flags: 0,
  name: 'energysocket-2817F6',
  networkInterface: 'en0',
} satisfies Omit<mdns.Service, 'addresses' | 'fullname' | 'host' | 'port'>;
