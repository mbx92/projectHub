<script setup lang="ts">
/**
 * Editor isi dokumen (TipTap). Toolbar berada di luar kertas dokumen dan menempel di bawah topbar;
 * kop & footer dipasang lewat slot `header` / `footer` dan tidak ikut diedit.
 */
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Save, Bold, Italic, Underline, List, ListOrdered, Heading2, Heading3, Pilcrow, Table as TableIcon, Undo2, Redo2, BetweenVerticalEnd, BetweenHorizontalEnd, Trash2 } from 'lucide-vue-next'
import type { Component } from 'vue'

const props = defineProps<{ modelValue: Record<string, unknown>, editable: boolean, label?: string, dirty?: boolean, saving?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [Record<string, unknown>], save: [] }>()

// Ctrl/Cmd+S menyimpan dokumen.
function onKeydown(e: KeyboardEvent) {
  if (!props.editable || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 's') return
  e.preventDefault()
  if (props.dirty && !props.saving) emit('save')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const editor = useEditor({
  content: props.modelValue,
  editable: props.editable,
  extensions: [
    // Hanya fitur yang bisa diekspor ke PDF/Word.
    StarterKit.configure({ link: false, code: false, codeBlock: false, blockquote: false, strike: false, horizontalRule: false, heading: { levels: [1, 2, 3] } }),
    Table.configure({ resizable: false }),
    TableRow, TableHeader, TableCell,
  ],
  editorProps: { attributes: { class: 'doc-body', 'aria-label': 'Isi dokumen', role: 'textbox', 'aria-multiline': 'true' } },
  onUpdate: ({ editor: e }) => emit('update:modelValue', e.getJSON() as Record<string, unknown>),
})

watch(() => props.editable, v => editor.value?.setEditable(v))
onBeforeUnmount(() => editor.value?.destroy())

interface Btn { title: string, icon: Component, text?: string, danger?: boolean, run: () => void, active?: () => boolean, disabled?: () => boolean }
const groups = computed<Btn[][]>(() => {
  const e = editor.value
  if (!e) return []
  const c = () => e.chain().focus()
  const inTable = e.isActive('table')
  return [
    [
      { title: 'Judul bagian', icon: Heading2, run: () => c().toggleHeading({ level: 2 }).run(), active: () => e.isActive('heading', { level: 2 }) },
      { title: 'Subjudul', icon: Heading3, run: () => c().toggleHeading({ level: 3 }).run(), active: () => e.isActive('heading', { level: 3 }) },
      { title: 'Paragraf biasa', icon: Pilcrow, run: () => c().setParagraph().run(), active: () => e.isActive('paragraph') },
    ],
    [
      { title: 'Tebal', icon: Bold, run: () => c().toggleBold().run(), active: () => e.isActive('bold') },
      { title: 'Miring', icon: Italic, run: () => c().toggleItalic().run(), active: () => e.isActive('italic') },
      { title: 'Garis bawah', icon: Underline, run: () => c().toggleUnderline().run(), active: () => e.isActive('underline') },
    ],
    [
      { title: 'Daftar poin', icon: List, run: () => c().toggleBulletList().run(), active: () => e.isActive('bulletList') },
      { title: 'Daftar bernomor', icon: ListOrdered, run: () => c().toggleOrderedList().run(), active: () => e.isActive('orderedList') },
      { title: 'Sisipkan tabel 3×3', icon: TableIcon, run: () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), disabled: () => inTable },
    ],
    // Perintah tabel hanya muncul saat kursor berada di dalam tabel.
    ...(inTable
      ? [[
          { title: 'Tambah baris di bawah', icon: BetweenVerticalEnd, text: 'Baris', run: () => c().addRowAfter().run() },
          { title: 'Tambah kolom di kanan', icon: BetweenHorizontalEnd, text: 'Kolom', run: () => c().addColumnAfter().run() },
          { title: 'Hapus baris', icon: Trash2, text: 'Baris', danger: true, run: () => c().deleteRow().run() },
          { title: 'Hapus kolom', icon: Trash2, text: 'Kolom', danger: true, run: () => c().deleteColumn().run() },
          { title: 'Hapus seluruh tabel', icon: Trash2, text: 'Tabel', danger: true, run: () => c().deleteTable().run() },
        ]]
      : []),
    [
      { title: 'Urungkan', icon: Undo2, run: () => c().undo().run(), disabled: () => !e.can().undo() },
      { title: 'Ulangi', icon: Redo2, run: () => c().redo().run(), disabled: () => !e.can().redo() },
    ],
  ]
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Toolbar di luar dokumen -->
    <div v-if="editable && editor" role="toolbar" aria-label="Format dokumen" class="sticky top-[76px] z-20 mx-auto w-full max-w-[820px] flex flex-wrap items-center gap-x-1 gap-y-1.5 rounded-xl border border-line-2 bg-white shadow-sm px-2 py-1.5">
      <template v-for="(g, gi) in groups" :key="gi">
        <span v-if="gi > 0" class="w-px h-6 bg-line-2 mx-1" aria-hidden="true" />
        <button
          v-for="b in g" :key="b.title" type="button" :title="b.title" :aria-label="b.title" :aria-pressed="b.active ? b.active() : undefined" :disabled="b.disabled?.()"
          class="min-h-9 min-w-9 px-2 rounded-lg inline-flex items-center justify-center gap-1 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          :class="b.active?.() ? 'bg-brand-50 text-brand-700' : b.danger ? 'text-danger-700 hover:bg-danger-50' : 'text-ink-2 hover:bg-soft-2'"
          @mousedown.prevent @click="b.run()"
        >
          <component :is="b.icon" :size="17" :stroke-width="2" aria-hidden="true" />
          <span v-if="b.text">{{ b.text }}</span>
        </button>
      </template>
      <button
        type="button" class="ml-auto min-h-9 px-3 rounded-lg inline-flex items-center justify-center gap-1.5 text-xs font-semibold disabled:cursor-not-allowed"
        :class="dirty ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-soft-2 text-muted'" :disabled="!dirty || saving" title="Simpan (Ctrl+S)" aria-label="Simpan dokumen" @mousedown.prevent @click="emit('save')"
      >
        <Save :size="17" :stroke-width="2" aria-hidden="true" />
        <span>{{ saving ? 'Menyimpan…' : dirty ? 'Simpan' : 'Tersimpan' }}</span>
      </button>
    </div>

    <!-- Kertas dokumen -->
    <article class="card mx-auto w-full max-w-[820px] p-5 sm:p-10 flex flex-col gap-5 shadow-sm bg-white" :aria-label="label">
      <slot name="header" />
      <EditorContent :editor="editor" />
      <slot name="footer" />
    </article>
  </div>
</template>

<style>
.doc-body { outline: none; font-size: 13px; line-height: 1.6; min-height: 320px; }
.doc-body > * + * { margin-top: 0.5rem; }
.doc-body p { margin: 0; min-height: 1.2em; }
.doc-body h1 { font-size: 1.15rem; font-weight: 700; text-align: center; margin: 0 0 0.5rem; }
.doc-body h2 { font-size: 1rem; font-weight: 700; margin: 1.1rem 0 0.35rem; }
.doc-body h3 { font-size: 0.9rem; font-weight: 700; margin: 0.9rem 0 0.3rem; }
.doc-body ul { list-style: disc; padding-left: 1.4rem; margin: 0; }
.doc-body ol { list-style: decimal; padding-left: 1.4rem; margin: 0; }
.doc-body li > p { margin: 0; }
.doc-body table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 0.4rem 0; }
.doc-body th, .doc-body td { border-bottom: 1px solid var(--color-line-2, #E4E7EC); padding: 6px 8px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
.doc-body th { background: #F9FAFB; color: #475467; font-size: 11px; font-weight: 700; }
.doc-body .selectedCell { background: #E6F4F1; }
.doc-body[contenteditable="true"]:focus-visible { outline: 2px solid var(--color-brand-600, #0B6E63); outline-offset: 6px; border-radius: 4px; }
</style>
