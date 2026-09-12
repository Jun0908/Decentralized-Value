// Pinned en-US ASCII collation for legacy protocol field names. QuickJS's
// localeCompare is not ICU-backed and orders camelCase keys differently.
// Preserve existing V8/ICU hashes without depending on host locale for ASCII.
const primaryOrder = " _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$0123456789abcdefghijklmnopqrstuvwxyz";

export function compareProtocolKeys(left: string, right: string): number {
  // Historical callers can have non-ASCII custom keys. Their legacy behavior
  // is unchanged; cross-runtime compatibility is only claimed for ASCII keys.
  if (!/^[\x20-\x7e]*$/.test(left) || !/^[\x20-\x7e]*$/.test(right))
    return left.localeCompare(right);
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const difference = primaryOrder.indexOf(a[i]!) - primaryOrder.indexOf(b[i]!);
    if (difference) return difference;
  }
  if (a.length !== b.length) return a.length - b.length;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] === a[i] ? -1 : 1;
  }
  return 0;
}
