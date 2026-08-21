import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function Button({ variant = 'primary', icon, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost'; icon?: IconName }) {
  const variants = {
    primary: 'border-brand bg-brand text-white hover:border-brand-strong hover:bg-brand-strong',
    secondary: 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
    ghost: 'border-transparent bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800',
  }
  return <button className={cx('inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-bold shadow-xs transition disabled:pointer-events-none disabled:opacity-45', variants[variant], className)} {...props}>{icon && <Icon name={icon} className="size-4" />}{children}</button>
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-[14px] border border-slate-200 bg-white shadow-panel', className)} {...props} />
}

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'success' | 'warning' | 'info' }) {
  const tones = { neutral: 'bg-slate-100 text-slate-600', success: 'bg-emerald-50 text-emerald-700', warning: 'bg-orange-50 text-orange-800', info: 'border border-blue-200 bg-blue-50 text-blue-700' }
  return <span className={cx('inline-flex min-h-6 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold', tones[tone], className)} {...props} />
}

export function PageHeader({ eyebrow, title, description, action, compact = true }: { eyebrow: string; title: string; description: string; action?: ReactNode; compact?: boolean }) {
  return <header className={cx('mb-7 flex justify-between gap-7 max-sm:grid max-sm:gap-3.5', compact ? 'items-end' : 'items-start')}><div><p className="m-0 font-display text-[10px] font-bold tracking-[.16em] text-brand uppercase">{eyebrow}</p><h1 className={cx('mt-1 mb-2 max-w-4xl font-display font-extrabold leading-[1.12] tracking-[-1.2px] text-slate-950', compact ? 'text-[clamp(28px,2.5vw,34px)]' : 'text-[clamp(29px,3vw,40px)]')}>{title}</h1><p className="m-0 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p></div>{action}</header>
}

export function DataEntryGuide({ steps, note, title = 'Cara menambah data' }: { steps: string[]; note?: string; title?: string }) {
  return <details className="mb-4.5 overflow-hidden rounded-xl border border-blue-200 bg-blue-50 shadow-xs" open>
    <summary className="cursor-pointer list-none px-5 py-3.5 text-xs font-extrabold text-blue-900 marker:hidden">Panduan · {title}<span className="float-right text-[10px] font-semibold text-blue-600">Klik untuk buka/tutup</span></summary>
    <div className="border-t border-blue-200 bg-white/70 px-5 py-4">
      <ol className="m-0 grid gap-2 pl-5 text-[11px] leading-relaxed text-slate-600">{steps.map((step, index) => <li key={index} className="pl-1 marker:font-extrabold marker:text-brand">{step}</li>)}</ol>
      {note && <p className="mt-3 mb-0 rounded-lg bg-blue-100/70 px-3 py-2 text-[10px] leading-relaxed text-blue-800"><strong>Catatan:</strong> {note}</p>}
    </div>
  </details>
}

export function EmptyState({ children, icon = 'empty' }: { children: ReactNode; icon?: IconName }) {
  return <div className="grid min-h-36 place-items-center p-9 text-center text-xs text-slate-400"><div><Icon name={icon} className="mx-auto mb-2 size-6" />{children}</div></div>
}
