import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api.dart';
import '../ink.dart';
import '../theme.dart';
import '../widgets.dart';

String _plain(dynamic node, [StringBuffer? b]) {
  b ??= StringBuffer();
  if (node is Map) {
    if (node['type'] == 'text') b.write(node['text']);
    final ch = node['content'];
    if (ch is List) {
      for (final c in ch) { _plain(c, b); }
      if (['paragraph', 'heading', 'listItem', 'tableRow'].contains(node['type'])) b.write('\n');
    }
  }
  return b.toString();
}

Widget _sigBox(String label, {required Widget child, bool active = false, bool dashed = false}) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(fontSize: 11, color: C.mute, fontWeight: FontWeight.w700, letterSpacing: .5)),
      const SizedBox(height: 6),
      Container(
        height: 150,
        width: double.infinity,
        decoration: BoxDecoration(color: dashed ? C.greenSoft.withValues(alpha: .5) : Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: active ? C.green : (dashed ? const Color(0xFF7DD3C0) : C.line), width: active ? 2 : 1)),
        child: child,
      ),
    ]);

/// T11–T12 · Tanda tangan di tablet: Pihak Pertama menulis di kotak, lalu tablet diserahkan ke klien.
class SignScreen extends StatefulWidget {
  final int docId, projectId;
  const SignScreen({super.key, required this.docId, required this.projectId});
  @override
  State<SignScreen> createState() => _SignScreenState();
}

class _SignScreenState extends State<SignScreen> {
  final ink = InkController();
  final key = GlobalKey();
  Uint8List? saved;
  bool useSaved = false, remember = true, signed = false, busy = false;
  String? signedAt;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) { final s = p.getString('mySignature'); if (s != null) setState(() => saved = base64Decode(s)); });
  }

  Future<void> _commit() async {
    final box = key.currentContext?.size ?? const Size(400, 150);
    if (ink.isEmpty && !useSaved) { toast(context, 'Tanda tangan dulu di kotak Pihak Pertama.', error: true); return; }
    if (!useSaved && remember) {
      final url = await ink.toPngDataUrl(box);
      (await SharedPreferences.getInstance()).setString('mySignature', url.split(',').last);
      saved = base64Decode(url.split(',').last);
    }
    setState(() { signed = true; signedAt = tglJam(DateTime.now().toIso8601String()); });
  }

  Future<void> _handover(Map<String, dynamic> d) async {
    if (!signed) { await _commit(); if (!signed) return; }
    final pin = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Serahkan ke klien'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        const Text('Aplikasi akan terkunci pada dokumen ini. Atur PIN 4 angka untuk keluar dari mode klien.'),
        const SizedBox(height: 12),
        TextField(controller: pin, keyboardType: TextInputType.number, obscureText: true, maxLength: 4, inputFormatters: [FilteringTextInputFormatter.digitsOnly], decoration: const InputDecoration(labelText: 'PIN')),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')), FilledButton(onPressed: () => Navigator.pop(ctx, pin.text.length == 4), child: const Text('Serahkan'))],
    ));
    if (ok != true || !mounted) return;
    setState(() => busy = true);
    await guard(context, () async {
      var text = _plain(d['content']).trim();
      if (text.length < 10) text = '${d['name']} — persetujuan dokumen.';
      if (text.length > 7900) text = '${text.substring(0, 7900)}…';
      final r = asMap(await Api.i.post('/api/projects/${widget.projectId}/signatures', {'title': '${d['name']}', 'body': text, 'validDays': 7}));
      final token = '${r['link']}'.split('/').last;
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(fullscreenDialog: true, builder: (_) => ClientModeScreen(token: token, pin: pin.text, mySignature: saved, myName: Api.i.session!.name, myAt: signedAt)));
    });
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) => Loader<Map<String, dynamic>>(
        load: () async => asMap(await Api.i.get('/api/documents/${widget.docId}')),
        builder: (c, d, _) {
          final biz = asMap(asMap(d['layout'])['business']);
          final text = _plain(d['content']).trim();
          return Scaffold(
            appBar: TopBar('${d['name']}', back: true, actions: [
              Pill(signed ? 'Menunggu tanda tangan klien' : 'Sedang ditandatangani', fg: signed ? const Color(0xFFB45309) : C.blue, bg: signed ? C.amberSoft : C.blueSoft),
            ]),
            body: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(flex: 3, child: ListView(padding: const EdgeInsets.all(16), children: [
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Center(child: Text('${d['name']}'.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
                  const SizedBox(height: 14),
                  Text(text.length > 1400 ? '${text.substring(0, 1400)}…' : text, style: const TextStyle(fontSize: 13, height: 1.5)),
                  const SizedBox(height: 20),
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(child: _sigBox('PIHAK PERTAMA', active: !signed, child: signed
                        ? Center(child: Image.memory(saved ?? Uint8List(0), errorBuilder: (_, __, ___) => const Icon(Icons.check_circle, color: C.green, size: 40)))
                        : useSaved && saved != null ? Center(child: Image.memory(saved!)) : Container(key: key, child: InkPad(ctl: ink)))),
                    const SizedBox(width: 16),
                    Expanded(child: _sigBox('PIHAK KEDUA', dashed: true, child: const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.edit_outlined, color: C.green), SizedBox(height: 6), Text('Menunggu klien', style: TextStyle(color: C.mute, fontSize: 12))])))),
                  ]),
                  const SizedBox(height: 6),
                  Row(children: [
                    Expanded(child: Text('${biz['signerName'] ?? Api.i.session!.name}\n${biz['signerTitle'] ?? ''}', style: const TextStyle(fontSize: 12))),
                    const Expanded(child: Text('Klien', style: TextStyle(fontSize: 12))),
                  ]),
                  if (!signed) Padding(padding: const EdgeInsets.only(top: 10), child: Row(children: [
                    OutlinedButton.icon(onPressed: () => setState(ink.undo), icon: const Icon(Icons.undo, size: 16), label: const Text('Urungkan')),
                    const SizedBox(width: 8),
                    OutlinedButton.icon(onPressed: () => setState(() { ink.clear(); useSaved = false; }), icon: const Icon(Icons.close, size: 16), label: const Text('Hapus')),
                    const Spacer(),
                    FilledButton(onPressed: _commit, child: const Text('Selesai')),
                  ])),
                ])),
              ])),
              SizedBox(width: 340, child: ListView(padding: const EdgeInsets.fromLTRB(0, 16, 16, 16), children: [
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const H('Penanda tangan'),
                  const SizedBox(height: 8),
                  ListTile(contentPadding: EdgeInsets.zero, leading: Avatar(Api.i.session!.initials), title: Text('${Api.i.session!.name} (Anda)'), subtitle: const Text('Pihak Pertama'), trailing: Pill.status(signed ? 'sudah' : 'menulis')),
                  const ListTile(contentPadding: EdgeInsets.zero, leading: Avatar('K', color: C.purple), title: Text('Klien'), subtitle: Text('Pihak Kedua'), trailing: Pill('Menunggu', fg: Color(0xFFB45309), bg: C.amberSoft)),
                ])),
                const SizedBox(height: 12),
                if (saved != null && !signed) Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const H('Tanda tangan tersimpan'),
                  const Text('Pakai ulang tanpa menulis lagi.', style: TextStyle(color: C.mute, fontSize: 12)),
                  const SizedBox(height: 8),
                  Container(height: 70, width: double.infinity, decoration: BoxDecoration(border: Border.all(color: C.line), borderRadius: BorderRadius.circular(8)), child: Image.memory(saved!)),
                  const SizedBox(height: 8),
                  OutlinedButton(onPressed: () => setState(() { useSaved = true; ink.clear(); }), child: const Text('Pakai tanda tangan ini')),
                ])),
                if (saved != null && !signed) const SizedBox(height: 12),
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SwitchListTile(contentPadding: EdgeInsets.zero, dense: true, activeThumbColor: C.green, title: const Text('Simpan tanda tangan baru untuk berikutnya'), value: remember, onChanged: (v) => setState(() => remember = v)),
                  const SizedBox(height: 4),
                  FilledButton.icon(onPressed: busy ? null : () => _handover(d), icon: const Icon(Icons.draw), label: const Text('Serahkan ke klien')),
                  const SizedBox(height: 8),
                  OutlinedButton.icon(onPressed: busy ? null : () => _sendLink(d), icon: const Icon(Icons.send, size: 18), label: const Text('Kirim tautan tanda tangan')),
                ])),
                const SizedBox(height: 12),
                const Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  H('Tanda tangan dengan stylus'),
                  SizedBox(height: 6),
                  Text('Hanya ujung stylus yang menggambar; telapak tangan diabaikan. Tekanan pena mengatur tebal garis. Tanda tangan klien disimpan di server dengan waktu dan perangkat sebagai bukti.', style: TextStyle(color: C.mute, fontSize: 12)),
                ])),
              ])),
            ]),
          );
        },
      );

  Future<void> _sendLink(Map<String, dynamic> d) async {
    final email = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Kirim tautan ke klien'),
      content: TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Email klien (opsional)')),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Buat tautan'))],
    ));
    if (ok != true || !mounted) return;
    await guard(context, () async {
      var text = _plain(d['content']).trim();
      if (text.length < 10) text = '${d['name']} — persetujuan dokumen.';
      if (text.length > 7900) text = '${text.substring(0, 7900)}…';
      final r = asMap(await Api.i.post('/api/projects/${widget.projectId}/signatures', {'title': '${d['name']}', 'body': text, if (email.text.trim().isNotEmpty) 'email': email.text.trim()}));
      await Clipboard.setData(ClipboardData(text: '${r['link']}'));
      if (mounted) toast(context, r['emailSent'] == true ? 'Tautan dikirim lewat email & disalin.' : 'Tautan disalin ke papan klip.');
    });
  }
}

/// T13–T14 · Mode klien: terkunci pada satu dokumen, klien menulis tanda tangan dengan stylus.
class ClientModeScreen extends StatefulWidget {
  final String token;
  final String? pin, myName, myAt;
  final Uint8List? mySignature;
  const ClientModeScreen({super.key, required this.token, this.pin, this.mySignature, this.myName, this.myAt});
  @override
  State<ClientModeScreen> createState() => _ClientModeScreenState();
}

class _ClientModeScreenState extends State<ClientModeScreen> {
  final ink = InkController();
  final key = GlobalKey();
  final name = TextEditingController();
  final title = TextEditingController();
  bool consent = false, busy = false, done = false;
  double width = 3;
  Uint8List? clientSig;
  String? doneAt;
  Key k = UniqueKey();

  Future<void> _exit() async {
    if (widget.pin == null) { Navigator.pop(context); return; }
    final c = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Keluar mode klien'),
      content: TextField(controller: c, keyboardType: TextInputType.number, obscureText: true, maxLength: 4, autofocus: true, decoration: const InputDecoration(labelText: 'PIN')),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')), FilledButton(onPressed: () => Navigator.pop(ctx, c.text == widget.pin), child: const Text('Keluar'))],
    ));
    if (!mounted) return;
    if (ok == true) { Navigator.pop(context); } else if (ok != null) { toast(context, 'PIN salah.', error: true); }
  }

  Future<void> _submit() async {
    if (name.text.trim().length < 2) { toast(context, 'Isi nama lengkap.', error: true); return; }
    if (ink.isEmpty) { toast(context, 'Tanda tangan di dalam kotak.', error: true); return; }
    if (!consent) { toast(context, 'Centang pernyataan persetujuan.', error: true); return; }
    setState(() => busy = true);
    await guard(context, () async {
      final size = key.currentContext?.size ?? const Size(500, 220);
      final url = await ink.toPngDataUrl(size);
      await Api.i.post('/api/sign/${widget.token}', {'name': title.text.trim().isEmpty ? name.text.trim() : '${name.text.trim()}, ${title.text.trim()}', 'consent': true, 'signature': url});
      clientSig = base64Decode(url.split(',').last);
      doneAt = tglJam(DateTime.now().toIso8601String());
      if (mounted) setState(() => done = true);
    });
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) => PopScope(
        canPop: false,
        child: Scaffold(
          backgroundColor: C.bg,
          body: SafeArea(child: Column(children: [
            Container(
              color: C.navy, padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(children: [
                const Icon(Icons.lock, color: Colors.white70, size: 18), const SizedBox(width: 10),
                const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Mode klien', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)), Text('Aplikasi terkunci pada dokumen ini. Data lain tidak bisa dibuka.', style: TextStyle(color: Colors.white60, fontSize: 11))])),
                TextButton(style: TextButton.styleFrom(backgroundColor: const Color(0xFF1E2E45), foregroundColor: Colors.white), onPressed: _exit, child: Text(widget.pin == null ? 'Keluar' : 'Keluar mode klien (PIN)')),
              ]),
            ),
            Expanded(child: Loader<Map<String, dynamic>>(
              key: k,
              load: () async => asMap(await Api.i.get('/api/sign/${widget.token}')),
              builder: (c, d, _) {
                final status = '${d['status']}';
                if (done || status == 'ditandatangani') return _doneView(d);
                if (status != 'menunggu') return Center(child: Text(status == 'kedaluwarsa' ? 'Tautan ini sudah kedaluwarsa.' : 'Permintaan ini sudah tidak aktif.'));
                return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SizedBox(width: 340, child: ListView(padding: const EdgeInsets.all(16), children: [
                    Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('DOKUMEN', style: TextStyle(fontSize: 11, color: C.green, fontWeight: FontWeight.w800, letterSpacing: .5)),
                      Text('${d['title']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                      Text('${d['businessName']} · ${d['projectName']}', style: const TextStyle(color: C.mute, fontSize: 12)),
                      const Divider(height: 24),
                      const Text('Yang Anda setujui', style: TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Text('${d['body']}', style: const TextStyle(fontSize: 13, height: 1.5)),
                    ])),
                  ])),
                  Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(0, 16, 16, 16), children: [
                    Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      H('Tanda tangan Pihak Kedua', trailing: const Pill('Stylus terdeteksi', fg: Color(0xFF047857), bg: C.greenSoft)),
                      const Text('Tandatangani dengan stylus di dalam kotak. Jari juga bisa dipakai.', style: TextStyle(color: C.mute, fontSize: 12)),
                      const SizedBox(height: 12),
                      Row(children: [
                        Expanded(child: TextField(controller: name, decoration: const InputDecoration(labelText: 'Nama lengkap'))),
                        const SizedBox(width: 10),
                        Expanded(child: TextField(controller: title, decoration: const InputDecoration(labelText: 'Jabatan'))),
                      ]),
                      const SizedBox(height: 12),
                      Container(
                        key: key, height: 240, width: double.infinity,
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10), border: Border.all(color: C.green, width: 2)),
                        child: Stack(children: [
                          const Positioned(left: 20, right: 20, bottom: 40, child: Divider(color: C.line)),
                          const Positioned(bottom: 18, left: 0, right: 0, child: Center(child: Text('Tanda tangan di atas garis', style: TextStyle(color: C.mute, fontSize: 11)))),
                          Positioned.fill(child: InkPad(ctl: ink, stylusOnly: false, width: width)),
                        ]),
                      ),
                      const SizedBox(height: 8),
                      Row(children: [
                        OutlinedButton.icon(onPressed: () => setState(ink.undo), icon: const Icon(Icons.undo, size: 16), label: const Text('Urungkan')),
                        const SizedBox(width: 8),
                        OutlinedButton.icon(onPressed: () => setState(ink.clear), icon: const Icon(Icons.close, size: 16), label: const Text('Hapus & ulangi')),
                        const Spacer(),
                        const Text('Tebal pena  ', style: TextStyle(color: C.mute, fontSize: 12)),
                        for (final w in [2.0, 3.5, 5.5]) Padding(padding: const EdgeInsets.only(left: 6), child: GestureDetector(onTap: () => setState(() => width = w), child: Container(width: 28, height: 28, alignment: Alignment.center, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: width == w ? C.green : C.line, width: 2)), child: Container(width: w * 2 + 2, height: w * 2 + 2, decoration: const BoxDecoration(color: Color(0xFF1E3A8A), shape: BoxShape.circle))))),
                      ]),
                      CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, activeColor: C.green, value: consent, onChanged: (v) => setState(() => consent = v ?? false), title: const Text('Saya telah membaca dan menyetujui isi dokumen, dan tanda tangan ini sah sebagai persetujuan saya.', style: TextStyle(fontSize: 13))),
                      Row(children: [
                        const Expanded(child: Text('Waktu, perangkat, dan lokasi tablet dicatat sebagai bukti.', style: TextStyle(color: C.mute, fontSize: 11))),
                        FilledButton.icon(onPressed: busy ? null : _submit, icon: const Icon(Icons.check), label: const Text('Tandatangani Dokumen')),
                      ]),
                    ])),
                  ])),
                ]);
              },
            )),
          ])),
        ),
      );

  Widget _doneView(Map<String, dynamic> d) => Center(
        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 760), child: Panel(child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.check_circle, color: C.green, size: 56),
          const SizedBox(height: 8),
          const Text('Selesai ditandatangani', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
          Text('${d['title']}', style: const TextStyle(color: C.mute)),
          const SizedBox(height: 20),
          Row(children: [
            if (widget.mySignature != null) Expanded(child: _sigBox('PIHAK PERTAMA', child: Center(child: Image.memory(widget.mySignature!)))),
            if (widget.mySignature != null) const SizedBox(width: 16),
            Expanded(child: _sigBox('PIHAK KEDUA', child: Center(child: clientSig != null ? Image.memory(clientSig!) : const Icon(Icons.check_circle, color: C.green, size: 40)))),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            if (widget.mySignature != null) Expanded(child: Text('${widget.myName}\n${widget.myAt ?? ''}', style: const TextStyle(fontSize: 12, color: C.mute))),
            Expanded(child: Text('${d['signerName'] ?? name.text}\n${doneAt ?? tglJam(d['signedAt'])}', style: const TextStyle(fontSize: 12, color: C.mute))),
          ]),
          const SizedBox(height: 20),
          const Text('Terima kasih. Silakan serahkan kembali tablet ini.', style: TextStyle(color: C.mute)),
          const SizedBox(height: 12),
          FilledButton(onPressed: _exit, child: const Text('Kembalikan tablet')),
        ]))),
      );
}
