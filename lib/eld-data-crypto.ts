import crypto from "crypto";

// Encrypts the actual ELD snapshot content (HOS clocks, duty status,
// location) — a THIRD master key, separate from both
// LOAD_SOURCE_MASTER_KEY and ELD_CONNECTION_MASTER_KEY. The connection key
// protects a provider credential; this one protects the data that
// credential was used to fetch. Keeping them apart means rotating or
// leaking one never implicates the other.

const NONCE_BYTES = 12;
export const ELD_DATA_SCHEMA_VERSION = "1";

function loadMasterKey(): Buffer {
  const raw = process.env.ELD_DATA_MASTER_KEY || "";
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
    if (key.length !== 32) key = Buffer.from(raw, "hex");
  } catch {
    key = Buffer.alloc(0);
  }
  if (key.length !== 32) {
    throw new Error("ELD_DATA_MASTER_KEY is missing or not a 32-byte key (base64 or hex).");
  }
  return key;
}

// Binds ciphertext to exactly this owner+driver+provider+externalDriverId+
// schema slot. Swapping a stored snapshot into a different driver's row,
// a different provider, or a stale schema all fail the auth tag instead
// of silently attaching the wrong driver's HOS data to someone else.
function aad(
  ownerId: string,
  driverEmail: string,
  provider: string,
  externalDriverId: string,
  schemaVersion: string
): Buffer {
  return Buffer.from(
    `eld-data|${ownerId}|${driverEmail}|${provider}|${externalDriverId}|${schemaVersion}`,
    "utf8"
  );
}

export function encryptEldData(
  plaintext: string,
  ownerId: string,
  driverEmail: string,
  provider: string,
  externalDriverId: string
): { nonceB64: string; ciphertextB64: string; schemaVersion: string } {
  const key = loadMasterKey();
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad(ownerId, driverEmail, provider, externalDriverId, ELD_DATA_SCHEMA_VERSION));
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    nonceB64: nonce.toString("base64"),
    ciphertextB64: Buffer.concat([enc, tag]).toString("base64"),
    schemaVersion: ELD_DATA_SCHEMA_VERSION,
  };
}

export function decryptEldData(
  nonceB64: string,
  ciphertextB64: string,
  ownerId: string,
  driverEmail: string,
  provider: string,
  externalDriverId: string,
  schemaVersion: string
): string {
  const key = loadMasterKey();
  const nonce = Buffer.from(nonceB64, "base64");
  const blob = Buffer.from(ciphertextB64, "base64");
  const tag = blob.subarray(blob.length - 16);
  const enc = blob.subarray(0, blob.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(aad(ownerId, driverEmail, provider, externalDriverId, schemaVersion));
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

export function eldDataMasterKeyConfigured(): boolean {
  try {
    loadMasterKey();
    return true;
  } catch {
    return false;
  }
}
