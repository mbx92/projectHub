import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

const _notifEvents = [
  ('termin_jatuh_tempo', 'Termin akan jatuh tempo', 'H-7 dan hari H'),
  ('pembayaran_diterima', 'Pembayaran klien diterima', 'Saat termin dicatat lunas'),
  ('bug_kritis', 'Bug kritis dilaporkan', 'Semua proyek'),
  ('bug_ditugaskan', 'Bug ditugaskan ke saya', 'Termasuk perubahan status'),
  ('komentar_bug', 'Komentar baru di bug', 'Pada bug yang saya laporkan atau tangani'),
  ('distribusi', 'Distribusi bagi hasil', 'Saat dana dicairkan'),
  ('bug_baru', 'Bug baru dilaporkan', 'Bug non-kritis di semua proyek'),
  ('dokumen_baru', 'Dokumen proyek baru', 'Pada proyek yang saya ikuti'),
  ('status_proyek', 'Status proyek berubah', 'Pada proyek yang saya ikuti'),
  ('persetujuan_klien', 'Klien menandatangani persetujuan', 'Berita acara / persetujuan di proyek'),
  ('laporan_bulanan', 'Laporan investor bulanan', 'Setiap tanggal 1'),
];

/// Pengaturan: profil usaha, skema bagi hasil, pengguna, rekening & invoice, notifikasi, akun.
class SettingsScreen extends StatefulWidget {
  final Session session;
  final VoidCallback onLogout;
  const SettingsScreen({super.key, required this.session, required this.onLogout});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String sec = 'profile';
  Key k = UniqueKey();
  Session get s => widget.session;
  bool get canEdit => s.has('pengaturan', ['kelola']);
  void refresh() => setState(() => k = UniqueKey());

  List<(String, String, IconData)> get secs => [
        ('profile', 'Profil Usaha', Icons.business_outlined),
        ('skema', 'Skema Bagi Hasil', Icons.pie_chart_outline),
        if (s.isAdmin) ('users', 'Pengguna & Hak Akses', Icons.group_outlined),
        ('bank', 'Rekening & Invoice', Icons.account_balance_outlined),
        ('notif', 'Notifikasi', Icons.notifications_none),
        ('integrations', 'Integrasi', Icons.extension_outlined),
        ('account', 'Akun Saya', Icons.person_outline),
      ];

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const TopBar('Pengaturan'),
        body: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 250, child: ListView(padding: const EdgeInsets.all(12), children: [
            for (final e in secs) Padding(padding: const EdgeInsets.only(bottom: 4), child: ListTile(
              dense: true, selected: sec == e.$1, selectedTileColor: C.greenSoft, selectedColor: C.green,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              leading: Icon(e.$3, size: 20), title: Text(e.$2, style: const TextStyle(fontWeight: FontWeight.w600)),
              onTap: () => setState(() => sec = e.$1),
            )),
          ])),
          const VerticalDivider(width: 1),
          Expanded(child: Loader<Map<String, dynamic>>(
            key: ValueKey('$sec${k.hashCode}'),
            load: _load,
            builder: (c, d, _) => ListView(padding: const EdgeInsets.all(16), children: [
              Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 900), child: _section(d))),
            ]),
          )),
        ]),
      );

  Future<Map<String, dynamic>> _load() async {
    switch (sec) {
      case 'profile':
      case 'notif':
        return asMap(await Api.i.get('/api/settings'));
      case 'skema':
        return {'schemes': await Api.i.get('/api/schemes')};
      case 'users':
        return {'users': await Api.i.get('/api/users'), 'access': await Api.i.get('/api/access')};
      case 'bank':
        return {'banks': await Api.i.get('/api/bank-accounts'), 'settings': await Api.i.get('/api/settings')};
      default:
        return {};
    }
  }

  Widget _section(Map<String, dynamic> d) {
    switch (sec) {
      case 'profile': return _Profile(data: d, canEdit: canEdit, onSaved: refresh);
      case 'skema': return _Schemes(list: asList(d['schemes']), canEdit: canEdit, onChanged: refresh);
      case 'users': return _Users(users: asList(d['users']), access: asMap(d['access']), meId: s.user['id'], onChanged: refresh);
      case 'bank': return _Banks(banks: asList(d['banks']), settings: asMap(d['settings']), canEdit: canEdit, onChanged: refresh);
      case 'notif': return _Notif(prefs: asMap(asMap(d)['notif']));
      case 'integrations': return _Integrations();
      default: return _Account(session: s, onLogout: widget.onLogout);
    }
  }
}

Widget _title(String t, String sub) => Padding(padding: const EdgeInsets.only(bottom: 12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(t, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)), const SizedBox(height: 2), Text(sub, style: const TextStyle(color: C.mute))]));

TextEditingController _c(dynamic v) => TextEditingController(text: v == null ? '' : '$v');

// ---------------- Profil Usaha ----------------
class _Profile extends StatefulWidget {
  final Map<String, dynamic> data;
  final bool canEdit;
  final VoidCallback onSaved;
  const _Profile({required this.data, required this.canEdit, required this.onSaved});
  @override
  State<_Profile> createState() => _ProfileState();
}

class _ProfileState extends State<_Profile> {
  late final Map<String, dynamic> b = Map.of(asMap(widget.data['business']));
  late final fields = {for (final k in ['name', 'legalForm', 'npwp', 'email', 'whatsapp', 'address', 'signerName', 'signerTitle', 'docFooter']) k: _c(b[k])};
  String tz = 'Asia/Makassar';
  bool busy = false;

  @override
  void initState() {
    super.initState();
    tz = '${b['timezone'] ?? 'Asia/Makassar'}';
  }

  Widget _f(String k, String label, {int lines = 1}) => Padding(padding: const EdgeInsets.only(bottom: 12), child: TextField(controller: fields[k], maxLines: lines, readOnly: !widget.canEdit, decoration: InputDecoration(labelText: label)));

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _title('Profil Usaha', 'Dipakai di kop invoice, kuitansi, dan laporan investor.'),
        Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            if (b['logoUrl'] != null) Padding(padding: const EdgeInsets.only(right: 14), child: ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.network('${b['logoUrl']}'.startsWith('http') ? '${b['logoUrl']}' : '$kBaseUrl${b['logoUrl']}', width: 60, height: 60, headers: const {}, errorBuilder: (_, __, ___) => const LogoMark(size: 60)))) else const Padding(padding: EdgeInsets.only(right: 14), child: LogoMark(size: 60)),
            const Expanded(child: Text('Logo dan tanda tangan usaha diubah dari aplikasi web (unggah gambar).', style: TextStyle(color: C.mute, fontSize: 12))),
          ]),
          const SizedBox(height: 16),
          _f('name', 'Nama usaha'),
          Row(children: [Expanded(child: _f('legalForm', 'Bentuk usaha')), const SizedBox(width: 12), Expanded(child: _f('npwp', 'NPWP'))]),
          Row(children: [Expanded(child: _f('email', 'Email')), const SizedBox(width: 12), Expanded(child: _f('whatsapp', 'WhatsApp'))]),
          _f('address', 'Alamat', lines: 2),
          DropdownButtonFormField<String>(initialValue: tz, decoration: const InputDecoration(labelText: 'Zona waktu'), items: const [DropdownMenuItem(value: 'Asia/Makassar', child: Text('WITA (UTC+8) — Bali')), DropdownMenuItem(value: 'Asia/Jakarta', child: Text('WIB (UTC+7)')), DropdownMenuItem(value: 'Asia/Jayapura', child: Text('WIT (UTC+9)'))], onChanged: widget.canEdit ? (v) => setState(() => tz = v ?? tz) : null),
          const Divider(height: 32),
          const Text('Tanda tangan usaha', style: TextStyle(fontWeight: FontWeight.w700)),
          const Text('Tercetak di bagian bawah invoice dan kuitansi pembayaran.', style: TextStyle(color: C.mute, fontSize: 12)),
          const SizedBox(height: 10),
          Row(children: [Expanded(child: _f('signerName', 'Nama penanda tangan')), const SizedBox(width: 12), Expanded(child: _f('signerTitle', 'Jabatan'))]),
          _f('docFooter', 'Footer dokumen proyek', lines: 2),
          if (widget.canEdit) Align(alignment: Alignment.centerRight, child: FilledButton(onPressed: busy ? null : () async {
            setState(() => busy = true);
            await guard(context, () async {
              final body = {for (final e in fields.entries) e.key: e.value.text.trim(), 'timezone': tz, 'logoKey': b['logoKey'], 'signatureKey': b['signatureKey']};
              await Api.i.put('/api/settings', {'business': body});
              widget.onSaved();
            }, ok: 'Profil usaha disimpan.');
            if (mounted) setState(() => busy = false);
          }, child: const Text('Simpan'))),
        ])),
      ]);
}

// ---------------- Skema Bagi Hasil ----------------
class _Schemes extends StatelessWidget {
  final List<Map<String, dynamic>> list;
  final bool canEdit;
  final VoidCallback onChanged;
  const _Schemes({required this.list, required this.canEdit, required this.onChanged});

  void _edit(BuildContext context, Map<String, dynamic>? sc) {
    final name = _c(sc?['name']), desc = _c(sc?['description']);
    final m = _c(sc?['capitalPct'] ?? 0), w = _c(sc?['workerPct'] ?? 0), kas = _c(sc?['cashPct'] ?? 0);
    showDialog<void>(context: context, builder: (ctx) => AlertDialog(
      title: Text(sc == null ? 'Tambah Skema' : 'Ubah Skema'),
      content: SizedBox(width: 420, child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: name, decoration: const InputDecoration(labelText: 'Nama skema')),
        const SizedBox(height: 10),
        TextField(controller: desc, decoration: const InputDecoration(labelText: 'Keterangan')),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(child: TextField(controller: m, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Modal %'))), const SizedBox(width: 8),
          Expanded(child: TextField(controller: w, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Pekerja %'))), const SizedBox(width: 8),
          Expanded(child: TextField(controller: kas, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Kas %'))),
        ]),
        const SizedBox(height: 6),
        const Text('Total harus 100%.', style: TextStyle(color: C.mute, fontSize: 12)),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
        FilledButton(onPressed: () async {
          final body = {'name': name.text.trim(), 'description': desc.text.trim().isEmpty ? null : desc.text.trim(), 'capitalPct': num.tryParse(m.text) ?? 0, 'workerPct': num.tryParse(w.text) ?? 0, 'cashPct': num.tryParse(kas.text) ?? 0, 'isDefault': sc?['isDefault'] ?? false};
          Navigator.pop(ctx);
          await guard(context, () async {
            if (sc == null) { await Api.i.post('/api/schemes', body); } else { await Api.i.put('/api/schemes/${sc['id']}', body); }
            onChanged();
          }, ok: 'Skema disimpan.');
        }, child: const Text('Simpan')),
      ],
    ));
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _title('Skema Bagi Hasil', 'Template dipilih saat membuat proyek; mengubahnya tidak mengubah proyek & distribusi yang sudah ada.'),
        for (final sc in list) Padding(padding: const EdgeInsets.only(bottom: 10), child: Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Expanded(child: Text('${sc['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15))), if (sc['isDefault'] == true) const Pill('Default', fg: C.green, bg: C.greenSoft), if (canEdit) IconButton(icon: const Icon(Icons.edit_outlined, size: 20), onPressed: () => _edit(context, sc))]),
          if ('${sc['description'] ?? ''}'.isNotEmpty) Text('${sc['description']}', style: const TextStyle(color: C.mute, fontSize: 12)),
          const SizedBox(height: 10),
          ClipRRect(borderRadius: BorderRadius.circular(4), child: Row(children: [
            Expanded(flex: n(sc['capitalPct']).round().clamp(1, 100), child: Container(height: 10, color: C.green)),
            Expanded(flex: n(sc['workerPct']).round().clamp(1, 100), child: Container(height: 10, color: C.blue)),
            Expanded(flex: n(sc['cashPct']).round().clamp(1, 100), child: Container(height: 10, color: const Color(0xFF98A2B3))),
          ])),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: Text('Modal ${n(sc['capitalPct'])}%', style: const TextStyle(fontSize: 13))),
            Expanded(child: Text('Pekerja ${n(sc['workerPct'])}%', style: const TextStyle(fontSize: 13))),
            Expanded(child: Text('Kas OCN ${n(sc['cashPct'])}%', style: const TextStyle(fontSize: 13))),
          ]),
        ]))),
        if (canEdit) OutlinedButton.icon(onPressed: () => _edit(context, null), icon: const Icon(Icons.add), label: const Text('Tambah skema')),
      ]);
}

// ---------------- Pengguna & Hak Akses ----------------
class _Users extends StatelessWidget {
  final List<Map<String, dynamic>> users;
  final Map<String, dynamic> access;
  final dynamic meId;
  final VoidCallback onChanged;
  const _Users({required this.users, required this.access, required this.meId, required this.onChanged});

  static const roleLabel = {'admin': 'Admin', 'investor': 'Investor', 'developer': 'Developer'};

  void _invite(BuildContext context) {
    final name = TextEditingController(), email = TextEditingController(), title = TextEditingController();
    String role = 'developer';
    showDialog<void>(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => AlertDialog(
      title: const Text('Undang pengguna'),
      content: SizedBox(width: 420, child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: name, decoration: const InputDecoration(labelText: 'Nama')),
        const SizedBox(height: 10),
        TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email')),
        const SizedBox(height: 10),
        TextField(controller: title, decoration: const InputDecoration(labelText: 'Jabatan (opsional)')),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(initialValue: role, decoration: const InputDecoration(labelText: 'Peran'), items: [for (final e in roleLabel.entries) DropdownMenuItem(value: e.key, child: Text(e.value))], onChanged: (v) => set(() => role = v ?? role)),
        const SizedBox(height: 6),
        const Text('Undangan dikirim lewat email dan berlaku 7 hari.', style: TextStyle(color: C.mute, fontSize: 12)),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
        FilledButton(onPressed: () async {
          Navigator.pop(ctx);
          await guard(context, () async {
            await Api.i.post('/api/users', {'name': name.text.trim(), 'email': email.text.trim(), 'role': role, 'title': title.text.trim().isEmpty ? null : title.text.trim()});
            onChanged();
          }, ok: 'Undangan dikirim.');
        }, child: const Text('Undang')),
      ],
    )));
  }

  Future<void> _setStatus(BuildContext context, Map<String, dynamic> u, String st) => guard(context, () async { await Api.i.patch('/api/users/${u['id']}', {'status': st}); onChanged(); }, ok: st == 'aktif' ? 'Pengguna diaktifkan.' : 'Pengguna dinonaktifkan.');

  static Widget _lvl(String v, {bool scope = false}) {
    const labels = {'tidak': 'Tidak ada', 'lihat': 'Lihat', 'kelola': 'Kelola', 'ringkasan': 'Ringkasan', 'ditugaskan': 'Yang ditugaskan', 'sendiri': 'Data sendiri', 'semua': 'Semua proyek', 'didanai': 'Yang didanai'};
    final label = labels[v] ?? v;
    if (scope) return Pill(label, fg: C.purple, bg: const Color(0xFFEDE9FE));
    if (v == 'tidak') return Pill(label);
    if (v == 'kelola') return Pill(label, fg: const Color(0xFF047857), bg: C.greenSoft);
    return Pill(label, fg: C.blue, bg: C.blueSoft);
  }

  @override
  Widget build(BuildContext context) {
    final matrix = asMap(access['matrix']);
    const modules = [('proyek', 'Proyek'), ('dokumen', 'Tim & Dokumen'), ('keuangan', 'Keuangan'), ('bug', 'Bug'), ('investor', 'Investor & Modal'), ('laporan', 'Laporan'), ('pengaturan', 'Pengaturan')];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _title('Pengguna & Hak Akses', '${users.length} pengguna · undangan berlaku 7 hari'),
      Panel(child: Column(children: [
        Align(alignment: Alignment.centerRight, child: FilledButton.icon(onPressed: () => _invite(context), icon: const Icon(Icons.person_add_alt, size: 18), label: const Text('Undang pengguna'))),
        for (final u in users) ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Avatar(initialsOf('${u['name']}'), color: hexColor(u['avatarColor'])),
          title: Text('${u['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text('${u['email']} · ${roleLabel[u['role']] ?? u['role']} · ${u['projectCount'] ?? 0} proyek${u['lastLoginAt'] != null ? ' · masuk ${tgl(u['lastLoginAt'])}' : ''}'),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            Pill.status('${u['status']}'),
            if (u['id'] != meId && u['status'] == 'aktif') TextButton(onPressed: () => _setStatus(context, u, 'nonaktif'), child: const Text('Nonaktifkan', style: TextStyle(color: C.red))),
            if (u['status'] == 'nonaktif') TextButton(onPressed: () => _setStatus(context, u, 'aktif'), child: const Text('Aktifkan')),
            if (u['status'] == 'diundang') TextButton(onPressed: () => guard(context, () async { await Api.i.post('/api/users/${u['id']}/resend'); }, ok: 'Undangan dikirim ulang.'), child: const Text('Kirim ulang')),
          ]),
        ),
      ])),
      const SizedBox(height: 16),
      Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const H('Hak Akses per Peran'),
        const Text('Admin selalu penuh. Perubahan matriks dilakukan dari aplikasi web.', style: TextStyle(color: C.mute, fontSize: 12)),
        const SizedBox(height: 8),
        AppTable(
          head: const ['Modul', 'Investor', 'Developer'],
          flex: const [3, 2, 2],
          rows: [
            for (final m in modules) [m.$2, _lvl('${asMap(matrix['investor'])[m.$1] ?? '—'}'), _lvl('${asMap(matrix['developer'])[m.$1] ?? '—'}')],
            ['Lingkup proyek', _lvl('${asMap(matrix['investor'])['scope'] ?? '—'}', scope: true), _lvl('${asMap(matrix['developer'])['scope'] ?? '—'}', scope: true)],
          ],
        ),
      ])),
    ]);
  }
}

// ---------------- Rekening & Invoice ----------------
class _Banks extends StatefulWidget {
  final List<Map<String, dynamic>> banks;
  final Map<String, dynamic> settings;
  final bool canEdit;
  final VoidCallback onChanged;
  const _Banks({required this.banks, required this.settings, required this.canEdit, required this.onChanged});
  @override
  State<_Banks> createState() => _BanksState();
}

class _BanksState extends State<_Banks> {
  late final Map<String, dynamic> inv = Map.of(asMap(widget.settings['invoice']));
  late final fmt = _c(inv['numberFormat']), due = _c(inv['defaultDueDays']), tax = _c(inv['defaultTaxPercent']), foot = _c(inv['footer']);
  late bool showTax = inv['showTax'] == true;
  late Map<String, dynamic> methods = Map.of(asMap(inv['methods']));

  void _bank(Map<String, dynamic>? b) {
    final bank = _c(b?['bankName']), no = _c(b?['accountNumber']), name = _c(b?['accountName']);
    bool def = b?['isDefault'] == true, active = b?['active'] != false;
    showDialog<void>(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, set) => AlertDialog(
      title: Text(b == null ? 'Tambah Rekening' : 'Ubah Rekening'),
      content: SizedBox(width: 420, child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: bank, decoration: const InputDecoration(labelText: 'Bank')),
        const SizedBox(height: 10),
        TextField(controller: no, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Nomor rekening')),
        const SizedBox(height: 10),
        TextField(controller: name, decoration: const InputDecoration(labelText: 'Atas nama')),
        CheckboxListTile(contentPadding: EdgeInsets.zero, value: def, onChanged: (v) => set(() => def = v ?? false), title: const Text('Rekening utama'), controlAffinity: ListTileControlAffinity.leading),
        CheckboxListTile(contentPadding: EdgeInsets.zero, value: active, onChanged: (v) => set(() => active = v ?? true), title: const Text('Aktif'), controlAffinity: ListTileControlAffinity.leading),
      ])),
      actions: [
        if (b != null) TextButton(onPressed: () async { Navigator.pop(ctx); await guard(context, () async { await Api.i.delete('/api/bank-accounts/${b['id']}'); widget.onChanged(); }, ok: 'Rekening dihapus.'); }, child: const Text('Hapus', style: TextStyle(color: C.red))),
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
        FilledButton(onPressed: () async {
          final body = {'bankName': bank.text.trim(), 'accountNumber': no.text.trim(), 'accountName': name.text.trim(), 'isDefault': def, 'active': active};
          Navigator.pop(ctx);
          await guard(context, () async {
            if (b == null) { await Api.i.post('/api/bank-accounts', body); } else { await Api.i.put('/api/bank-accounts/${b['id']}', body); }
            widget.onChanged();
          }, ok: 'Rekening disimpan.');
        }, child: const Text('Simpan')),
      ],
    )));
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _title('Rekening & Metode Bayar', 'Rekening utama tercetak di invoice dan pengingat pembayaran.'),
        Panel(child: Column(children: [
          for (final b in widget.banks) ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.account_balance_outlined),
            title: Text('${b['bankName']} ${b['accountNumber']}', style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text('a.n. ${b['accountName']}'),
            trailing: Row(mainAxisSize: MainAxisSize.min, children: [if (b['isDefault'] == true) const Pill('Utama', fg: C.green, bg: C.greenSoft), if (b['active'] == false) const Pill('Nonaktif'), if (widget.canEdit) IconButton(icon: const Icon(Icons.edit_outlined, size: 20), onPressed: () => _bank(b))]),
          ),
          if (widget.canEdit) Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: () => _bank(null), icon: const Icon(Icons.add), label: const Text('Tambah rekening'))),
        ])),
        if (inv.isNotEmpty) ...[
          const SizedBox(height: 16),
          Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const H('Metode Pembayaran & Invoice'),
            const SizedBox(height: 10),
            TextField(controller: fmt, readOnly: !widget.canEdit, decoration: const InputDecoration(labelText: 'Format nomor invoice', helperText: 'Harus memuat [NOMOR] atau [NOMOR 3 DIGIT]')),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: TextField(controller: due, readOnly: !widget.canEdit, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Jatuh tempo default (hari)'))),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: tax, readOnly: !widget.canEdit, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'PPN default %'))),
            ]),
            SwitchListTile(contentPadding: EdgeInsets.zero, value: showTax, activeThumbColor: C.green, onChanged: widget.canEdit ? (v) => setState(() => showTax = v) : null, title: const Text('Tampilkan pajak di invoice')),
            Wrap(spacing: 8, children: [for (final m in const [('transfer', 'Transfer bank'), ('qris', 'QRIS'), ('tunai', 'Tunai')]) FilterChip(label: Text(m.$2), selected: methods[m.$1] == true, onSelected: widget.canEdit ? (v) => setState(() => methods[m.$1] = v) : null, selectedColor: C.greenSoft)]),
            const SizedBox(height: 10),
            TextField(controller: foot, readOnly: !widget.canEdit, maxLines: 2, decoration: const InputDecoration(labelText: 'Footer invoice')),
            if (widget.canEdit) Padding(padding: const EdgeInsets.only(top: 12), child: Align(alignment: Alignment.centerRight, child: FilledButton(onPressed: () => guard(context, () async {
              await Api.i.put('/api/settings', {'invoice': {'numberFormat': fmt.text.trim(), 'defaultDueDays': int.tryParse(due.text) ?? 14, 'showTax': showTax, 'defaultTaxPercent': num.tryParse(tax.text) ?? 0, 'footer': foot.text.trim(), 'qrisKey': inv['qrisKey'], 'methods': {'transfer': methods['transfer'] == true, 'qris': methods['qris'] == true, 'tunai': methods['tunai'] == true}}});
            }, ok: 'Pengaturan invoice disimpan.'), child: const Text('Simpan')))),
          ])),
        ],
      ]);
}

// ---------------- Notifikasi ----------------
class _Notif extends StatefulWidget {
  final Map<String, dynamic> prefs;
  const _Notif({required this.prefs});
  @override
  State<_Notif> createState() => _NotifState();
}

class _NotifState extends State<_Notif> {
  late final Map<String, Map<String, bool>> p = {for (final e in _notifEvents) e.$1: {'app': asMap(widget.prefs[e.$1])['app'] == true, 'email': asMap(widget.prefs[e.$1])['email'] == true}};
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _title('Notifikasi', 'Pilih kejadian dan saluran pemberitahuan untuk akun Anda.'),
        Panel(child: Column(children: [
          const Row(children: [Expanded(child: Text('Kejadian', style: TextStyle(color: C.mute, fontSize: 12))), SizedBox(width: 90, child: Text('Aplikasi', textAlign: TextAlign.center, style: TextStyle(color: C.mute, fontSize: 12))), SizedBox(width: 90, child: Text('Email', textAlign: TextAlign.center, style: TextStyle(color: C.mute, fontSize: 12))), SizedBox(width: 90, child: Text('WhatsApp', textAlign: TextAlign.center, style: TextStyle(color: C.mute, fontSize: 12)))]),
          const Divider(),
          for (final e in _notifEvents) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(e.$2, style: const TextStyle(fontWeight: FontWeight.w600)), Text(e.$3, style: const TextStyle(color: C.mute, fontSize: 12))])),
            SizedBox(width: 90, child: Checkbox(value: p[e.$1]!['app'], activeColor: C.green, onChanged: (v) => setState(() => p[e.$1]!['app'] = v ?? false))),
            SizedBox(width: 90, child: Checkbox(value: p[e.$1]!['email'], activeColor: C.green, onChanged: (v) => setState(() => p[e.$1]!['email'] = v ?? false))),
            const SizedBox(width: 90, child: Checkbox(value: false, onChanged: null)),
          ])),
          const SizedBox(height: 8),
          Align(alignment: Alignment.centerRight, child: FilledButton(onPressed: () => guard(context, () async { await Api.i.put('/api/settings', {'notif': p}); }, ok: 'Preferensi notifikasi disimpan.'), child: const Text('Simpan'))),
        ])),
      ]);
}

// ---------------- Integrasi ----------------
class _Integrations extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _title('Integrasi', 'Hubungkan layanan untuk pengingat, penyimpanan dokumen, dan notifikasi. Tersedia di fase 2.'),
        for (final i in const [('WhatsApp', 'Pengingat termin otomatis ke klien'), ('Telegram', 'Notifikasi tim & ringkasan harian'), ('Google Drive', 'Simpan dokumen proyek ke Drive'), ('API & Webhook', 'Hubungkan sistem lain, mis. bot internal')])
          Padding(padding: const EdgeInsets.only(bottom: 10), child: Panel(child: Row(children: [
            const Icon(Icons.extension_outlined, color: C.mute), const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(i.$1, style: const TextStyle(fontWeight: FontWeight.w700)), Text(i.$2, style: const TextStyle(color: C.mute, fontSize: 12))])),
            const Pill('Fase 2'),
          ]))),
      ]);
}

// ---------------- Akun ----------------
class _Account extends StatelessWidget {
  final Session session;
  final VoidCallback onLogout;
  const _Account({required this.session, required this.onLogout});

  void _pwd(BuildContext context) {
    final cur = TextEditingController(), nw = TextEditingController();
    showDialog<void>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Ubah kata sandi'),
      content: SizedBox(width: 380, child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: cur, obscureText: true, decoration: const InputDecoration(labelText: 'Kata sandi saat ini')),
        const SizedBox(height: 10),
        TextField(controller: nw, obscureText: true, decoration: const InputDecoration(labelText: 'Kata sandi baru', helperText: 'Minimal 8 karakter')),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
        FilledButton(onPressed: () async { Navigator.pop(ctx); await guard(context, () async { await Api.i.post('/api/auth/password', {'current': cur.text, 'password': nw.text}); }, ok: 'Kata sandi diubah.'); }, child: const Text('Simpan')),
      ],
    ));
  }

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _title('Akun Saya', 'Profil, kata sandi, dan keluar dari perangkat ini.'),
        Panel(child: Column(children: [
          Row(children: [
            Avatar(session.initials, size: 56), const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(session.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)), Text('${session.user['email']}', style: const TextStyle(color: C.mute)), if (session.user['title'] != null) Text('${session.user['title']}', style: const TextStyle(color: C.mute, fontSize: 12))])),
            Pill.status(session.role),
          ]),
          const Divider(height: 32),
          Row2('Server', kBaseUrl.replaceFirst('https://', '')),
          Row2('Versi aplikasi', '1.0.0'),
          const SizedBox(height: 14),
          Row(children: [
            OutlinedButton.icon(onPressed: () => _pwd(context), icon: const Icon(Icons.lock_outline), label: const Text('Ubah kata sandi')),
            const SizedBox(width: 10),
            OutlinedButton.icon(style: OutlinedButton.styleFrom(foregroundColor: C.red), onPressed: onLogout, icon: const Icon(Icons.logout), label: const Text('Keluar')),
          ]),
        ])),
      ]);
}
