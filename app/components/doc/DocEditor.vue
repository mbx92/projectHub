<script setup lang="ts">
/** Editor isi dokumen (TipTap): judul, tebal/miring/garis bawah, daftar, dan tabel. Hanya isi; kop & footer dipasang di luar. */
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'

const props = defineProps<{ modelValue: Record<string, unknown>, editable: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [Record<string, unknown>] }>()

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

interface Btn { label: string, title: string, run: () => void, active?: () => boolean, disabled?: () => boolean }
const groups = computed<Btn[][]>(() => {
  const e = editor.value
  if (!e) return []
  const c = () => e.chain().focus()
  return [
    [
      { label: 'Judul', title: 'Judul bagian', run: () => c().toggleHeading({ level: 2 }).run(), active: () => e.isActive('heading', { level: 2 }) },
      { label: 'Subjudul', title: 'Subjudul', run: () => c().toggleHeading({ level: 3 }).run(), active: () => e.isActive('heading', { level: 3 }) },
      { label: 'Teks', title: 'Paragraf biasa', run: () => c().setParagraph().run(), active: () => e.isActive('paragraph') },
    ],
    [
      { label: 'B', title: 'Tebal', run: () => c().toggleBold().run(), active: () => e.isActive('bold') },
      { label: 'I', title: 'Miring', run: () => c().toggleItalic().run(), active: () => e.isActive('italic') },
      { label: 'U', title: 'Garis bawah', run: () => c().toggleUnderline().run(), active: () => e.isActive('underline') },
    ],
    [
      { label: '• Daftar', title: 'Daftar poin', run: () => c().toggleBulletList().run(), active: () => e.isActive('bulletList') },
      { label: '1. Daftar', title: 'Daftar bernomor', run: () => c().toggleOrderedList().run(), active: () => e.isActive('orderedList') },
    ],
    [
      { label: '+ Tabel', title: 'Sisipkan tabel 3×3', run: () => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), disabled: () => e.isActive('table') },
      { label: '+ Baris', title: 'Tambah baris di bawah', run: () => c().addRowAfter().run(), disabled: () => !e.isActive('table') },
      { label: '+ Kolom', title: 'Tambah kolom di kanan', run: () => c().addColumnAfter().run(), disabled: () => !e.isActive('table') },
      { label: '− Baris', title: 'Hapus baris', run: () => c().deleteRow().run(), disabled: () => !e.isActive('table') },
      { label: '− Kolom', title: 'Hapus kolom', run: () => c().deleteColumn().run(), disabled: () => !e.isActive('table') },
      { label: 'Hapus tabel', title: 'Hapus seluruh tabel', run: () => c().deleteTable().run(), disabled: () => !e.isActive('table') },
    ],
    [
      { label: '↶', title: 'Urungkan', run: () => c().undo().run(), disabled: () => !e.can().undo() },
      { label: '↷', title: 'Ulangi', run: () => c().redo().run(), disabled: () => !e.can().redo() },
    ],
  ]
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="editable && editor" role="toolbar" aria-label="Format dokumen" class="flex flex-wrap gap-x-3 gap-y-2 rounded-xl border border-line-2 bg-soft p-2 sticky top-2 z-10">
      <div v-for="(g, gi) in groups" :key="gi" class="flex flex-wrap gap-1">
        <button
          v-for="b in g" :key="b.label" type="button" :title="b.title" :aria-label="b.title" :aria-pressed="b.active ? b.active() : undefined" :disabled="b.disabled?.()"
          class="min-h-9 min-w-9 px-2.5 rounded-lg border text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          :class="b.active?.() ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line-2 bg-white text-ink-2 hover:bg-soft-2'"
          @mousedown.prevent @click="b.run()"
        >{{ b.label }}</button>
      </div>
    </div>
    <EditorContent :editor="editor" />
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
