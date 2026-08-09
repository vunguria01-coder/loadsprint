import crypto from "crypto";

// Encrypts load-board provider credentials (DAT, 123Loadboard, Truckstop,
// Uber Freight, …) before they ever touch disk. The key lives only in the
// Railway environment (LOAD_SOURCE_MASTER_KEY) — never in the JSON store,
// never in a request/response body, never in a log line. If the key isn't
// set, encrypt()/decrypt() throw and the calling API route turns that into
// a clean "not configured" response instead of saving anything.

const NONCE_BYTES = 12; // AES-GCM standard nonce size

function loadMasterKey(): Buffer {
  const raw = process.env.LOAD_SOURCE_MASTER_KEY || "";
  // base64 first (what we tell people to generate), hex as a fallback for
  // anyone who set it that way by hand.
  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
    if (key.length !== 32) key = Buffer.from(raw, "hex");
  } catch {
    key = Buffer.alloc(0);
  }
  if (key.length !== 32) {
    throw new Error(
      "LOAD_SOURCE_MASTER_KEY is missing or not a 32-byte key (base64 or hex)."
    );
  }
  return key;
}

function aad(ownerId: string, provider: string): Buffer {
  // Binds the ciphertext to exactly this owner+provider slot — swapping a
  // stored ciphertext into a different tenant's or a different provider's
  // row fails the GCM auth tag, not just a plain "wrong bytes" mismatch.
  return Buffer.from(`${ownerId}|${provider}`, "utf8");
}

export function encryptSecret(
  plaintext: string,
  ownerId: string,
  provider: string
): { nonceB64: string; ciphertextB64: string } {
  const key = loadMasterKey();
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad(ownerId, provider));
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store the 16-byte auth tag appended to the ciphertext — one blob, one
  // field, nothing extra to keep in sync.
  return {
    nonceB64: nonce.toString("base64"),
    ciphertextB64: Buffer.concat([enc, tag]).toString("base64"),
  };
}

// Throws (SubtleCrypto-style "OperationError" via Node's crypto) if the
// tag doesn't match — a tampered ciphertext, a wrong nonce, or an AAD that
// no longer matches the owner/provider it was sealed under all fail the
// same way: loudly, not with silently-wrong plaintext.
export function decryptSecret(
  nonceB64: string,
  ciphertextB64: string,
  ownerId: string,
  provider: string
): string {
  const key = loadMasterKey();
  const nonce = Buffer.from(nonceB64, "base64");
  const blob = Buffer.from(ciphertextB64, "base64");
  const tag = blob.subarray(blob.length - 16);
  const enc = blob.subarray(0, blob.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(aad(ownerId, provider));
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

export function masterKeyConfigured(): boolean {
  try {
    loadMasterKey();
    return true;
  } catch {
    return false;
  }
}
