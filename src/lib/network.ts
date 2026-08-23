import { networkInterfaces } from "node:os";

/** First non-internal IPv4 address, i.e. the one a device on the LAN can reach. */
export const getLanAddress = (): string | null => {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) return address.address;
    }
  }
  return null;
};
