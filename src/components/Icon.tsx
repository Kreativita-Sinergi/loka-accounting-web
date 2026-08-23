import type { ReactNode, SVGProps } from 'react'

export type IconName = 'home' | 'journal' | 'ledger' | 'accounts' | 'operations' | 'payroll' | 'manufacturing' | 'currency' | 'reports' | 'compliance' | 'settings' | 'logout' | 'plus' | 'download' | 'check' | 'empty' | 'project' | 'asset' | 'upload' | 'printer' | 'more' | 'edit' | 'trash' | 'power' | 'close' | 'search' | 'refresh' | 'warning' | 'chevron' | 'building' | 'bank' | 'tag' | 'cart' | 'boxes' | 'receipt' | 'help' | 'bell' | 'grid'

const paths: Record<IconName, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5M9 21v-7h6v7"/></>,
  journal: <><path d="M4 3h16v18H4z"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
  ledger: <><path d="M5 4h14v16H5zM9 4v16"/><path d="M12 8h4M12 12h4M12 16h4"/></>,
  accounts: <><circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><path d="M2 20c0-4 2-7 5-7s5 3 5 7M12 20c0-4 2-7 5-7s5 3 5 7"/></>,
  operations: <><path d="M4 7h14M14 3l4 4-4 4M20 17H6M10 13l-4 4 4 4"/></>,
  payroll: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h6M7 13h10M7 16h4"/></>,
  manufacturing: <><path d="M3 21V10l6 4V9l6 4V5h6v16z"/><path d="M7 18h2M13 18h2M18 9h3"/></>,
  currency: <><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.7-1-1.8-1.5-3.3-1.5-1.8 0-3.2.9-3.2 2.4 0 3.6 6.5 1.6 6.5 5.2 0 1.5-1.4 2.4-3.3 2.4-1.5 0-2.8-.6-3.7-1.6M12 5v14"/></>,
  reports: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  compliance: <><path d="M12 3 4 6v6c0 5 3.3 8 8 9 4.7-1 8-4 8-9V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M13 3h7v18h-7"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  empty: <><path d="M4 7h16v12H4z"/><path d="M8 7V4h8v3M9 12h6"/></>,
  project: <><path d="M3 7h7l2 2h9v11H3z"/><path d="M7 13h8M7 16h5"/></>,
  asset: <><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V5h8v3M12 12v4M10 14h4"/></>,
  upload: <><path d="M12 20V8M7 13l5-5 5 5"/><path d="M4 20h16"/></>,
  more: <><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></>,
  edit: <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M13.5 6.5l3 3"/></>,
  trash: <><path d="M4 7h16M10 4h4M9 7v12M15 7v12"/><path d="M6 7l1 13h10l1-13"/></>,
  power: <><path d="M12 3v9"/><path d="M7.5 6.5a7 7 0 1 0 9 0"/></>,
  close: <path d="M6 6l12 12M18 6L6 18"/>,
  search: <><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></>,
  refresh: <><path d="M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2"/><path d="M18 3v4h-4M6 21v-4h4"/></>,
  warning: <><path d="M12 4 2.8 20h18.4z"/><path d="M12 10v4M12 17.2v.2"/></>,
  chevron: <path d="m6 9 6 6 6-6"/>,
  building: <><path d="M4 21V5l8-2v18M12 21V9l8 2v10M2 21h20"/><path d="M7 8v.01M7 12v.01M7 16v.01M16 14v.01M16 17v.01"/></>,
  bank: <><path d="M3 10 12 4l9 6M4 10v9M20 10v9M8 10v9M16 10v9M2 21h20"/></>,
  tag: <><path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="7.5" r="1.2"/></>,
  cart: <><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M2 3h3l2.5 12h11L21 7H6"/></>,
  boxes: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></>,
  receipt: <><path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/><path d="M9 8h6M9 12h6"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5A2.6 2.6 0 0 1 12 7.6c1.5 0 2.6 1 2.6 2.3 0 2-2.6 2-2.6 4M12 17v.01"/></>,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z"/><path d="M10 18a2 2 0 0 0 4 0"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  printer: <><path d="M7 8V3h10v5"/><rect x="4" y="8" width="16" height="8" rx="2"/><path d="M7 14h10v7H7z"/></>,
}

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
