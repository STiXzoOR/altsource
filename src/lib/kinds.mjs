/** 'adp' (AltStore PAL) | 'ipa' (AltStore Classic / SideStore) | null when it cannot be told. */
export function inferKind(version) {
  if (!version || typeof version !== 'object') return null;
  if (version.kind === 'adp' || version.kind === 'ipa') return version.kind;
  if (version.assetURLs && typeof version.assetURLs === 'object') return 'adp';
  if (typeof version.downloadURL !== 'string') return null;
  let pathname;
  try { pathname = new URL(version.downloadURL, 'https://placeholder.invalid/').pathname; } catch { return null; }
  if (pathname.endsWith('/manifest.json') || pathname.endsWith('/')) return 'adp';
  if (pathname.toLowerCase().endsWith('.ipa')) return 'ipa';
  return null;
}
