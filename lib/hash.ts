'use client';

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Text(input: string) {
  const data = Uint8Array.from(new TextEncoder().encode(input));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return `sha256:${toHex(digest)}`;
}

export async function sha256File(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return `sha256:${toHex(digest)}`;
}
