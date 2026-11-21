# PRD — OCN Project Hub

Nov 21, 2026 · @pande

OCN Project Hub adalah aplikasi web internal OCN Development untuk mengganti file Excel per proyek: satu tempat untuk proyek, termin dan invoice klien, pengeluaran, bug, serta laporan modal dan bagi hasil untuk investor. Rilis pertama (MVP) menargetkan semua proyek berjalan sudah tercatat di aplikasi sebelum investor pertama mulai memakai dashboard.

## Ringkasan & latar belakang

Saat ini setiap proyek dicatat di file Excel terpisah (contoh: pencatatan BUMDes, tracker POS Resto). Akibatnya status termin, pengeluaran, dan pembagian hasil tersebar dan sulit dicek ulang.

OCN akan menerima modal dari investor untuk kas operasional proyek, supaya biaya proyek tidak lagi memakai uang pribadi. Investor butuh laporan yang transparan: modal yang disetor, pemakaiannya, dan bagi hasil yang diterima.

Mockup UI 13 layar sudah selesai dan menjadi acuan PRD ini: [OCN Project Hub — Mockup UI](https://claude.ai/artifact/41ohgjMwRzoZW29YobeHMS). Versi HTML-nya tersimpan di `G:\onDev\project-hub`, dan komponen Nuxt awal (UiDateTimeInput, UiSelect, UiSearchSelect, UiConfirmDialog) sudah ada.

## Tujuan & metrik keberhasilan

Tujuannya satu sumber data untuk semua proyek, sehingga tidak ada lagi pencatatan ganda di Excel.

| Tujuan | Ukuran keberhasilan | Target |
| --- | --- | --- |
| Semua proyek berjalan tercatat di aplikasi | Proyek aktif yang datanya hanya ada di Excel | 0 proyek, 2 minggu setelah MVP |
| Tagihan tidak terlewat | Termin yang lewat jatuh tempo tanpa pengingat | 0 |
| Investor bisa memantau sendiri | Laporan bulanan investor dibuat dari aplikasi, tanpa olah manual | Setiap tanggal 1 |
| Bagi hasil bisa dihitung ulang | Setiap distribusi punya rincian laba, skema, dan pembagiannya | 100% distribusi |
| Bug klien tertangani | Bug kritis yang terbuka lebih dari 7 hari | 0 |

Angka target di atas adalah usulan awal dan bisa disesuaikan.

## Pengguna & peran

Ada tiga peran yang login. Klien tidak login di MVP; mereka menerima invoice dan pengingat lewat email atau WhatsApp.

| Peran | Siapa | Proyek | Keuangan | Bug | Investor & modal |
| --- | --- | --- | --- | --- | --- |
| Admin (Pendiri) | Pande, Angga | Kelola semua | Kelola semua | Kelola semua | Kelola |
| Investor | Pemodal OCN | Lihat ringkasan proyek yang didanai | Lihat modal, arus kas, laporan | — | Hanya data sendiri |
| Developer | Freelancer | Hanya proyek yang ditugaskan | — | Kelola bug yang ditugaskan | — |

Login memakai satu form email dan kata sandi. Setelah masuk, sistem mengarahkan pengguna sesuai perannya: Investor ke Dashboard Investor, Admin dan Developer ke daftar Proyek. Akun dibuat lewat undangan dari Admin.

## Ruang lingkup

MVP mencakup semua yang dibutuhkan untuk berhenti memakai Excel dan memberi akses investor. Otomasi pengiriman pesan dan integrasi pihak ketiga masuk fase berikutnya.

**MVP (fase 1)**

- Login, undangan pengguna, tiga peran dan hak aksesnya
- Proyek: tambah, edit, arsip, hapus; termin, tim, milestone
- Pembayaran: termin, buat invoice (PDF), catat pembayaran masuk, pengeluaran, mutasi kas OCN
- Bug tracker per proyek: kanban, detail, komentar, lampiran
- Investor & modal: setoran modal, porsi modal, distribusi bagi hasil
- Skema bagi hasil per proyek dari template
- Dashboard Investor dan Laporan (laba rugi per proyek, ekspor PDF/Excel)
- Pengaturan: profil usaha, rekening, metode bayar, notifikasi di aplikasi dan email

**Fase 2**

- Pengingat termin otomatis lewat WhatsApp dan Telegram
- Simpan dokumen proyek ke Google Drive
- API key dan webhook
- Ringkasan harian

**Di luar cakupan**

- Portal login untuk klien
- Pembayaran online (payment gateway) di invoice
- Akuntansi lengkap (jurnal umum, neraca) dan pelaporan pajak
- Penggajian freelancer

## Kebutuhan fungsional

Setiap modul di bawah sesuai dengan layar di mockup. Kriteria penerimaan ditulis sebagai hal yang harus bisa dicek saat uji.

### Autentikasi & akun

- Satu form login (email + kata sandi), "Ingat saya", lupa kata sandi lewat email.
- Admin mengundang pengguna dengan peran; undangan berlaku 7 hari.
- Top bar di semua halaman: pencarian global (Ctrl K), tombol "+ Buat" (Admin), notifikasi, menu akun.
- **Diterima jika:** investor yang login langsung diarahkan ke Dashboard Investor dan tidak bisa membuka halaman Pengaturan atau proyek yang tidak didanainya.

### Proyek

- Daftar proyek dengan filter status (Semua, Berjalan, Tertunda, Selesai), pencarian, dan panel termin jatuh tempo.
- Form Tambah/Edit: info dasar, klien (pilih atau tambah baru), nilai kontrak, termin (persen → nominal otomatis), tim dan cara bayarnya, skema bagi hasil, milestone.
- Detail proyek dengan 6 tab: Ringkasan, Pembayaran, Pengeluaran, Bug, Tim & Bagi Hasil, Dokumen.
- Arsipkan proyek, atau hapus permanen setelah mengetik nama proyek.
- **Diterima jika:** proyek tidak bisa disimpan bila total persen termin bukan 100%; termin yang sudah ditagih tidak bisa diubah nominalnya.

### Pembayaran & invoice

- Setiap termin punya status: Terjadwal, Draf invoice, Terkirim, Lunas, Terlambat.
- Buat invoice dari proyek + termin: item terisi otomatis, bisa tambah item, diskon, pajak (%), catatan, rekening tujuan, QRIS. Pratinjau langsung dan unduh PDF.
- Nomor invoice otomatis sesuai format di Pengaturan (contoh INV-2026-017).
- Catat pembayaran masuk (nominal, tanggal, metode, bukti) → termin jadi Lunas dan kuitansi bisa dikirim.
- Pengeluaran per proyek dengan kategori, sumber dana (Kas OCN), dan bukti. Pembelian aset dicatat terpisah dan tidak mengurangi laba proyek.
- Halaman Pembayaran gabungan: tab Invoice & Termin, Pengeluaran, Mutasi Kas OCN; umur piutang.
- **Diterima jika:** total invoice = subtotal − diskon + pajak, dibulatkan ke rupiah; termin lunas tidak bisa ditagih ulang.

### Bug tracker

- Papan kanban per proyek: Open, Dikerjakan, Review, Selesai; filter keparahan (Kritis, Tinggi, Sedang, Rendah).
- Detail bug: deskripsi, langkah reproduksi, seharusnya vs kenyataan, lampiran, penanggung jawab, target selesai, aktivitas dan komentar.
- Bug bisa ditandai "menghambat termin" agar tampil sebagai peringatan di tab Pembayaran proyek.
- **Diterima jika:** Developer hanya melihat bug di proyek tempat ia ditugaskan.

### Investor, modal & bagi hasil

- Daftar investor: modal disetor, porsi modal, bagi hasil diterima; status Aktif atau Calon.
- Catat setoran modal (tanggal, nominal, peruntukan, bukti).
- Template skema di Pengaturan: Didanai investor (Modal 40% · Pekerja 40% · Kas 20%), Pendiri 50:50, Proyek solo (Pekerja 80% · Kas 20%). Persentase bisa diubah per template dan per proyek.
- Distribusi bagi hasil per proyek: laba bersih × persentase skema; bagian modal dibagi lagi sesuai porsi modal tiap investor.
- **Diterima jika:** setiap distribusi menyimpan angka laba, skema, dan rincian pembagian pada saat itu, sehingga tidak berubah bila skema diubah kemudian.

### Dashboard Investor & Laporan

- Dashboard: modal ditanam, nilai kontrak aktif, kas operasional tersisa, bagi hasil diterima; grafik arus kas bulanan; penggunaan modal; proyek yang didanai; riwayat distribusi.
- Laporan: laba rugi per proyek (basis kas), pengeluaran per kategori, laporan investor bulanan, rekap piutang, rekap bug. Ekspor PDF dan Excel.
- **Diterima jika:** angka di dashboard, halaman Pembayaran, dan Laporan untuk periode yang sama selalu sama.

### Pengaturan

- Profil usaha (logo, nama, NPWP, kontak, alamat, zona waktu, format nomor invoice).
- Skema bagi hasil, pengguna & hak akses, rekening & metode bayar, notifikasi, integrasi (fase 2).

## Alur utama

&#91;embedded content: alur uang · dari termin sampai distribusi\]

Pengeluaran dibayar dari kas OCN selama proyek berjalan; laba bersih baru dihitung dan dibagi setelah pelunasan diterima.

**Alur bug:** klien atau tim melapor → bug masuk kolom Open → Admin menugaskan developer → Dikerjakan → Review oleh Admin → Selesai, pelapor mendapat notifikasi. Bug kritis yang ditandai "menghambat termin" tampil sebagai peringatan di tab Pembayaran sampai selesai.

## Model data

Semua uang disimpan sebagai bilangan bulat rupiah (tanpa desimal), dan semua tabel punya `created_at`, `updated_at`, dan `created_by`.

| Entitas | Kolom utama | Relasi |
| --- | --- | --- |
| users | nama, email, password\_hash, peran (admin/investor/developer), status | — |
| clients | nama, kontak, WhatsApp, email | punya banyak projects |
| projects | nama, deskripsi, stack, status, nilai\_kontrak, anggaran, mulai, target\_selesai, pj\_id, skema\_id, diarsipkan | milik client; punya terms, members, milestones, expenses, bugs, documents |
| project\_members | project\_id, user\_id, peran\_di\_proyek, cara\_bayar (bagi\_hasil/tetap) | users ↔ projects |
| milestones | project\_id, nama, target, status, urutan | milik project |
| terms | project\_id, nama, persen, nominal, syarat, jatuh\_tempo, status | milik project; punya invoices |
| invoices | nomor, term\_id, terbit, jatuh\_tempo, diskon, pajak\_persen, total, catatan, rekening\_id, status | punya invoice\_items, payments |
| invoice\_items | invoice\_id, deskripsi, qty, harga | milik invoice |
| payments | invoice\_id, nominal, tanggal, metode, bukti\_url | masuk ke cash\_ledger |
| expenses | project\_id (boleh kosong), tanggal, keterangan, kategori, nominal, sumber, adalah\_aset, bukti\_url | keluar dari cash\_ledger |
| cash\_ledger | tanggal, jenis (masuk/keluar), nominal, ref\_type, ref\_id, saldo | dari payments, expenses, capital\_deposits, distributions |
| investors | user\_id, status (aktif/calon) | punya capital\_deposits |
| capital\_deposits | investor\_id, tanggal, nominal, peruntukan, bukti\_url | — |
| profit\_schemes | nama, persen\_modal, persen\_pekerja, persen\_kas, label\_bagian | dipakai projects |
| distributions | project\_id, tanggal, laba\_bersih, snapshot\_skema (JSON) | punya distribution\_lines |
| distribution\_lines | distribution\_id, penerima (user), bagian (modal/pekerja/kas), nominal | — |
| bugs | kode (BUG-041), project\_id, judul, deskripsi, langkah, modul, keparahan, status, assignee\_id, pelapor, target, menghambat\_termin | punya bug\_comments, attachments |
| bug\_comments | bug\_id, user\_id, isi | — |
| documents | project\_id, nama, jenis, status, file\_url | — |
| notifications, audit\_logs | user\_id, jenis, isi, dibaca / aksi, entitas, sebelum, sesudah | — |
| settings | kunci, nilai (profil usaha, format invoice, zona waktu) | — |

## Kebutuhan non-fungsional

- **Hak akses di server:** setiap endpoint API memeriksa peran dan keanggotaan proyek; menyembunyikan menu di UI saja tidak cukup.
- **Keamanan:** kata sandi di-hash (argon2 atau bcrypt), sesi berbasis cookie httpOnly, rate limit login, HTTPS wajib. File bukti dan dokumen disimpan privat dan diakses lewat URL bertanda tangan.
- **Jejak audit:** perubahan pada termin, pembayaran, pengeluaran, skema, dan distribusi dicatat (siapa, kapan, nilai sebelum dan sesudah).
- **Format lokal:** Rupiah dengan titik ribuan (Rp 15.000.000), tanggal Indonesia (30 Nov 2026), jam dengan titik (14.30), zona waktu WITA (Asia/Makassar), minggu mulai Senin.
- **Aksesibilitas:** semua kontrol bisa dipakai dengan keyboard, target sentuh minimal 44 px, kontras teks minimal 4,5:1, atribut ARIA untuk dropdown, kalender, dan dialog (sudah ada di komponen Nuxt).
- **Responsif:** semua halaman bisa dipakai di layar HP; tabel lebar bisa digeser.
- **Kinerja:** halaman daftar tampil kurang dari 2 detik untuk 100 proyek dan 1.000 transaksi.
- **Cadangan:** backup database harian, disimpan minimal 30 hari.

## Arsitektur & stack

Satu repo Nuxt menangani halaman dan API sekaligus, sehingga tidak ada server terpisah yang harus dipelihara di MVP.

&#91;embedded content: arsitektur · 3 lapis\]

| Lapisan | Pilihan | Catatan |
| --- | --- | --- |
| Frontend | Nuxt 4 + TypeScript, Tailwind CSS 4 (`@theme` token OCN), font Plus Jakarta Sans | Komponen Ui\* dari mockup sudah siap dipakai |
| Backend | Nuxt server routes (Nitro) di `server/api` | Middleware cek sesi + peran di setiap route |
| Database | PostgreSQL + Drizzle ORM | Skema ditulis di TypeScript; migrasi dengan drizzle-kit |
| File | Folder privat di server atau penyimpanan S3-compatible | Diakses lewat URL bertanda tangan |
| PDF | Dibuat di server dari template HTML | Invoice, kuitansi, laporan |
| Email | SMTP | Undangan, invoice, pengingat |
| Deploy | Belum diputuskan (lihat pertanyaan terbuka) | Backup database harian |

**Struktur folder awal**

```
app/
  assets/css/main.css      token warna (@theme)
  components/ui/           UiDateTimeInput, UiSelect, UiSearchSelect, UiConfirmDialog
  components/layout/       Sidebar, Topbar
  composables/             useConfirm, useClickOutside, useAuth
  pages/                   login, index (dashboard), projects/, payments/, invoices/, bugs/, investors/, reports/, settings/
  middleware/              auth.global, role
server/
  api/                     projects, terms, invoices, payments, expenses, bugs, investors, distributions, reports
  middleware/              session
  utils/                   permissions, money, pdf
server/database/          schema.ts (Drizzle) + migrasi drizzle-kit
drizzle.config.ts
tsconfig.json             strict
```

## Rencana rilis

MVP dibangun dalam empat tahap berurutan; tanggal tiap tahap belum ditentukan.

&#91;embedded content: rencana rilis · 4 tahap MVP + fase 2\]

Setelah tahap 2, proyek berjalan (BUMDes, POS Resto, LMS, dan lainnya) dipindahkan dari Excel lalu dicek bersama Angga. Investor baru diberi akses setelah tahap 4 selesai dan angka di dashboard cocok dengan catatan lama.

**Langkah pertama minggu ini**

- [ ] Putuskan hosting
- [ ] Buat repo Nuxt 4 + TypeScript + Tailwind 4, pasang Drizzle ORM + drizzle-kit, salin komponen `app/components/ui` dan token `main.css`
- [ ] Tulis skema Drizzle (server/database/schema.ts) dari tabel Model data, lalu migrasi pertama
- [ ] Buat login + undangan + middleware peran

## Risiko & pertanyaan terbuka

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Skema bagi hasil dengan investor belum disepakati | Angka di dashboard investor bisa berubah | Simpan skema sebagai template yang bisa diubah; setiap distribusi menyimpan salinan skema saat itu |
| Data lama di Excel tidak lengkap | Saldo kas dan laba awal tidak cocok | Impor dengan saldo awal per proyek, lalu dicek bersama Angga sebelum investor diberi akses |
| Dikerjakan paruh waktu oleh tim kecil | Jadwal mundur | MVP dipotong per modul; fase 2 tidak menghalangi rilis |
| Data keuangan bocor | Kepercayaan investor hilang | Hak akses di server, audit log, backup harian |

**Pertanyaan terbuka**

- [ ] Berapa persentase final skema bagi hasil untuk proyek yang didanai investor?
- [ ] Apakah Angga resmi menjadi pemodal, dan sejak tanggal berapa porsi modalnya dihitung?
- [ ] Hosting: server sendiri (Coolify) atau layanan cloud?
- [ ] Apakah invoice perlu mencantumkan PPN, dan dengan tarif berapa?
- [ ] Apakah klien perlu bisa melaporkan bug sendiri (form publik) di fase 2?
