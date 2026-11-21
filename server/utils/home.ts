/** Halaman awal sesuai peran & matriks hak akses: Investor ke Dashboard Investor, lainnya ke daftar Proyek. */
export async function homeFor(role: Role) {
  return homePathFor(role, accessFor(role, await getAccessMatrix()))
}
