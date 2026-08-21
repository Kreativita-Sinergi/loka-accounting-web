import { type FormEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { Button, cx } from './ui'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
}

/**
 * Modal renders in a portal so a dialog opened from inside a scrolling table
 * is never clipped by its container.
 */
export function Modal({
  open,
  title,
  description,
  eyebrow,
  size = 'md',
  onClose,
  children,
  footer,
  tone = 'neutral',
}: {
  open: boolean
  title: string
  description?: ReactNode
  eyebrow?: string
  size?: ModalSize
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  tone?: 'neutral' | 'danger'
}) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    const focusTarget = panel.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, button')
    focusTarget?.focus()
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKeyDown) }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className={cx('modal-panel', sizes[size])} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panel}>
        <header className={cx('modal-head', tone === 'danger' && 'modal-head-danger')}>
          <div>
            {eyebrow && <p className="modal-eyebrow">{eyebrow}</p>}
            <h2 id={titleId}>{title}</h2>
            {description && <p className="modal-description">{description}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Tutup"><Icon name="close" className="size-4" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

/**
 * FormModal wires the dialog to a native form so browser validation, Enter to
 * submit, and the busy state all behave the way an ordinary page form does.
 */
export function FormModal({
  open,
  title,
  description,
  eyebrow,
  size = 'md',
  submitLabel = 'Simpan',
  busy = false,
  error,
  onClose,
  onSubmit,
  children,
  formKey,
}: {
  open: boolean
  title: string
  description?: ReactNode
  eyebrow?: string
  size?: ModalSize
  submitLabel?: string
  busy?: boolean
  error?: string | null
  onClose: () => void
  onSubmit: (values: FormData, form: HTMLFormElement) => void | Promise<void>
  children: ReactNode
  /** Remounts the form so defaultValue inputs pick up a newly selected record. */
  formKey?: string
}) {
  const formId = useId()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    await onSubmit(new FormData(form), form)
  }

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      eyebrow={eyebrow}
      size={size}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
          <Button type="submit" form={formId} disabled={busy}>{busy ? 'Menyimpan…' : submitLabel}</Button>
        </>
      }
    >
      {error && <p className="modal-error" role="alert">{error}</p>}
      <form id={formId} key={formKey} className="modal-form" onSubmit={(event) => void submit(event)}>{children}</form>
    </Modal>
  )
}

/**
 * ConfirmDialog covers deactivate, reactivate, and other reversible actions.
 * Pass confirmationWord to require the user to retype an identifier first,
 * which is what permanent deletes use.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Lanjutkan',
  tone = 'neutral',
  busy = false,
  error,
  confirmationWord,
  confirmationHint,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel?: string
  tone?: 'neutral' | 'danger'
  busy?: boolean
  error?: string | null
  confirmationWord?: string
  confirmationHint?: ReactNode
  onConfirm: () => void
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  useEffect(() => { if (open) setTyped('') }, [open])
  const blocked = Boolean(confirmationWord) && typed.trim() !== confirmationWord

  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      tone={tone}
      onClose={busy ? () => undefined : onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
          <Button
            type="button"
            className={tone === 'danger' ? 'border-red-700 bg-red-700 hover:border-red-800 hover:bg-red-800' : undefined}
            disabled={busy || blocked}
            onClick={onConfirm}
          >
            {busy ? 'Memproses…' : confirmLabel}
          </Button>
        </>
      }
    >
      {error && <p className="modal-error" role="alert">{error}</p>}
      <div className={cx('confirm-body', tone === 'danger' && 'confirm-body-danger')}>
        <span><Icon name={tone === 'danger' ? 'warning' : 'power'} className="size-5" /></span>
        <div>{description}</div>
      </div>
      {confirmationWord && (
        <label className="mt-4">
          <span>{confirmationHint ?? <>Ketik <strong>{confirmationWord}</strong> untuk konfirmasi</>}</span>
          <input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder={confirmationWord} autoComplete="off" />
        </label>
      )}
    </Modal>
  )
}

/**
 * useConfirm holds the record a confirm dialog is acting on plus the busy and
 * error state of the action, so pages do not repeat four useState calls each.
 */
export function useConfirm<T>() {
  const [target, setTarget] = useState<T | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = useRef<T | null>(null)

  const close = useCallback(() => { current.current = null; setTarget(null); setError(null) }, [])
  const open = useCallback((value: T) => { current.current = value; setTarget(value); setError(null) }, [])

  /**
   * run executes the action against the record the dialog is showing, so
   * callers never have to null-check it or repeat the busy and error wiring.
   */
  const run = useCallback((action: (target: T) => Promise<unknown>) => {
    const record = current.current
    if (record === null) return
    setBusy(true)
    setError(null)
    void action(record)
      .then(() => { current.current = null; setTarget(null) })
      .catch((failure) => setError(messageOf(failure)))
      .finally(() => setBusy(false))
  }, [])

  return { target, busy, error, open, close, run, setError }
}

/** messageOf pulls the human readable reason out of an API error envelope. */
export function messageOf(error: unknown, fallback = 'Permintaan gagal diproses.'): string {
  const response = (error as { response?: { data?: { error?: { details?: string }; message?: string } } }).response
  return response?.data?.error?.details ?? response?.data?.message ?? fallback
}
