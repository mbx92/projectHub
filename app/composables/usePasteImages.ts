/** Tangkap gambar yang ditempel (Ctrl+V) dari clipboard, mis. tangkapan layar. Paste teks tidak terpengaruh. */
export function usePasteImages(active: () => boolean, onFiles: (files: File[]) => void) {
  function onPaste(e: ClipboardEvent) {
    if (!active()) return
    const images = [...(e.clipboardData?.files ?? [])].filter(f => f.type.startsWith('image/'))
    if (!images.length) return
    e.preventDefault()
    const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, '')
    onFiles(images.map((f, i) => {
      const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '')
      return new File([f], `tangkapan-layar-${stamp}${images.length > 1 ? `-${i + 1}` : ''}.${ext}`, { type: f.type })
    }))
  }
  onMounted(() => window.addEventListener('paste', onPaste))
  onBeforeUnmount(() => window.removeEventListener('paste', onPaste))
}
