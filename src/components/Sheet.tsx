import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import './Sheet.css'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * A bottom sheet on phones / centred panel on larger screens, built on the
 * native <dialog> (focus trapping, Esc to close and the backdrop for free).
 * Tapping the backdrop closes it.
 */
export default function Sheet({ open, title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // The native `close` event fires asynchronously — also when *we* close the
  // dialog because `open` went false. Only report closes the user started
  // (Esc), or a late event could shut a sheet opened in the meantime.
  const openRef = useRef(open)
  openRef.current = open

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={() => {
        if (openRef.current) onClose()
      }}
      onClick={(e) => {
        // Clicks on the backdrop land on the <dialog> itself.
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="sheet__inner">
        <div className="sheet__head">
          <h3 className="sheet__title">{title}</h3>
          <button type="button" className="btn sheet__done" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="sheet__body">{open ? children : null}</div>
      </div>
    </dialog>
  )
}
