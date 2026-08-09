import crypto from "crypto";

// Encrypts ELD provider credentials (Motive, Samsara, Geotab, Verizon
// Connect) before they ever touch disk — a separate master key from
// lib/load-source-crypto.ts's LOAD_SOURCE_MASTER_KEY, deliberately, so a
// leak or rotation of one secret store never touches the other. The key
// lives only in the Railway environment; if it isn't set, encrypt/decrypt
// throw and the calling store/route turns that into a fail-closed "not
// configured" response instead of ever writing plaintext to disk.

const NONCE_BYTES = 12; // AES-GCM standard nonce size
export const ELD_CONNECTION_SCHEMA_VERSION = "1";

function loadMasterKey(): Buffer {
  const raw = process.env.ELD_CONNECTION_MASTER_KEY || "";
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
    if (key.length !== 32) key = Buffer.from(raw, "hex");
  } catch {
    key = Buffer.alloc(0);
  }
  if (key.length !== 32) {
    throw new Error(
      "ELD_CONNECTION_MASTER_KEY is missing or not a 32-byte key (base64 or hex)."
    );
  }
  return key;
}

// Binds ciphertext to exactly this owner+provider+schema slot — swapping a
// stored ciphertext into a different tenant's or provider's row, or reusing
// it after a schema change, fails the GCM auth tag instead of silently
// decrypting into the wrong shape.
function aad(ownerId: string, provider: string, schemaVersion: string): Buffer {
  return Buffer.from(`eld|${ownerId}|${provider}|${schemaVersion}`, "utf8");
}

export function encryptEldCredential(
  plaintext: string,
  ownerId: string,
  provider: string
): { nonceB64: string; ciphertextB64: string; schemaVersion: string } {
  const key = loadMasterKey();
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad(ownerId, provider, ELD_CONNECTION_SCHEMA_VERSION));
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    nonceB64: nonce.toString("base64"),
    ciphertextB64: Buffer.concat([enc, tag]).toString("base64"),
    schemaVersion: ELD_CONNECTION_SCHEMA_VERSION,
  };
}

// Throws if the tag doesn't match — a tampered ciphertext, wrong nonce, or
// an AAD that no longer matches owner/provider/schema all fail the same
// way: loudly, not with silently-wrong plaintext.
export function decryptEldCredential(
  nonceB64: string,
  ciphertextB64: string,
  ownerId: string,
  provider: string,
  schemaVersion: string
): string {
  const key = loadMasterKey();
  const nonce = Buffer.from(nonceB64, "base64");
  const blob = Buffer.from(ciphertextB64, "base64");
  const tag = blob.subarray(blob.length - 16);
  const enc = blob.subarray(0, blob.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(aad(ownerId, provider, schemaVersion));
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

export function eldMasterKeyConfigured(): boolean {
  try {
    loadMasterKey();
    return true;
  } catch {
    return false;
  }
}
