import type { ReactNode, SVGProps } from 'react'

export type IconName = 'home' | 'journal' | 'ledger' | 'accounts' | 'operations' | 'payroll' | 'manufacturing' | 'currency' | 'reports' | 'compliance' | 'settings' | 'logout' | 'plus' | 'download' | 'check' | 'empty'

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
}

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>
}
