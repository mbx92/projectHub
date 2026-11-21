export interface UploadedFile { key: string, name: string, size: number, mime: string | null, url: string | null }

export function useUpload() {
  const uploading = ref(false)
  async function upload(file: File, folder: 'bukti' | 'bug' | 'dokumen' | 'logo'): Promise<UploadedFile> {
    if (file.size > 10 * 1024 * 1024) throw new Error('Ukuran file maksimal 10 MB.')
    const fd = new FormData()
    fd.append('folder', folder)
    fd.append('file', file)
    uploading.value = true
    try {
      return await $fetch<UploadedFile>('/api/files', { method: 'POST', body: fd })
    } finally {
      uploading.value = false
    }
  }
  return { upload, uploading }
}
