export interface Toast { id: number, text: string, tone: 'success' | 'error' | 'info' }

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])
  function push(text: string, tone: Toast['tone'] = 'success', ms = 4000) {
    const id = Date.now() + Math.random()
    toasts.value = [...toasts.value, { id, text, tone }]
    if (import.meta.client) setTimeout(() => dismiss(id), ms)
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }
  return {
    toasts,
    dismiss,
    success: (t: string) => push(t, 'success'),
    error: (t: string) => push(t, 'error', 6000),
    info: (t: string) => push(t, 'info'),
  }
}

/** Pesan galat ramah dari respons $fetch. */
export function errorMessage(e: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  const err = e as { data?: { statusMessage?: string, message?: string }, statusMessage?: string, message?: string }
  return err?.data?.statusMessage || err?.statusMessage || err?.data?.message || fallback
}
