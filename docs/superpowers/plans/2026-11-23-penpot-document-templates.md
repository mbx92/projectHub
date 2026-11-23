# Template Dokumen dari Penpot — Rencana Implementasi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invoice dan kuitansi dirender dari SVG ekspor Penpot (layout penuh), dan dokumen proyek (Kontrak, Spesifikasi, UAT, BAST) memakai bingkai SVG Penpot, dengan data diisi sistem, dikelola di Pengaturan, dengan fallback ke layout bawaan.

**Architecture:** Mesin template murni (`server/utils/svgTemplate/`) mem-parse SVG Penpot, membersihkan, mengisi penanda, menggandakan baris, membagi halaman, dan membungkus teks. Hasilnya digambar ke PDF oleh pdfmake (`svg-to-pdfkit` bawaannya) dengan font Plus Jakarta Sans yang dibundel. Template disimpan sebagai file + pengaturan `docTemplates`, dan dibekukan per invoice/pembayaran/dokumen final.

**Tech Stack:** Nuxt 4 / Nitro, TypeScript strict, pdfmake 0.2.23, xmldoc, Drizzle (PostgreSQL), Vitest (baru), Vue 3 + Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-11-23-penpot-document-templates-design.md`

## Global Constraints

- Artboard A4 **595 × 842**; selain ukuran itu ditolak.
- Penanda: `{{kunci}}`, `{{?kunci}}` (sembunyikan board terkecil bila kosong), `{{item.*}}` (baris berulang), `{{isi}}` (area isi dokumen), `{{logo}}` `{{ttd}}` `{{qris}}` (gambar), `{{halaman}}` (footer; tidak ikut bergeser).
- Perataan: jarak kiri > 1,5 dan kanan < 1,5 → kanan; |kiri − kanan| < 1,5 → tengah; selain itu kiri.
- Teks tidak pernah dipadatkan: `textLength`/`lengthAdjust` selalu dihapus.
- Kolom rata kanan yang tidak muat diperkecil maksimal ke **80%**; teks lain dibungkus, baris terakhir yang tak muat diakhiri "…".
- Setiap kegagalan render template → **fallback ke layout bawaan** + `console.error`, tidak pernah menggagalkan pembuatan/pengiriman.
- Unggahan maks **2 MB**; hapus `<script>`, `<foreignObject>`, atribut `on*`, dan `href`/`xlink:href` selain `#…` dan `data:`.
- Font: Plus Jakarta Sans (OFL) bobot 400/600/700/800 dibundel; layout bawaan tetap Roboto.
- **Database `10.50.30.42/projecthub` adalah produksi.** Jangan menjalankan migrasi atau aksi yang menulis (unggah/aktifkan template) ke sana tanpa izin eksplisit pengguna di chat. Uji manual memakai DB lokal bila tersedia; pratinjau hanya membaca.
- Bahasa UI dan pesan error: Bahasa Indonesia, gaya yang sama dengan aplikasi.

## Review Focus

1. **Penanda terpecah gaya di Penpot** (mis. sebagian `{{total}}` ditebalkan → Penpot memecahnya jadi beberapa `<tspan>`/`<text>`). Harapan: penanda tetap terganti, atau validasi melaporkan "penanda terpecah" alih-alih mencetak `{{to` + `tal}}`. → test `merges split placeholder spans` di Task 1.
2. **Nilai berisi karakter XML** (`&`, `<`, mis. klien "CV Maju & Jaya"). Harapan: tercetak apa adanya, SVG tetap valid. → test `escapes xml characters in values` di Task 1.
3. **Invoice tanpa item / ratusan item.** Harapan: 0 item → baris contoh dihapus, total tetap tampil; 120 item → halaman lanjutan berulang, total hanya di halaman terakhir. → test `handles zero items` dan `paginates 120 items` di Task 2.
4. **Template lama tanpa halaman lanjutan atau tanpa `{{halaman}}`.** Harapan: validasi menolak dengan pesan jelas, bukan crash saat invoice dikirim. → test `rejects invoice template without continuation page` di Task 6.
5. **File gambar (logo/ttd) hilang dari penyimpanan.** Harapan: kotak dikosongkan, PDF tetap terbuat. → test `blanks image box when image missing` di Task 1.

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `server/utils/svgTemplate/xml.ts` | Parse/serialize xmldoc, telusur pohon, peta induk, util kotak/teks |
| `server/utils/svgTemplate/sanitize.ts` | Pembersihan keamanan + buang `@font-face`/pattern |
| `server/utils/svgTemplate/text.ts` | Perataan, pengisian penanda, `{{?}}`, gambar, pemetaan font, bungkus/perkecil |
| `server/utils/svgTemplate/repeat.ts` | Deteksi baris contoh, kapasitas, penggandaan, geser, pembagian halaman |
| `server/utils/svgTemplate/index.ts` | API publik: `sanitizeSvg`, `placeholdersIn`, `fillSinglePage`, `renderTemplatePages`, `rowInfo`, `capacity`, tipe |
| `server/utils/templatePdf.ts` | Font PJS, `pdfMeasure`, `svgPagesToPdf`, `framedDocPdf` |
| `server/utils/templateData.ts` | Nilai penanda dari data invoice/pembayaran/dokumen |
| `server/utils/docTemplates.ts` | Simpan/ambil/aktifkan/validasi template (setting + file) |
| `server/api/settings/templates/[kind]/*.ts` | Endpoint unggah, pratinjau, aktifkan, reset |
| `app/components/settings/DocTemplates.vue` | Kartu Pengaturan → Template Dokumen |
| `server/assets/fonts/PlusJakartaSans-*.ttf` + `OFL.txt` | Font dibundel |
| `tests/svgTemplate/*.test.ts`, `tests/fixtures/*.svg` | Uji mesin template |
| `docs/template-dokumen.md` | Panduan desainer |

---

### Task 1: Vitest + mesin template satu halaman (bersihkan, ratakan, isi, sembunyikan, gambar)

**Files:**
- Create: `vitest.config.ts`, `server/utils/svgTemplate/{xml,sanitize,text,index}.ts`, `tests/svgTemplate/text.test.ts`, `tests/fixtures/invoice-p1.svg`
- Modify: `package.json` (devDependency `vitest`, dependency `xmldoc` + `@types/xmldoc` dev, script `"test": "vitest run"`)

**Interfaces:**
- Produces:
  - `type Measure = (text: string, family: string, size: number) => number`
  - `interface FillInput { values: Record<string, string>; items?: Record<string, string>[]; images?: Record<string, string | null>; measure: Measure }`
  - `class TemplateError extends Error { code: 'invalid_svg' | 'too_large' | 'bad_size' | 'missing_placeholder' | 'no_capacity' | 'content_box_mismatch' }`
  - `sanitizeSvg(svg: string): string` (lempar `TemplateError`)
  - `fillSinglePage(svg: string, input: FillInput): string` (tanpa baris berulang; dipakai Task 2 sebagai langkah akhir per halaman)
  - `placeholdersIn(svg: string): string[]` — kunci unik apa adanya, termasuk awalan, mis. `['nomor', '?diskon', 'item.qty']`

Fixture: salin SVG ekspor Penpot halaman "5 · Template Invoice" (artboard "Invoice A4") ke `tests/fixtures/invoice-p1.svg` — ekspor via plugin Penpot `shape.export({type:'svg'})` atau menu Export → SVG; jangan disunting tangan.

- [ ] **Step 1: Tulis test gagal** — `tests/svgTemplate/text.test.ts`, pakai `measure = (t, _f, s) => t.length * s * 0.5`:
  - `strips textLength and keeps right alignment`: isi `{{total}}` = `'Rp 7.200.000'` → `<text>` yang memuatnya punya `text-anchor="end"`, `x` = `x + width` kotak `text-container`-nya, tanpa atribut `textLength`.
  - `fills plain placeholders`: `{{klien.nama}}` → `'54DM Cafe'`; kunci tak dikenal → string kosong.
  - `escapes xml characters in values`: `klien.nama = 'CV Maju & Jaya <Bali>'` → hasil di-parse ulang dengan xmldoc tanpa error dan teks persis sama.
  - `merges split placeholder spans`: fixture kecil inline dengan `{{to` di satu `<tspan>` dan `tal}}` di berikutnya dalam satu `<text>` → terganti utuh.
  - `hides smallest board for empty ?placeholder`: SVG inline board berisi "Diskon" + `{{?diskon}}`, `diskon=''` → board itu hilang; `diskon='Rp 1'` → tetap ada dan teksnya `Rp 1`.
  - `replaces image box`: `{{logo}}` dengan `images.logo = 'data:image/png;base64,AAA'` → `<image href="data:…" x y width height>` seukuran kotak, teks hilang.
  - `blanks image box when image missing`: `images.logo = null` → teks hilang, tidak ada `<image>`.
  - `sanitizes`: `<script>`, `onload=`, `<foreignObject>`, `xlink:href="https://x"` hilang; `href="#a"` dan `data:` tetap; input > 2 MB → `TemplateError('too_large')`; bukan SVG → `invalid_svg`.
- [ ] **Step 2: Jalankan** `npx vitest run tests/svgTemplate/text.test.ts` → FAIL (modul belum ada).
- [ ] **Step 3: Implementasi** `xml.ts`, `sanitize.ts`, `text.ts`, `index.ts` sesuai Interfaces. Gabungkan isi `<tspan>` saudara dalam satu `<text>` sebelum mengganti; tulis teks lewat node teks xmldoc yang di-escape saat serialisasi. Buang `<style>` berisi `@font-face` dan `<defs><pattern>`.
- [ ] **Step 4: Jalankan** test → PASS; `npm run typecheck` bersih.
- [ ] **Step 5: Commit** `feat(templates): svg template engine — sanitize, align, fill`

### Task 2: Baris berulang & pembagian halaman

**Files:**
- Create: `server/utils/svgTemplate/repeat.ts`, `tests/svgTemplate/repeat.test.ts`, `tests/fixtures/invoice-next.svg` (ekspor artboard "Invoice — Lanjutan", dibuat di Task 9; sampai ada, test memakai `invoice-p1.svg` untuk kedua peran)
- Modify: `server/utils/svgTemplate/index.ts`

**Interfaces:**
- Consumes: `fillSinglePage`, `FillInput`, `TemplateError` (Task 1)
- Produces:
  - `interface RowInfo { top: number; height: number; bottomBlock: number; footerTop: number }`
  - `rowInfo(svg: string): RowInfo | null`
  - `capacity(info: RowInfo, isLast: boolean): number` — rumus spek §5.4: terakhir `⌊(footerTop − bottomBlock − top)/height⌋`, bukan terakhir `⌊(footerTop − top)/height⌋`
  - `renderTemplatePages(pages: { first: string; next?: string }, input: FillInput): string[]` — satu SVG per halaman; mengisi `{{halaman}}` = `Hal. i dari n`

- [ ] **Step 1: Test gagal:**
  - `repeats row per item and shifts block below`: 5 item → 5 salinan baris dengan `translate(0, k·28)`; elemen yang memuat `{{total}}` tergeser `4·28 = 112`; footer tidak bergeser.
  - `handles zero items`: baris contoh dihapus, bagian bawah naik `28`, `{{total}}` tetap ada.
  - `paginates 120 items`: hasil > 1 halaman; jumlah salinan baris total = 120; hanya halaman terakhir memuat teks total; setiap halaman memuat `Hal. i dari n` yang benar.
  - `throws no_capacity when row cannot fit`: SVG dengan footer di atas baris → `TemplateError('no_capacity')`.
- [ ] **Step 2:** `npx vitest run tests/svgTemplate/repeat.test.ts` → FAIL.
- [ ] **Step 3:** Implementasi. Baris contoh = `<g id="shape-*">` terdalam yang memuat **semua** teks `{{item.*}}`; tinggi = `rect` latar pertamanya. Elemen "bawah" = saudara baris (di induk yang sama) dengan tepi atas ≥ tepi bawah baris dan tidak memuat `{{halaman}}`. Halaman bukan terakhir: hapus elemen bawah. Isi tiap salinan dengan nilai item lalu panggil `fillSinglePage` untuk sisanya.
- [ ] **Step 4:** test → PASS.
- [ ] **Step 5: Commit** `feat(templates): repeating rows and pagination`

### Task 3: Bungkus teks, elipsis, perkecil angka, pemetaan font

**Files:**
- Modify: `server/utils/svgTemplate/text.ts`
- Create: `tests/svgTemplate/wrap.test.ts`

**Interfaces:**
- Produces: `fontKey(family: string, weight: number): 'PJS-400' | 'PJS-600' | 'PJS-700' | 'PJS-800'` (bobot dibulatkan ke terdekat; keluarga selain Plus Jakarta Sans → `PJS-400`), dipakai di `fillSinglePage` untuk menulis ulang `font-family` dan menghapus `font-weight` dari style.

- [ ] **Step 1: Test gagal** (measure palsu `t.length * size * 0.5`):
  - `wraps left text within box height`: kotak lebar 100, tinggi 30, ukuran 9, teks 60 karakter → beberapa `<tspan>`/baris; jumlah baris = ⌊30 / (9·1.25)⌋ = 2; baris kedua berakhir `…`.
  - `never adds textLength`: semua hasil tanpa `textLength`.
  - `shrinks right-aligned numbers down to 80%`: angka sedikit terlalu lebar → `font-size` lebih kecil, ≥ 0.8 × asal; jauh terlalu lebar → tepat 0.8 × asal dan `console.warn` dipanggil.
  - `maps fonts`: `font-family: "Plus Jakarta Sans"; font-weight: 800` → `font-family: PJS-800`; `Inter` 500 → `PJS-400`.
- [ ] **Step 2:** `npx vitest run tests/svgTemplate/wrap.test.ts` → FAIL.
- [ ] **Step 3:** Implementasi; tinggi baris = `size × 1.25`.
- [ ] **Step 4:** semua test `npm test` → PASS.
- [ ] **Step 5: Commit** `feat(templates): wrapping, ellipsis, numeric shrink, font mapping`

### Task 4: Font dibundel + render SVG ke PDF

**Files:**
- Create: `server/assets/fonts/PlusJakartaSans-{Regular,SemiBold,Bold,ExtraBold}.ttf`, `server/assets/fonts/OFL.txt`, `server/utils/templatePdf.ts`, `tests/svgTemplate/pdf.test.ts`
- Modify: `server/utils/pdf.ts:8-18` (daftarkan keluarga `PJS-400/600/700/800` di printer; Roboto tetap default), `nuxt.config.ts` (pastikan `server/assets` ikut bundel Nitro: `nitro.serverAssets` atau baca via `useStorage('assets:server')`)

Font diunduh dari repositori Google Fonts resmi (`github.com/google/fonts/tree/main/ofl/plusjakartasans`, file variable atau static TTF) — izin pengguna sudah diberikan 23 Nov. Bila hanya tersedia variable font, gunakan instance statis dari folder `static/`.

**Interfaces:**
- Consumes: `renderTemplatePages`, `Measure` (Task 1–3), `renderPdf` (pdf.ts)
- Produces:
  - `pdfMeasure: Measure` (pdfkit `widthOfString` dengan font PJS terdaftar; cache dokumen pdfkit)
  - `svgPagesToPdf(pages: string[], title: string): Promise<Buffer>` — satu halaman A4 per SVG, `pageMargins: 0`
  - `framedDocPdf(frames: { first: string; next?: string }, values: Record<string,string>, body: Content[], title: string): Promise<Buffer>` — dua lintasan: lintasan 1 menghitung jumlah halaman, lintasan 2 mengisi `{{halaman}}`; `pageMargins` dari kotak `{{isi}}` halaman 1; background per halaman memakai frame yang sudah diisi.

- [ ] **Step 1: Test gagal** `pdf.test.ts`: `svgPagesToPdf([p1,p2])` → Buffer diawali `%PDF`, jumlah `/Type /Page` = 2; `pdfMeasure('Rp 7.200.000','PJS-800',12)` > `pdfMeasure('Rp 7.200.000','PJS-400',12)`.
- [ ] **Step 2:** jalankan → FAIL.
- [ ] **Step 3:** Implementasi. Kotak `{{isi}}` dibaca dari `text-container` teksnya sebelum dihapus (`x, y, width, height` → margin `[x, y, 595 − x − width, 842 − y − height]`).
- [ ] **Step 4:** test → PASS; jalankan `node -e` kecil atau test untuk menulis `tmp/contoh.pdf` dari fixture lalu buka dan bandingkan visual dengan Penpot (font PJS terlihat, 800 lebih tebal dari 700).
- [ ] **Step 5: Commit** `feat(templates): bundle Plus Jakarta Sans and render svg pages to pdf`

### Task 5: Nilai penanda dari data sistem

**Files:**
- Create: `server/utils/templateData.ts`, `tests/svgTemplate/data.test.ts`
- Modify: `shared/utils/format.ts` (pindahkan `terbilang` dari `server/utils/pdf.ts`; `pdf.ts` mengimpor dari sana)

**Interfaces:**
- Consumes: `LoadedInvoice` (server/utils/invoices.ts), `BusinessProfile`, `InvoiceSettings`, `DocRenderCtx`
- Produces:
  - `invoiceValues(d: LoadedInvoice, b: BusinessProfile, s: InvoiceSettings): { values: Record<string,string>; items: Record<string,string>[] }`
  - `receiptValues(d: LoadedInvoice, paymentId: number, b: BusinessProfile): Record<string,string>`
  - `docFrameValues(ctx: DocRenderCtx, projectName: string): Record<string,string>`
  - Kunci persis seperti spek §5.2 (umum, invoice, kuitansi, dokumen). `diskon`/`pajak` = `''` bila 0 (agar `{{?…}}` bekerja). `nomor` kuitansi = `KW-${invoice.number tanpa awalan INV-}-${payment.id}` (sama dengan `receiptPdf` sekarang).

- [ ] **Step 1: Test gagal** dengan objek `LoadedInvoice` fixture: `total` = `rupiah(7200000)`, `item.jumlah` = `rupiah(qty*price)`, `item.no` = `'1'`, `diskon` = `''` bila 0, `terbilang` kuitansi = `terbilang(6000000) + ' rupiah'`, `usaha.kontak` = email dan WhatsApp digabung `' · '`, `halaman` tidak diisi di sini.
- [ ] **Step 2:** → FAIL. **Step 3:** implementasi. **Step 4:** `npm test` + `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(templates): placeholder values for invoice, receipt, project docs`

### Task 6: Penyimpanan, validasi, migrasi, endpoint Pengaturan

**Files:**
- Create: `server/utils/docTemplates.ts`, `server/api/settings/templates/[kind]/index.post.ts` (unggah), `…/preview.get.ts`, `…/activate.post.ts`, `…/reset.post.ts`, `server/api/settings/templates/index.get.ts`, `tests/svgTemplate/validate.test.ts`
- Modify: `shared/utils/settings.ts` (tipe + default `docTemplates: { active: {}, draft: {} }`), `server/database/schema.ts` (`invoices.templateRef` → kolom `template_ref` jsonb nullable; `payments.templateRef` sama), `DocLayoutSnapshot` tambah `template?: TemplateRef`, migrasi baru via `npm run db:generate` (→ `0006_*.sql`)

**Interfaces:**
- Produces:
  - `type TemplateKind = 'invoice' | 'kuitansi' | 'dokumen'`, `type PageKey = 'halaman-1' | 'halaman-lanjutan'`
  - `interface TemplateRef { version: number; pages: Partial<Record<PageKey, string>>; uploadedAt: string; uploadedBy: number }`
  - `validateTemplate(kind: TemplateKind, pages: Partial<Record<PageKey, string>>): { errors: string[]; warnings: string[] }` (murni)
  - `activeTemplate(kind): Promise<TemplateRef | null>`, `loadTemplatePages(ref: TemplateRef): Promise<{ first: string; next?: string }>`
- Aturan validasi (error): ukuran ≠ 595×842; penanda wajib hilang (invoice: `nomor`, `total`, `item.deskripsi`, `item.jumlah`, `halaman`; kuitansi: `nomor`, `nominal`; dokumen: `isi`); invoice tanpa `halaman-lanjutan`; kapasitas < 1; kotak `{{isi}}` halaman 1 vs lanjutan beda > 1 pt (`content_box_mismatch`). Peringatan: kunci tak dikenal, font selain Plus Jakarta Sans.
- Endpoint: semua `requireAccess(event, 'pengaturan', 'kelola')`. Unggah = multipart `page` (`halaman-1`|`halaman-lanjutan`) + `file` (.svg) → sanitasi, simpan `saveFile('templates', …)`, perbarui **draft** (versi = aktif.version + 1), kembalikan hasil validasi gabungan. Pratinjau = render draft (atau aktif bila `?aktif=1`) dengan invoice/pembayaran/dokumen terbaru + `?contoh=12` item tambahan, balas `application/pdf`, **tanpa menulis**. Aktifkan = tolak bila validasi ada error; pindahkan draft → active. Reset = hapus active (kembali ke bawaan). File lama tidak dihapus.

- [ ] **Step 1: Test gagal** `validate.test.ts`: `rejects invoice template without continuation page`, `rejects wrong size` (svg 600×800), `rejects missing total`, `warns unknown placeholder {{foo}}`, `warns non-PJS font`, `accepts fixture pair`.
- [ ] **Step 2:** → FAIL. **Step 3:** implementasi + `npm run db:generate`; periksa SQL hanya `ALTER TABLE … ADD COLUMN "template_ref" jsonb`. **Jangan** `db:migrate` ke DB produksi (Global Constraints).
- [ ] **Step 4:** `npm test`, `npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(templates): storage, validation, settings endpoints, template_ref columns`

### Task 7: Sambungkan ke invoice, kuitansi, dokumen + pembekuan

**Files:**
- Modify: `server/utils/pdf.ts` (`invoicePdf`, `receiptPdf`), `server/utils/docPdf.ts` (`docToPdf`), `server/utils/docLayout.ts` (`DocRenderCtx.template`, `liveLayout()` sertakan template aktif `dokumen`), `server/api/invoices/[id]/send.post.ts:13`, `server/api/payments/index.post.ts:42` dan insert pembayaran, `server/utils/autoInvoice.ts:9`

**Interfaces:**
- Consumes: semua di atas.
- Aturan: `invoicePdf` → ref = `invoice.templateRef ?? (status === 'draf' ? activeTemplate('invoice') : null)`. Ref ada → `svgPagesToPdf(renderTemplatePages(...))`; error apa pun → `console.error('[template] invoice', number, err)` lalu layout lama. `receiptPdf` sama dengan `payments.templateRef`. `docToPdf` → `ctx.template` ada → `framedDocPdf(...)` dengan `blocks(content)` + blok tanda tangan yang sama seperti sekarang; selain itu kode lama.
- Pembekuan: set `templateRef = await activeTemplate('invoice')` di ketiga tempat invoice menjadi `terkirim` (hanya bila masih null); set `payments.templateRef = await activeTemplate('kuitansi')` saat insert; `liveLayout()` membawa `template` sehingga snapshot final ikut membekukannya.

- [ ] **Step 1:** Tambah test di `pdf.test.ts`: `falls back to built-in layout when template throws` — panggil helper `renderWithFallback(primary, fallback)` (ekspor dari `templatePdf.ts`) dengan primary melempar → hasil = fallback, `console.error` terpanggil.
- [ ] **Step 2:** → FAIL. **Step 3:** implementasi `renderWithFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>, label: string): Promise<T>` dan sambungkan.
- [ ] **Step 4:** `npm test`, `npm run typecheck` → PASS. Verifikasi manual (DB lokal, atau DB produksi **hanya baca**): tanpa template aktif, `GET /api/invoices/:id/pdf` identik dengan sebelumnya.
- [ ] **Step 5: Commit** `feat(templates): render invoices, receipts and project docs from templates with fallback and freezing`

### Task 8: UI Pengaturan → Template Dokumen

**Files:**
- Create: `app/components/settings/DocTemplates.vue`
- Modify: `app/pages/settings/index.vue` (tambah bagian "Template Dokumen" di navigasi bagian pengaturan, hanya untuk `pengaturan: kelola`)

**Interfaces:** Consumes endpoint Task 6 (`GET /api/settings/templates` → `{ active, draft, validation }`).

Tiga kartu (Invoice, Kuitansi, Dokumen proyek). Isi kartu: status ("Bawaan" atau "Versi N · tanggal"), baris unggah per artboard (`halaman-1`, `halaman-lanjutan` bila berlaku) dengan nama file terakhir, daftar error (merah) dan peringatan (kuning), tombol **Pratinjau** (buka PDF di tab baru), **Aktifkan** (nonaktif bila ada error; konfirmasi `useConfirm`), **Kembali ke bawaan** (konfirmasi varian danger). Ikuti komponen yang ada (`card-pad`, `btn-*`, `UiBadge`, `useToast`).

- [ ] **Step 1:** Implementasi komponen dan bagian navigasi.
- [ ] **Step 2:** `npm run typecheck` bersih.
- [ ] **Step 3: Verifikasi di browser** (dev server): bagian tampil hanya untuk admin; unggah fixture memunculkan hasil validasi; Pratinjau membuka PDF. Unggah/aktifkan menulis ke DB → lakukan hanya di DB lokal atau setelah pengguna mengizinkan untuk DB produksi.
- [ ] **Step 4: Commit** `feat(templates): settings UI for document templates`

### Task 9: Template di Penpot + panduan desainer

**Files:**
- Create: `docs/template-dokumen.md`, `tests/fixtures/{invoice-next,kuitansi,dokumen-p1,dokumen-next}.svg`
- Penpot (file proposal, halaman baru **"Template Dokumen"**): pindahkan/duplikat "Invoice A4" dari halaman "5 · Template Invoice" menjadi "Invoice — Halaman 1"; buat "Invoice — Lanjutan" (kop ringkas + header tabel + baris contoh + footer), "Kuitansi", "Dokumen — Halaman 1", "Dokumen — Lanjutan" (kotak `{{isi}}` sama posisinya), dan board "Panduan penanda" (daftar kunci spek §5.2).

Perbaikan dari uji coba yang wajib masuk desain: `{{catatan}}` diberi kotak lebar tetap dan tinggi cukup agar tidak menabrak blok Total; baris Diskon/Pajak memakai `{{?diskon}}`/`{{?pajak}}` di board sendiri; kotak `{{logo}}` dan `{{ttd}}` menggantikan logo teks "OCN" dan ruang tanda tangan.

- [ ] **Step 1:** Bangun artboard di Penpot (lewat plugin MCP), ekspor SVG tiap artboard ke `tests/fixtures/`.
- [ ] **Step 2:** `npm test` (fixture baru dipakai Task 2 & 6) → PASS.
- [ ] **Step 3:** Render contoh tiap jenis dari fixture (skrip kecil atau endpoint pratinjau di DB lokal), bandingkan berdampingan dengan ekspor PNG Penpot; catat perbedaan di PR.
- [ ] **Step 4:** Tulis `docs/template-dokumen.md`: ukuran A4, cara ekspor, daftar penanda, aturan baris berulang/`{{?}}`/`{{isi}}`/gambar, batasan (penanda satu baris, font).
- [ ] **Step 5: Commit** `docs(templates): penpot templates and designer guide`
