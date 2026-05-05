import path from 'path';

const BINARY_SCAN_BYTES = 8 * 1024;

export function isLikelyBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, BINARY_SCAN_BYTES).includes(0);
}

export function isWithinDirectory(basePath: string, targetPath: string): boolean {
  const relative = path.relative(basePath, targetPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}
