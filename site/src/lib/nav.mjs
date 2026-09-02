/** Primary navigation shared by the desktop sidebar and the phone tab bar. */
export const navItems = (base) => [
  { label: 'Home', href: base, icon: 'Home01Icon' },
  { label: 'Apps', href: `${base}apps/`, icon: 'Grid2X2Icon' },
  { label: 'News', href: `${base}news/`, icon: 'News01Icon' },
  { label: 'Status', href: `${base}status/`, icon: 'Activity01Icon' },
];

/** Home only matches itself; every other section matches its subtree. */
export function isCurrent(pathname, href, base) {
  const p = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return href === base ? p === base : p.startsWith(href);
}
