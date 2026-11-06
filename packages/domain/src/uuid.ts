/**
 * ALGIONS Pharmacy - UUIDv7 Generator (RFC 9562)
 * Time-sortable, 128-bit UUID generator for collision-free online and offline IDs.
 * Universal implementation compatible with modern browser & Node.js environments.
 */

let lastTimestamp = -1;
let sequence = 0;

function getRandomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < count; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

export function generateUUIDv7(timestampMs: number = Date.now()): string {
  if (timestampMs <= lastTimestamp) {
    sequence = (sequence + 1) & 0xfff;
    timestampMs = lastTimestamp;
  } else {
    lastTimestamp = timestampMs;
    sequence = 0;
  }

  const bytes = new Uint8Array(16);

  // 48-bit timestamp
  bytes[0] = (timestampMs >> 40) & 0xff;
  bytes[1] = (timestampMs >> 32) & 0xff;
  bytes[2] = (timestampMs >> 24) & 0xff;
  bytes[3] = (timestampMs >> 16) & 0xff;
  bytes[4] = (timestampMs >> 8) & 0xff;
  bytes[5] = timestampMs & 0xff;

  // Version 7 in high nibble of byte 6, 4 bits of sequence in low nibble
  bytes[6] = 0x70 | ((sequence >> 8) & 0x0f);
  bytes[7] = sequence & 0xff;

  // Variant 1 (RFC 4122 / 9562) in byte 8 (10xxxxxx)
  const randomBytes = getRandomBytes(8);
  bytes[8] = 0x80 | (randomBytes[0]! & 0x3f);
  for (let i = 9; i < 16; i++) {
    bytes[i] = randomBytes[i - 8]!;
  }

  // Format as standard 8-4-4-4-12 hex string
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
