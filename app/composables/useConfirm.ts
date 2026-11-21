export type ConfirmVariant = 'danger' | 'success' | 'warning' | 'info'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  variant?: ConfirmVariant
  /** Pengguna harus mengetik teks ini sebelum tombol konfirmasi aktif (mis. nama proyek). */
  requireText?: string
  /** Aksi async; dialog menampilkan loading dan pesan galat bila gagal. */
  action?: () => Promise<unknown>
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve?: (v: boolean) => void
}

export function useConfirm() {
  const state = useState<ConfirmState>('confirm-dialog', () => ({ open: false, title: '' }))
  function confirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      state.value = { ...opts, open: true, resolve }
    })
  }
  function close(result: boolean) {
    state.value.resolve?.(result)
    state.value = { ...state.value, open: false, resolve: undefined }
  }
  return { state, confirm, close }
}
