# Template Dokumen dari Penpot — Desain

Tanggal: 23 Nov 2026 · Status: draf, menunggu persetujuan

## 1. Maksud & alasan

Dokumen yang dicetak sistem (invoice, kuitansi, kontrak, dst.) saat ini tampilannya ditulis langsung di kode
(pdfmake, `server/utils/pdf.ts`, `server/utils/docPdf.ts`). Mengubah tampilan berarti mengubah kode.

Yang diinginkan: **tampilan dokumen didesain di Penpot**, diekspor, lalu **ditanam di sistem**. Saat sistem
membuat dokumen, ia memakai layout hasil Penpot itu dan **mengisi datanya otomatis** dari database.
Desain bisa diperbarui kapan saja tanpa mengubah kode: ekspor ulang, unggah ulang.

## 2. Sasaran, bukan sasaran, anti-sasaran

**Sasaran**
- Invoice dan Kuitansi: layout penuh dari Penpot (kop, blok tagihan, tabel item, total, pembayaran, tanda tangan, footer).
- Kontrak, Spesifikasi, Laporan UAT, BAST: **bingkai halaman** dari Penpot (kop, footer, ornamen, area isi);
  isi teks panjang tetap dari editor di aplikasi dan mengalir di area isi, lintas halaman.
- Template diunggah di **Pengaturan → Template Dokumen**, dengan validasi dan pratinjau memakai data nyata.
- Dokumen yang sudah dikirim/final **tidak berubah tampilannya** bila template diganti belakangan.

**Bukan sasaran (sekarang)**
- Ekspor DOCX tetap memakai layout yang ada (Word tidak bisa memakai SVG sebagai bingkai secara wajar).
- Bukti tanda tangan dan ekspor Laporan (buku kas, investor, bug) tetap seperti sekarang.
- Sistem membaca Penpot langsung lewat API saat runtime — tidak; sumbernya selalu file SVG yang diunggah.
- Editor desain di dalam aplikasi.

**Anti-sasaran (gagal walau "jalan")**
- Invoice gagal dibuat/dikirim karena template bermasalah. Setiap kegagalan render template **wajib jatuh
  kembali** ke layout bawaan dan dicatat di log.
- Teks dipadatkan/terpotong diam-diam sehingga nominal atau nama klien salah baca.
- Invoice lama yang sudah dikirim berubah tampilan setelah template baru diunggah.

## 3. Batasan yang diketahui (hasil uji coba 23 Nov)

Uji coba (scratchpad `spike-invoice/`, buang-pakai) membuktikan alur SVG Penpot → isi → PDF via pdfmake
(`svg-to-pdfkit` bawaan pdfmake 0.2.23) menghasilkan tampilan yang sama dengan desain, termasuk penggandaan
baris item dan penggeseran bagian bawah. Temuan yang membentuk desain ini:

| Temuan | Konsekuensi |
|---|---|
| Teks diekspor sebagai `<text>` asli; penanda `{{x}}` utuh | Penanda bisa diganti langsung. |
| Setiap teks diberi `textLength` + `lengthAdjust` | Wajib dihapus, kalau tidak isi yang lebih panjang dipadatkan. |
| Perataan (kanan/tengah) tidak tersimpan; hanya `x` awal + kotak `text-container` | Perataan disimpulkan dari posisi teks di dalam kotaknya (lihat §5.3). |
| Teks multi-baris dipecah per baris oleh Penpot | Penanda harus berada di teks satu baris; pembungkusan dilakukan sistem. |
| Nama layer Penpot **tidak** ikut ke SVG (hanya `id` acak) | Penandaan khusus memakai isi teks (penanda), bukan nama layer. |
| Font dirujuk lewat URL `@font-face` (woff2) | Font harus dibundel sebagai TTF di server; pdfkit tidak bisa woff2/URL. |
| `fontCallback` pdfmake hanya menerima tebal ya/tidak | Bobot 800 vs 700 dibedakan dengan memetakan ke keluarga font berbeda (§5.6). |

## 4. Pendekatan yang dipertimbangkan

1. **SVG Penpot diisi sistem (DIPILIH).** Desain diekspor SVG, diunggah, sistem mengganti penanda, menggandakan
   baris, lalu menggambar SVG ke PDF lewat pdfmake yang sudah dipakai. Kelebihan: desain benar-benar berasal dari
   Penpot, ganti desain tanpa kode, tanpa dependensi server baru. Kekurangan: perlu aturan penandaan, teks tidak
   membungkus sendiri, perlu bundel font.
2. **Penpot sebagai acuan visual, layout ditulis ulang di pdfmake.** Paling sederhana dan stabil, tapi setiap
   perubahan desain butuh perubahan kode — bertentangan dengan keinginan "ditanam di sistem".
3. **HTML dari Penpot + render Chrome (Puppeteer).** Paling akurat (CSS penuh, pembungkusan teks otomatis), tapi
   menambah Chromium di container produksi (berat, ±300 MB, rawan) dan Penpot `generateMarkup` tidak selalu
   menghasilkan HTML yang siap cetak. Disimpan sebagai rencana cadangan bila batasan pendekatan 1 tidak tertangani.

Pemilik produk memilih pendekatan 1 setelah uji coba.

## 5. Desain

### 5.1 Jenis template & isi paket unggahan

| Jenis | Mode | Artboard yang diunggah |
|---|---|---|
| `invoice` | layout penuh | `halaman-1` (wajib), `halaman-lanjutan` (wajib) |
| `kuitansi` | layout penuh | `halaman-1` (wajib) |
| `dokumen` (Kontrak, Spesifikasi, UAT, BAST) | bingkai | `halaman-1` (wajib), `halaman-lanjutan` (opsional; bila kosong, `halaman-1` dipakai ulang) |

Satu template `dokumen` dipakai keempat jenis dokumen proyek; judul dokumen masuk lewat penanda `{{judul}}`.
Setiap artboard berukuran A4 **595 × 842** (satuan Penpot px = pt PDF). Ukuran lain ditolak saat unggah.

### 5.2 Format penanda (ditulis di teks Penpot)

- `{{kunci}}` — diganti nilai. Kunci tak dikenal → kosong + peringatan saat validasi.
- `{{?kunci}}` — bila nilai kosong/nol, **sembunyikan board Penpot terkecil** yang memuat teks ini
  (contoh: board "Baris diskon" berisi label "Diskon" dan `{{?diskon}}` hilang bila tidak ada diskon).
- Baris berulang: board yang memuat penanda `{{item.*}}` adalah **baris contoh**. Sistem menggandakannya per item
  ke bawah sejauh tinggi board itu, dan menggeser semua elemen di bawahnya sejauh tambahan tinggi. Elemen yang memuat
  `{{halaman}}` (footer) tidak ikut bergeser. Satu baris berulang per artboard.
- `{{isi}}` (khusus `dokumen`) — kotak teks ini menandai **area isi**; sistem menghapusnya dan memakai batas
  kotaknya sebagai margin aliran teks pdfmake.
- `{{logo}}`, `{{ttd}}`, `{{qris}}` — kotak teks ini diganti gambar (logo usaha, tanda tangan, QRIS dari
  Pengaturan), diskalakan pas ke kotaknya. Bila gambar tidak ada, kotak dikosongkan.

Daftar kunci per jenis (sumber data = `loadInvoice` / data dokumen yang sudah ada):

- **Umum:** `usaha.nama`, `usaha.alamat`, `usaha.kontak`, `usaha.npwp`, `penandatangan.nama`,
  `penandatangan.jabatan`, `halaman` ("Hal. 1 dari 2"), `tanggal_cetak`.
- **invoice:** `nomor`, `status`, `terbit`, `jatuh_tempo`, `klien.nama`, `klien.kontak`, `klien.alamat`,
  `proyek.nama`, `termin.nama`, `subtotal`, `diskon`, `pajak`, `pajak_persen`, `total`, `dibayar`, `sisa`,
  `bank.nama`, `bank.nomor`, `bank.atas_nama`, `catatan`, `catatan_kaki`; baris: `item.no`, `item.deskripsi`,
  `item.qty`, `item.harga`, `item.jumlah`.
- **kuitansi:** `nomor` (KW-…), `invoice.nomor`, `klien.nama`, `nominal`, `terbilang`, `untuk`, `tanggal`,
  `metode`, `status_invoice`, `tempat_tanggal`.
- **dokumen:** `judul`, `nomor`, `proyek.nama`, `klien.nama`, `tanggal`, `footer` (footer dari Pengaturan, variabel terisi).

Format nilai mengikuti util yang ada (`rupiah`, `dateId`, `dateLongId`, `terbilang`).

### 5.3 Mesin template (`server/utils/svgTemplate.ts`, fungsi murni)

Masukan: teks SVG, nilai, daftar item (opsional), peta gambar. Keluaran: SVG siap gambar per halaman.
Langkah:
1. Parse SVG (`xmldoc`, sudah terpasang sebagai dependensi pdfmake — jadikan dependensi langsung).
2. Bersihkan: hapus `<style>` `@font-face`, pola `<defs><pattern>` tak terpakai.
3. Untuk setiap `<text>`: tentukan perataan dari kotak `text-container` induknya —
   jarak kiri > 1,5 dan jarak kanan < 1,5 → kanan (`text-anchor="end"`, `x` = tepi kanan kotak); jarak kiri ≈ kanan
   (selisih < 1,5) → tengah; selain itu kiri. Hapus `textLength`/`lengthAdjust`.
4. Baris berulang: board `shape-*` terkecil yang memuat **semua** penanda `{{item.*}}`; tinggi baris = tinggi
   `rect` latar board itu. Gandakan dengan `translate(0, i·tinggi)`; bungkus saudara-saudaranya yang berada di bawah
   baris (bukan footer) dengan `translate(0, tambahan)`.
5. Isi penanda. Bila teks hasil lebih lebar dari kotaknya: **bungkus** ke baris berikutnya (ukur dengan metrik
   font pdfkit) selama tinggi kotak masih muat; baris terakhir yang tidak muat diakhiri "…". Tidak pernah
   dipadatkan. Untuk kolom angka (rata kanan) tidak dibungkus — bila tidak muat, ukuran huruf diperkecil maksimal
   ke 80%, lalu peringatan di log.
6. `{{?kunci}}` kosong → hapus board terkecil yang memuatnya.
7. Gambar (`{{logo}}` dst.) → ganti dengan `<image>` data-URL seukuran kotak.

### 5.4 Halaman

- **invoice:** per artboard, `atasBaris` = tepi atas baris contoh, `tinggiBaris` = tinggi baris contoh,
  `atasFooter` = tepi atas elemen yang memuat `{{halaman}}`, `tinggiBawah` = jarak dari tepi bawah baris contoh
  sampai tepi bawah elemen terbawah non-footer (total, pembayaran, tanda tangan).
  - Kapasitas halaman **terakhir** = ⌊(atasFooter − tinggiBawah − atasBaris) / tinggiBaris⌋.
  - Kapasitas halaman **bukan terakhir** = ⌊(atasFooter − atasBaris) / tinggiBaris⌋; elemen bagian bawah dihapus.
  - Isi `halaman-1` dulu, sisanya ke `halaman-lanjutan` (diulang sebanyak perlu). Bila semua item muat di
    halaman 1 bersama bagian bawah → satu halaman. Bila tidak, halaman 1 diisi penuh tanpa bagian bawah, dst.
  - Kapasitas < 1 pada salah satu artboard → validasi unggah menolak template.
- **kuitansi:** selalu satu halaman.
- **dokumen:** pdfmake mengalirkan isi editor (fungsi `blocks()` yang ada) dengan `pageMargins` = batas kotak
  `{{isi}}`; SVG halaman dipasang sebagai `background(page)` — `halaman-1` untuk halaman 1, `halaman-lanjutan`
  untuk berikutnya; `{{halaman}}` diisi per halaman. Blok tanda tangan dua pihak tetap dibuat pdfmake di akhir isi.

### 5.5 Penyimpanan, versi, dan pembekuan

- File SVG disimpan lewat `saveFile('templates', …)` (lokal/S3 sesuai konfigurasi). File lama **tidak dihapus**.
- Pengaturan baru `docTemplates` (di tabel `settings`):
  `{ invoice?: Tpl, kuitansi?: Tpl, dokumen?: Tpl }`, `Tpl = { version: number, pages: { 'halaman-1': key, 'halaman-lanjutan'?: key }, uploadedAt, uploadedBy }`.
- Pembekuan:
  - **Invoice:** kolom baru `invoices.template_ref` (jsonb, nullable) diisi `Tpl` aktif saat invoice pertama kali
    berstatus *terkirim*. Draf selalu memakai template aktif. Null = layout bawaan.
  - **Kuitansi:** kolom baru `payments.template_ref` diisi saat pembayaran dicatat.
  - **Dokumen final:** `layoutSnapshot` yang sudah ada ditambah `template` (Tpl aktif saat difinalkan).
- Tanpa template aktif → layout bawaan (kode sekarang), tanpa perubahan perilaku.

### 5.6 Font

- Bundel Plus Jakarta Sans (OFL) TTF bobot 400, 600, 700, 800 di `server/assets/fonts/` beserta lisensinya.
- Daftarkan di `renderPdf` sebagai keluarga terpisah per bobot (mis. `PJS-400`, `PJS-700`, `PJS-800`); mesin
  template menulis ulang `font-family`+`font-weight` di SVG ke keluarga tersebut sebelum digambar.
- Font lain yang dipakai desain tapi tidak dibundel → peringatan saat validasi, jatuh ke Plus Jakarta Sans 400.
- Layout bawaan (pdfmake) tetap Roboto agar perilaku lama tidak berubah.

### 5.7 Pengaturan → Template Dokumen (admin, akses `pengaturan: kelola`)

- Satu kartu per jenis (Invoice, Kuitansi, Dokumen proyek): status (bawaan / versi N, tanggal), tombol
  **Unggah SVG** per artboard, **Pratinjau**, **Aktifkan**, **Kembali ke bawaan**.
- Unggah → server **membersihkan** SVG (hapus `<script>`, `<foreignObject>`, atribut `on*`, dan `href`/`xlink:href`
  yang menunjuk ke luar — hanya `#id` dan `data:` yang dibiarkan; maks 2 MB) lalu memvalidasi: SVG valid, ukuran 595×842, penanda wajib ada (invoice: `nomor`, `total`,
  `item.deskripsi`, `item.jumlah`; kuitansi: `nomor`, `nominal`; dokumen: `isi`), penanda tak dikenal, font tak
  tersedia. Error memblokir; peringatan ditampilkan tapi boleh lanjut.
- **Pratinjau** merender PDF dengan data nyata terbaru (invoice/pembayaran/dokumen terakhir) — tanpa menyimpan apa pun —
  dan dengan 12 item contoh untuk menguji halaman lanjutan.
- Template baru tersimpan sebagai **draf** sampai diaktifkan.
- Endpoint: `POST /api/settings/templates/:jenis` (unggah+validasi), `GET …/:jenis/preview`,
  `POST …/:jenis/activate`, `POST …/:jenis/reset`.

### 5.8 Titik sambung di kode

- `invoicePdf(data)` → bila ada `template_ref` (atau template aktif untuk draf) render via mesin template,
  selain itu kode lama. Dibungkus `try/catch` → fallback ke kode lama + `console.error` (anti-sasaran §2).
- `receiptPdf(data, paymentId)` → sama, memakai `payments.template_ref`.
- `docToPdf(content, ctx)` → `ctx` membawa `template` (dari snapshot atau aktif); bila ada, pakai bingkai SVG.
- Pengiriman email invoice/kuitansi otomatis ikut karena memanggil fungsi yang sama.

### 5.9 Di sisi Penpot

- Halaman Penpot **"Template Dokumen"** berisi artboard: Invoice — Halaman 1, Invoice — Lanjutan, Kuitansi,
  Dokumen — Halaman 1, Dokumen — Lanjutan, plus board **"Panduan penanda"** (daftar kunci §5.2 dan aturan).
- Ekspor: pilih artboard → Export → SVG. Satu file per artboard.
- Panduan singkat untuk desainer di `docs/template-dokumen.md` (cara memberi penanda, baris berulang, `{{?}}`,
  kotak isi, ukuran A4, font).

### 5.10 Pengujian

- Tambah Vitest untuk mesin template (fungsi murni): perataan, penggantian, penghapusan `textLength`, baris
  berulang + geser, `{{?}}`, pembungkusan + elipsis, pembagian halaman, gambar. Fixture = SVG ekspor Penpot asli.
- Uji manual: unggah template contoh, pratinjau, kirim invoice ke email uji, bandingkan berdampingan dengan Penpot.

## 6. Keputusan yang diambil pembuat desain (boleh dikoreksi)

- Satu template bingkai untuk keempat dokumen proyek (bukan per jenis).
- Invoice wajib mengunggah halaman lanjutan (bukan opsional) agar invoice panjang selalu benar.
- Pembekuan lewat kolom `template_ref` baru di `invoices` dan `payments` (butuh migrasi).
- Kolom angka mengecil maksimal 80% alih-alih membungkus.
- DOCX, bukti tanda tangan, dan laporan tidak termasuk tahap ini.

## 7. Yang diserahkan ke pembangun

Struktur file internal mesin template, cara mengukur teks (pdfkit `widthOfString` dengan font terdaftar),
detail UI kartu Pengaturan mengikuti komponen yang ada (`UiModal`, `UiFilePreview`), urutan migrasi.
