/** The stores a visitor can pick. `kinds` are the version kinds each one can install. */
export const STORES = [
  { id: 'all', label: 'All stores', short: 'All', icon: 'Layers01Icon', kinds: ['adp', 'ipa'] },
  { id: 'pal', label: 'AltStore PAL', short: 'PAL', icon: 'Store01Icon', kinds: ['adp'] },
  { id: 'classic', label: 'AltStore Classic', short: 'Classic', icon: 'Package01Icon', kinds: ['ipa'] },
  { id: 'sidestore', label: 'SideStore', short: 'SideStore', icon: 'Download01Icon', kinds: ['ipa'] },
];

/** Value for a `data-stores` attribute: the stores that can install an entry with these kinds. */
export function storesFor(kinds) {
  return STORES.filter((s) => s.id !== 'all' && s.kinds.some((k) => kinds.includes(k))).map((s) => s.id).join(' ');
}
