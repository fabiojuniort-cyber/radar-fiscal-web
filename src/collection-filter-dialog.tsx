import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function FilterDialog({ title, description, onClose, children }: {
  title: string; description: string; onClose: () => void; children: ReactNode
}) {
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="cf-dialog-overlay" />
      <Dialog.Content className="cf-dialog" onCloseAutoFocus={event => {
        event.preventDefault()
        const trigger = document.querySelector<HTMLElement>('[data-cf-return-focus="true"]')
        const target = trigger ?? document.querySelector<HTMLElement>('.cf-tabs .is-active, .cf-back')
        target?.focus()
        trigger?.removeAttribute('data-cf-return-focus')
      }}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Description>{description}</Dialog.Description>
        <Dialog.Close asChild><button type="button" className="cf-dialog-close" aria-label="Fechar popup"><X size={20} /></button></Dialog.Close>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}

export function rememberDialogTrigger() {
  document.querySelector('[data-cf-return-focus]')?.removeAttribute('data-cf-return-focus')
  if (document.activeElement instanceof HTMLElement) document.activeElement.setAttribute('data-cf-return-focus', 'true')
}
