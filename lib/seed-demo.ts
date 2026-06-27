import crypto from "crypto";
import {
  addUser,
  findByEmail,
  hashPassword,
  newId,
  type User,
} from "./auth";
import { createLoad, getLoadsByDriverEmail, type Stop } from "./loads";

// Demo accounts for the App Store reviewer (and quick demos). Idempotent:
// safe to call on every request; only creates what's missing. Because Railway
// storage can reset on redeploy, this guarantees the reviewer always has a
// working driver account with sample loads. Disable by setting SEED_DEMO=false.

export const DEMO_DRIVER_EMAIL = "demo.driver@loadsprint.us.com";
export const DEMO_DRIVER_PASSWORD = "Demo-Driver-2026";
const DEMO_DISPATCH_EMAIL = "demo.dispatch@loadsprint.us.com";
const DEMO_DISPATCH_PASSWORD = "Demo-Dispatch-2026";

function ensureUser(opts: {
  name: string;
  email: string;
  password: string;
  role: User["role"];
}): User {
  const found = findByEmail(opts.email);
  if (found) return found;
  const { salt, hash } = hashPassword(opts.password);
  const user: User = {
    id: newId(),
    name: opts.name,
    company: "LoadSprint Demo",
    email: opts.email,
    role: opts.role,
    tier: "platinum",
    canFreezeLocation: opts.role === "dispatcher",
    freezeActive: false,
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };
  addUser(user);
  return user;
}

function stop(kind: "pickup" | "dropoff", address: string, time: string): Stop {
  return { id: crypto.randomUUID(), kind, address, time, done: false };
}

export function ensureDemo() {
  if (process.env.SEED_DEMO === "false") return;
  try {
    const dispatcher = ensureUser({
      name: "Demo Dispatcher",
      email: DEMO_DISPATCH_EMAIL,
      password: DEMO_DISPATCH_PASSWORD,
      role: "dispatcher",
    });
    const driver = ensureUser({
      name: "Demo Driver",
      email: DEMO_DRIVER_EMAIL,
      password: DEMO_DRIVER_PASSWORD,
      role: "driver",
    });

    // Only create sample loads if this demo driver has none yet.
    const existing = getLoadsByDriverEmail(driver.email);
    if (existing.length > 0) return;

    createLoad({
      dispatcherId: dispatcher.id,
      ref: "LS-50321",
      driverName: driver.name,
      driverEmail: driver.email,
      originName: "Dallas, TX",
      destName: "Atlanta, GA",
      brokerName: "Sample Freight Brokerage",
      rate: 2450,
      billTo: "Sample Freight Brokerage",
      stops: [
        stop("pickup", "10000 Logistics Pkwy, Dallas, TX 75201", "Mon 08:00-12:00"),
        stop("dropoff", "455 Peachtree Industrial Blvd, Atlanta, GA 30301", "Tue 13:00-17:00"),
      ],
    });

    createLoad({
      dispatcherId: dispatcher.id,
      ref: "LS-50488",
      driverName: driver.name,
      driverEmail: driver.email,
      originName: "Memphis, TN",
      destName: "Nashville, TN",
      brokerName: "Sample Freight Brokerage",
      rate: 900,
      billTo: "Sample Freight Brokerage",
      stops: [
        stop("pickup", "2100 Distribution Center Dr, Memphis, TN 38118", "Wed 09:00-11:00"),
        stop("pickup", "88 Riverside Dr, Memphis, TN 38103", "Wed 12:00-13:00"),
        stop("dropoff", "1200 Broadway, Nashville, TN 37203", "Wed 17:00-19:00"),
      ],
    });
  } catch {
    // Never let demo seeding break a real request.
  }
}
