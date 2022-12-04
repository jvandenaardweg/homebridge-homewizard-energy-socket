export const bonjourServiceMock = {
  addresses: ["192.168.1.10"],
  name: "energysocket-280831",
  fqdn: "energysocket-280831._hwenergy._tcp.local",
  host: "energysocket-280831.local",
  referer: { address: "192.168.1.32", family: "IPv4", port: 5353, size: 294 },
  port: 80,
  type: "hwenergy",
  protocol: "tcp",
  subtypes: [],
  rawTxt: [
    {
      type: "Buffer",
      data: [97, 112, 105, 95, 101, 110, 97, 98, 108, 101, 100, 61, 49],
    },
    {
      type: "Buffer",
      data: [112, 97, 116, 104, 61, 47, 97, 112, 105, 47, 118, 49],
    },
    {
      type: "Buffer",
      data: [
        115, 101, 114, 105, 97, 108, 61, 51, 99, 51, 57, 101, 55, 50, 56, 48,
        57, 53, 50,
      ],
    },
    {
      type: "Buffer",
      data: [
        112, 114, 111, 100, 117, 99, 116, 95, 110, 97, 109, 101, 61, 69, 110,
        101, 114, 103, 121, 32, 83, 111, 99, 107, 101, 116,
      ],
    },
    {
      type: "Buffer",
      data: [
        112, 114, 111, 100, 117, 99, 116, 95, 116, 121, 112, 101, 61, 72, 87,
        69, 45, 83, 75, 84,
      ],
    },
  ],
  txt: {
    api_enabled: "1",
    path: "/api/v1",
    serial: "3c39e7280831",
    product_name: "Energy Socket",
    product_type: "HWE-SKT",
  },
};
