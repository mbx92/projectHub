# OCN Project Hub

Aplikasi web internal OCN Development pengganti file Excel per proyek: proyek, termin & invoice klien, pengeluaran, kas OCN, bug tracker, serta modal & bagi hasil investor. Dibangun sesuai [PRD](docs/PRD.md) dan mockup UI di [docs/mockup](docs/mockup/index.html).

**Stack:** Nuxt 4 + TypeScript (strict) · Tailwind CSS 4 (token OCN di `app/assets/css/main.css`) · Nitro server routes · PostgreSQL + Drizzle ORM · pdfmake (PDF) · ExcelJS (Excel) · Nodemailer (SMTP).

## Menjalankan

```bash
npm install
cp .env.example .env          # isi DATABASE_URL, secret, SMTP
npm run db:migrate            # buat tabel (drizzle migrations)
npm run db:seed               # admin pertama + template skema + pengaturan default
npm run dev                   # http://localhost:3000
```

Login pertama memakai `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` dari `.env` — **ganti kata sandi** lewat menu akun (Akun & notifikasi) setelah masuk. Pengguna lain dibuat lewat undangan (Pengaturan › Pengguna atau Investor & Modal › Undang Investor); undangan berlaku 7 hari.

Bila `NUXT_SMTP_HOST` kosong, email (undangan, reset kata sandi, invoice, kuitansi, pengingat) **dicetak ke log server** — berguna saat pengembangan. Isi SMTP untuk produksi.

Produksi: `npm run build` lalu `node .output/server/index.mjs` di belakang reverse proxy HTTPS (wajib: cookie sesi `secure` di produksi). Set `NUXT_APP_URL` ke domain asli (dipakai di tautan email).

## Struktur

```
app/
  assets/css/main.css      token warna (@theme) + kelas komponen
  components/ui/           UiDateTimeInput, UiSelect, UiSearchSelect, UiConfirmDialog, UiModal, UiMoneyInput, …
  components/layout/       Sidebar, Topbar (Ctrl K, + Buat, notifikasi, menu akun)
  components/{project,finance,bug}/  ProjectForm, InvoiceForm, PaymentModal, ExpenseModal, BugModal
  composables/             useAuth, useConfirm, useClickOutside, useToast, useUpload
  middleware/              auth.global (wajib login + arah per peran), role
  pages/                   login, invite, reset-password, index (Dashboard Investor), projects/, payments/,
                           invoices/, bugs/, investors/, reports/, settings/, account
server/
  api/                     auth, users, clients, projects, invoices, payments, expenses, ledger, bugs,
                           investors, capital-deposits, distributions, schemes, reports, settings, files, search
  middleware/session.ts    memuat sesi dari cookie httpOnly
  utils/                   auth, permissions, finance (satu sumber angka), pdf, ledger, reminders, audit, …
  database/                schema.ts (Drizzle) + migrations/ + seed.ts
shared/utils/              format Rupiah/tanggal WITA, perhitungan uang, label status (dipakai app & server)
scripts/backup-db.sh       backup harian pg_dump + file privat, retensi 30 hari
```

## Aturan bisnis yang ditegakkan di server

- **Matriks hak akses yang bisa diatur** (Pengaturan › Pengguna & Hak Akses, khusus admin; definisi di `shared/utils/access.ts`): tiap peran punya level per modul (Proyek, Tim & Dokumen, Keuangan, Bug, Investor & Modal, Dashboard & Laporan, Pengaturan) plus cakupan proyek (semua / yang ditugaskan / yang didanai). Admin selalu penuh; nilai default = PRD (Developer: proyek & bug yang ditugaskan, tanpa keuangan; Investor: proyek yang didanai, ringkasan keuangan, data modal sendiri). Setiap endpoint memeriksa matriks lewat `requireAccess()` / `can()` dan cakupan lewat `server/utils/permissions.ts`; mengelola pengguna & matriks tetap khusus admin.
- Proyek tidak bisa disimpan bila total persen termin ≠ 100%; termin yang sudah ditagih tidak bisa diubah nominalnya / dihapus.
- Total invoice = subtotal − diskon + pajak (pajak dari subtotal − diskon), dibulatkan ke rupiah. Nomor otomatis sesuai format di Pengaturan (mis. `INV-2026-017`).
- Termin lunas / yang sudah punya invoice aktif tidak bisa ditagih ulang. Pembayaran ≥ total → invoice & termin Lunas; pembayaran masuk ke mutasi kas OCN.
- Pengeluaran aset dicatat terpisah dan tidak mengurangi laba proyek.
- Distribusi: laba bersih × persentase skema proyek; bagian modal dibagi sesuai porsi modal investor aktif; **snapshot** laba, skema, dan rincian disimpan sehingga tidak berubah bila skema diubah.
- Laporan keuangan basis kas (`server/utils/accounting.ts`): Laba Rugi, Neraca, Arus Kas, Perubahan Ekuitas, dan Buku Kas, masing-masing di tab sendiri dan bisa diekspor PDF/Excel. Aset dicatat sebagai aset tetap (tanpa penyusutan), pengeluaran pribadi sebagai kontribusi pemilik, distribusi bagi hasil mengurangi laba ditahan — sehingga Neraca selalu seimbang dan saldo akhir arus kas = mutasi kas OCN (ditampilkan sebagai cek di tiap laporan).
- Dashboard, halaman Pembayaran, dan Laporan memakai fungsi yang sama di `server/utils/finance.ts` sehingga angkanya selalu sama untuk periode yang sama.
- Jejak audit untuk termin, invoice, pembayaran, pengeluaran, skema, setoran modal, dan distribusi (`audit_logs`, nilai sebelum & sesudah).
- Kata sandi bcrypt, sesi cookie httpOnly (opsi "Ingat saya" 30 hari), rate limit login, file bukti/dokumen privat lewat URL bertanda tangan (HMAC, 15 menit).
- Pengingat otomatis (server plugin, tiap jam): H-7, hari H, dan terlambat untuk invoice terkirim (notifikasi admin + email klien); termin jatuh tempo yang belum ditagih; laporan investor bulanan tiap tanggal 1.

## Data demo

```bash
npm run db:seed:demo               # tambah 5 proyek demo lengkap (dilewati bila sudah ada)
npm run db:seed:demo -- --reset    # hapus HANYA data demo yang dibuat seeder
npm run db:seed:demo -- --fresh    # hapus lalu buat ulang
```

Isinya: 5 proyek (BUMDes, POS Resto, Klinik Pratama, Absensi Desa, Website Company Profile) dengan klien, termin, invoice, pembayaran, pengeluaran & aset, milestone, tim, dokumen (tanpa berkas), 12 bug, 2 investor (satu aktif dengan setoran modal), 2 developer, dan satu distribusi bagi hasil; semua konsisten sehingga Neraca seimbang. Tanggal dihitung relatif terhadap hari ini. Seeder hanya menambah data, mencatat ID baris yang dibuatnya di `settings.demo_seed`, dan `--reset` hanya menghapus ID tersebut (data asli aman). Jalankan `npm run db:seed` lebih dulu. Akun demo memakai kata sandi `SEED_DEMO_PASSWORD` — **hapus data demo sebelum dipakai di produksi**.

## Impor data Excel (gerbang tahap 2)

1. Buat proyek berjalan lewat **+ Proyek Baru** (klien, nilai kontrak, termin, tim, skema).
2. Termin yang sudah dibayar: **Catat Pembayaran** dengan tanggal aslinya (invoice dibuat otomatis).
3. Pengeluaran lama: **Pembayaran › Catat Pengeluaran** dengan tanggal aslinya.
4. Saldo kas awal yang tidak berasal dari transaksi di atas: **Pembayaran › Mutasi Kas OCN › + Saldo awal**.
5. Cocokkan angka di Laporan dengan catatan lama bersama Angga sebelum investor diberi akses.

## Fase 2 (belum dibangun)

WhatsApp & Telegram, Google Drive, API key & webhook, ringkasan harian — tampil sebagai "Fase 2" di Pengaturan › Integrasi.

## Deploy di Coolify

Repo ini siap deploy lewat `Dockerfile` atau `docker-compose.yml` (hanya aplikasi; PostgreSQL memakai server yang sudah ada).

1. Coolify → New Resource → pilih repo ini, build pack **Docker Compose** (atau **Dockerfile**). Database memakai server PostgreSQL yang sudah ada, tidak ada container database.
2. Isi environment variable (lihat `.env.example`): `DATABASE_URL` (server DB yang sama), `NUXT_SESSION_SECRET`, `NUXT_FILE_SECRET`, `NUXT_APP_URL` (URL domain https), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, serta SMTP bila perlu.
3. Pasang domain pada service `app` (port 4044). Health check: `/api/health`.
4. Saat start, container otomatis menjalankan migrasi dan seed dasar (idempotent), lalu server. File unggahan tersimpan di volume `/data/storage`; cadangkan volume ini beserta database.

### Penyimpanan file di MinIO / S3 (opsional)

Secara bawaan upload disimpan di volume `/data/storage`. Untuk memakai bucket MinIO, isi lima variabel ini di Coolify (semuanya harus terisi, selain region):

| Variabel | Contoh |
|---|---|
| `NUXT_S3_ENDPOINT` | `https://minio.contoh.id` (atau alamat internal) |
| `NUXT_S3_BUCKET` | `projecthub` (dibuat otomatis bila kredensial mengizinkan) |
| `NUXT_S3_ACCESS_KEY` / `NUXT_S3_SECRET_KEY` | kunci akses khusus bucket ini |
| `NUXT_S3_REGION` | `us-east-1` (bawaan) |

File tetap privat: diunduh lewat tautan bertanda tangan aplikasi, bucket tidak perlu publik. Memindahkan file yang sudah ada di volume ke bucket (aman diulang, file lokal tidak dihapus): `npx tsx server/database/upload-files-to-s3.ts` di terminal container (tambah `--dry` untuk uji coba). Selama masa peralihan, file yang belum dipindah tetap dibaca dari volume.
