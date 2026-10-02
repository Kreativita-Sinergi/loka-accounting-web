import { useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function Button({ variant = 'primary', icon, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName }) {
  const variants = {
    primary: 'border-[color:var(--accent)] bg-[color:var(--accent)] text-white hover:brightness-110',
    secondary: 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
    ghost: 'border-transparent bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800',
    danger: 'border-[color:var(--danger)] bg-[color:var(--danger)] text-white hover:brightness-90',
  }
  return <button className={cx('inline-flex min-h-8.5 items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-[12px] font-bold shadow-xs transition disabled:pointer-events-none disabled:opacity-45', variants[variant], className)} {...props}>{icon && <Icon name={icon} className="size-4" />}{children}</button>
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-lg border border-[color:var(--border)] bg-white shadow-panel', className)} {...props} />
}

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: 'neutral' | 'success' | 'warning' | 'info' }) {
  const tones = { neutral: 'bg-slate-100 text-slate-600', success: 'bg-emerald-50 text-emerald-700', warning: 'bg-orange-50 text-orange-800', info: 'border border-blue-200 bg-blue-50 text-blue-700' }
  return <span className={cx('inline-flex min-h-6 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold', tones[tone], className)} {...props} />
}

export function PageHeader({ eyebrow, title, description, action, compact = true }: { eyebrow: string; title: string; description: string; action?: ReactNode; compact?: boolean }) {
  return <header className={cx('mb-4 flex justify-between gap-6 max-sm:grid max-sm:gap-3.5', compact ? 'items-end' : 'items-start')}><div><p className="m-0 text-[10px] font-bold tracking-[.16em] text-[color:var(--accent)] uppercase">{eyebrow}</p><h1 className={cx('mt-0.5 mb-1 max-w-4xl font-bold leading-tight tracking-tight text-slate-950', compact ? 'text-lg' : 'text-xl')}>{title}</h1><p className="m-0 max-w-3xl text-[12px] leading-relaxed text-[color:var(--fg-muted)]">{description}</p></div>{action}</header>
}

export function EmptyState({ children, icon = 'empty' }: { children: ReactNode; icon?: IconName }) {
  return <div className="grid min-h-36 place-items-center p-9 text-center text-xs text-slate-400"><div><Icon name={icon} className="mx-auto mb-2 size-6" />{children}</div></div>
}

/** Teks isian uang Indonesia ("1.250.000,5") menjadi angka polos untuk API ("1250000.5"). */
export function normalizeMoney(value: string) {
  return value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
}

/** Angka polos ("1250000.5") menjadi tampilan bertitik ribuan ("1.250.000,5"). */
export function formatMoneyInput(value: string, allowNegative = false) {
  const negative = allowNegative && value.trim().startsWith('-')
  const [whole, fraction] = value.replace(/[^0-9.]/g, '').split('.')
  const grouped = (whole || '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${negative ? '-' : ''}${grouped}${fraction !== undefined ? ',' + fraction : ''}`
}

/**
 * Isian nominal dengan titik ribuan saat mengetik. Nilai yang dikirim lewat
 * `name` (FormData) maupun `onChange` selalu angka polos bertitik desimal,
 * karena server menolak "5.000.000".
 */
export function MoneyInput({ name, value, defaultValue = '', onChange, allowNegative = false, ...rest }: {
  name?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  allowNegative?: boolean
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'name'>) {
  const [local, setLocal] = useState(defaultValue)
  const raw = value ?? local
  return (
    <>
      <input
        {...rest}
        inputMode="decimal"
        value={formatMoneyInput(raw, allowNegative)}
        onChange={(event) => {
          const next = normalizeMoney(event.target.value)
          const clean = (allowNegative && next.startsWith('-') ? '-' : '') + next.replace(/[^0-9.]/g, '')
          setLocal(clean)
          onChange?.(clean)
        }}
      />
      {name && <input type="hidden" name={name} value={raw} />}
    </>
  )
}
