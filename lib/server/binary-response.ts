export function toBinaryResponseBody(
  value: ArrayBuffer | ArrayBufferView,
): Uint8Array {
  if (ArrayBuffer.isView(value)) {
    const view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return Uint8Array.from(view);
  }

  return Uint8Array.from(new Uint8Array(value));
}
