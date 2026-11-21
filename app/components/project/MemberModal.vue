<script setup lang="ts">
/** Tambah anggota tim ke proyek langsung dari halaman detail. */
const props = defineProps<{ open: boolean, projectId: number, existingIds: number[], canMoney: boolean }>()
const emit = defineEmits<{ close: [], saved: [] }>()
const toast = useToast()
const { data: users, refresh } = await useFetch('/api/users', { immediate: false, server: false, default: () => [] as any[] })

const f = reactive({ userId: null as number | null, roleInProject: '', payType: 'bagi_hasil' as 'bagi_hasil' | 'tetap', fixedFee: 0, shareWeight: 1 })
const saving = ref(false)
const err = ref('')

watch(() => props.open, async (o) => {
  if (!o) return
  err.value = ''
  Object.assign(f, { userId: null, roleInProject: '', payType: 'bagi_hasil', fixedFee: 0, shareWeight: 1 })
  await refresh()
})
const options = computed(() => (users.value as any[])
  .filter(u => u.role !== 'investor' && u.status !== 'nonaktif' && !props.existingIds.includes(u.id))
  .map(u => ({ value: u.id as number | null, label: u.name as string, desc: [ROLE_LABEL[u.role as Role], u.title].filter(Boolean).join(' · ') })))
const payOpts = [
  { value: 'bagi_hasil' as const, label: 'Bagi hasil' },
  { value: 'tetap' as const, label: 'Honor tetap' },
]

async function save() {
  err.value = ''
  if (!f.userId) { err.value = 'Pilih anggota.'; return }
  saving.value = true
  try {
    await $fetch(`/api/projects/${props.projectId}/members`, { method: 'POST', body: { ...f, roleInProject: f.roleInProject.trim() || null } })
    toast.success('Anggota ditambahkan ke tim')
    emit('saved')
    emit('close')
  } catch (e) { err.value = errorMessage(e) } finally { saving.value = false }
}
</script>

<template>
  <UiModal :open="open" title="Tambah Anggota Tim" description="Anggota baru langsung bisa melihat proyek ini dan bug yang ditugaskan." @close="emit('close')">
    <p v-if="err" role="alert" class="m-0 text-sm text-danger-700 bg-danger-50 rounded-lg px-3 py-2.5">{{ err }}</p>
    <UiSearchSelect v-model="f.userId" label="Anggota" :options="options" placeholder="Pilih pengguna" search-placeholder="Cari nama…" />
    <p v-if="!options.length" class="m-0 text-xs text-muted">Semua pengguna sudah menjadi anggota. Undang developer baru di Pengaturan › Pengguna.</p>
    <label class="field">Peran di proyek<input v-model="f.roleInProject" type="text" class="input" placeholder="Mis. Frontend developer"></label>
    <div class="grid gap-4 sm:grid-cols-2">
      <UiSelect v-if="canMoney" v-model="f.payType" label="Cara bayar" :options="payOpts" />
      <UiMoneyInput v-if="canMoney && f.payType === 'tetap'" v-model="f.fixedFee" label="Honor tetap" />
      <label v-else-if="f.payType === 'bagi_hasil'" class="field">Bobot bagi hasil<input v-model.number="f.shareWeight" type="number" min="0" max="100" step="1" class="input"></label>
    </div>
    <template #footer>
      <button type="button" class="btn-secondary" @click="emit('close')">Batal</button>
      <button type="button" class="btn-primary" :disabled="saving || !f.userId" @click="save">{{ saving ? 'Menyimpan…' : 'Tambah Anggota' }}</button>
    </template>
  </UiModal>
</template>
