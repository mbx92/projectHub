# Panduan Template Dokumen (Penpot → SVG)

Dokumen yang dicetak sistem (invoice, kuitansi, kontrak, dst.) bisa memakai desain dari Penpot.
Desainer membuat artboard di Penpot, mengekspornya sebagai **SVG**, lalu admin mengunggahnya di
**Pengaturan → Template Dokumen**. Sistem mengisi datanya otomatis. Tanpa template, layout bawaan dipakai.

Spesifikasi lengkap: `docs/superpowers/specs/2026-11-23-penpot-document-templates-design.md`.

## Aturan umum

- **Ukuran artboard: A4 = 595 × 842** (px Penpot = pt PDF). Ukuran lain ditolak saat unggah.
- Ekspor: pilih artboard → **Export → SVG** (satu file per artboard). Maks. 2 MB.
- **Font: Plus Jakarta Sans** (bobot 400, 600, 700, 800). Font lain diganti 400 dan memunculkan peringatan.
- Hindari simbol di luar huruf Latin umum (mis. ✓ ◷ →): font yang dibundel tidak memuatnya. Tanda `—`, `·`, `…`, `−` aman.
- Logo atau tanda tangan **SVG** tidak ditampilkan di template (hanya PNG/JPG). Unggah logo PNG di Profil Usaha.

## Penanda

Tulis penanda sebagai teks di Penpot. **Satu penanda per baris teks**, jangan dipecah dengan gaya berbeda
di tengah penanda (mis. menebalkan sebagian `{{total}}`).

| Penanda | Arti |
|---|---|
| `{{kunci}}` | Diganti nilai dari sistem. Kunci tak dikenal dikosongkan (ada peringatan saat unggah). |
| `{{?kunci}}` | Sama, tapi bila nilainya kosong, **board Penpot terkecil** yang memuat teks ini disembunyikan. Contoh: board "Baris diskon" berisi label "Diskon" dan `{{?diskon}}`. |
| `{{item.*}}` | **Baris berulang** (invoice). Board yang memuat semua `{{item.*}}` adalah baris contoh; digandakan per item ke bawah. |
| `{{isi}}` | Dokumen proyek: kotak teks penanda area isi. Teks dari editor mengalir di dalamnya, lintas halaman. |
| `{{logo}}` `{{ttd}}` `{{qris}}` | Kotak teks yang diganti gambar (logo usaha, tanda tangan, QRIS) seukuran kotaknya. |
| `{{halaman}}` | "Hal. 1 dari 2". Letakkan di footer. |

### Kunci yang tersedia

**Umum:** `usaha.nama`, `usaha.alamat`, `usaha.kontak`, `usaha.npwp`, `penandatangan.nama`, `penandatangan.jabatan`, `tanggal_cetak`, `halaman`.

**Invoice:** `nomor`, `status`, `terbit`, `jatuh_tempo`, `klien.nama`, `klien.kontak`, `klien.alamat`, `proyek.nama`,
`termin.nama`, `subtotal`, `diskon`, `pajak`, `pajak_persen`, `total`, `dibayar`, `sisa`, `bank.nama`, `bank.nomor`,
`bank.atas_nama`, `catatan`, `catatan_kaki`; baris: `item.no`, `item.deskripsi`, `item.qty`, `item.harga`, `item.jumlah`.
`diskon`, `pajak`, `dibayar` kosong bila 0 sehingga cocok dipakai dengan `{{?…}}`.

**Kuitansi:** `nomor`, `invoice.nomor`, `klien.nama`, `nominal`, `terbilang`, `untuk`, `tanggal`, `metode`, `status_invoice`, `tempat_tanggal`.

**Dokumen proyek:** `judul`, `nomor`, `proyek.nama`, `klien.nama`, `tanggal`, `footer`.

## Perataan dan lebar teks

- Sistem menyimpulkan **perataan** dari posisi teks di dalam kotaknya: teks yang menempel ke tepi kanan kotak diperlakukan
  rata kanan (cocok untuk nominal), yang di tengah rata tengah. Beri kotak lebar tetap untuk kolom angka dan
  atur perataan teks di Penpot.
- **Teks auto-width tidak dibungkus** (Penpot mengepaskan kotak persis selebar penanda). Untuk isian yang bisa panjang
  (alamat, catatan, deskripsi item), ubah kotak menjadi **lebar tetap** dan **tinggi tetap** sesuai ruang yang tersedia:
  teks dibungkus ke baris berikutnya selama tinggi kotak muat, lalu diakhiri "…".
- Angka rata kanan yang melebihi kotak diperkecil sampai 80% ukuran asli; lebih dari itu ada peringatan di log.
- Tinggi tiap baris item = tinggi board baris contoh. Deskripsi item satu baris (dipotong "…") kecuali baris dibuat lebih tinggi.

## Invoice

Unggah **dua artboard**:

1. `halaman-1`: kop, tagihan, tabel, baris contoh, blok bawah (total, pembayaran, tanda tangan), footer.
2. `halaman-lanjutan`: dipakai bila item tidak muat di halaman 1. Juga memiliki baris contoh, **blok bawah**
   (karena bisa menjadi halaman terakhir), dan footer.

Aturan penataan:

- Satu board **baris contoh** berisi semua `{{item.*}}`. Semua elemen di bawahnya (blok bawah) bergeser turun mengikuti
  jumlah baris. Footer (yang memuat `{{halaman}}`) tidak ikut bergeser.
- Buat board **blok bawah serapat mungkin**: tinggi blok dihitung dari tepi bawah baris contoh sampai tepi bawah
  elemen non-footer terbawah.
- Jarak dari baris contoh ke footer harus cukup untuk minimal satu baris; kalau tidak, unggahan ditolak.
- Blok total memakai board terpisah per baris opsional (`{{?diskon}}`, `{{?pajak}}`); sisa baris tidak menutup celah,
  jadi susun urutannya agar celah kosong tetap rapi.
- Halaman bukan terakhir tidak menampilkan blok bawah; halaman terakhir menampilkannya.

## Kuitansi

Satu artboard `halaman-1`, wajib memuat `{{nomor}}` dan `{{nominal}}`.

## Dokumen proyek (Kontrak, Spesifikasi, Laporan UAT, BAST)

Satu bingkai dipakai bersama keempat jenis. Isi ditulis di editor dokumen dan mengalir di kotak `{{isi}}`.

- `halaman-1` wajib; `halaman-lanjutan` opsional (kosong = memakai `halaman-1`).
- Kotak `{{isi}}` pada kedua halaman harus **berukuran dan berposisi sama** (selisih maks. 1 px).
- Blok tanda tangan dua pihak tetap dibuat sistem di akhir isi.
- Judul dokumen: `{{judul}}` bisa dipasang di kop; atau biarkan judul berasal dari isi.

## Alur kerja

1. Desain/ubah artboard di Penpot sesuai panduan ini.
2. Ekspor tiap artboard ke SVG.
3. Pengaturan → Template Dokumen → **Unggah SVG** pada artboard yang sesuai. Unggahan masuk sebagai **draf**.
4. Perhatikan daftar error (merah) dan peringatan (kuning). Perbaiki di Penpot lalu unggah ulang bila perlu.
5. **Pratinjau draf** (memakai data terbaru, tanpa menyimpan apa pun; invoice dipratinjau dengan 12 item contoh).
6. **Aktifkan draf**. Dokumen baru memakai template ini. Invoice yang sudah dikirim, kuitansi yang sudah dicatat, dan
   dokumen Final **tetap memakai tampilan lama**. **Kembali ke bawaan** melepas template.
7. Bila render template gagal karena sebab apa pun, sistem otomatis memakai layout bawaan dan mencatat error di log server.
