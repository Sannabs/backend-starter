export type Scope = "ip" | "user";

export interface Policy {
  capacity: number;
  refillPerSec: number;
  scope: Scope;
  failOpen: boolean;
}

// Gambian carriers are behind CGNAT, so one IP is a whole network of customers.
// IP-scoped limits are sized to stop a single abusive host, not to ration a person.
export const POLICIES = {
  global: { capacity: 2000, refillPerSec: 50, scope: "ip", failOpen: true },
  "api:default": { capacity: 100, refillPerSec: 100 / 60, scope: "user", failOpen: true },
  // Resend-verification and password-reset each send an email, so a Redis outage must not open the tap.
  "auth:email": { capacity: 10, refillPerSec: 10 / 600, scope: "ip", failOpen: false },
} satisfies Record<string, Policy>;

export type PolicyName = keyof typeof POLICIES;
