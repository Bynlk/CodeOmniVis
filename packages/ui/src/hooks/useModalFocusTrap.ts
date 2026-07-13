import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function getNextFocusIndex(
  currentIndex: number,
  itemCount: number,
  backwards: boolean,
): number {
  if (itemCount <= 0) return -1
  if (currentIndex < 0) return backwards ? itemCount - 1 : 0
  return backwards
    ? (currentIndex - 1 + itemCount) % itemCount
    : (currentIndex + 1) % itemCount
}

export function useModalFocusTrap<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open || !containerRef.current) return

    const container = containerRef.current
    const trigger = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const focusableElements = (): HTMLElement[] => Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    ).filter(element => element.getAttribute('aria-hidden') !== 'true')

    const initialFocus = focusableElements()[0] ?? container
    initialFocus.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const elements = focusableElements()
      const currentIndex = elements.indexOf(document.activeElement as HTMLElement)
      const nextIndex = getNextFocusIndex(currentIndex, elements.length, event.shiftKey)
      event.preventDefault()
      if (nextIndex >= 0) elements[nextIndex].focus()
      else container.focus()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      trigger?.focus()
    }
  }, [open])

  return containerRef
}
