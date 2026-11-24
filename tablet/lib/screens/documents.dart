import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'doc_editor.dart';
import 'signing.dart';

const _gen = [('Kontrak', 'Nilai, termin, dan ketentuan'), ('Spesifikasi', 'Kebutuhan dan batasan sistem'), ('Laporan UAT', 'Skenario dan hasil uji'), ('BAST', 'Serah terima pekerjaan')];

/// T15 · Daftar Dokumen proyek (tab Dokumen)
class ProjectDocuments extends StatefulWidget {
  final int projectId;
  final List<Map<String, dynamic>> docs;
  final bool canManage;
  final Future<void> Function() onChanged;
  const ProjectDocuments({super.key, required this.projectId, required this.docs, required this.canManage, required this.onChanged});
  @override
  State<ProjectDocuments> createState() => _ProjectDocumentsState();
}

class _ProjectDocumentsState extends State<ProjectDocuments> {
  Key sk = UniqueKey();

  Future<void> open(Map<String, dynamic> d) async {
    if (d['hasContent'] == true) {
      await Navigator.of(context).push(MaterialPageRoute(builder: (_) => DocEditorScreen(docId: n(d['id']).toInt())));
      await widget.onChanged();
    } else if (d['fileUrl'] != null) {
      final u = '${d['fileUrl']}';
      await launchUrl(Uri.parse(u.startsWith('http') ? u : '$kBaseUrl$u'), mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(flex: 3, child: Panel(child: Column(children: [
          if (widget.docs.isEmpty) const Empty('Belum ada dokumen.'),
          for (final d in widget.docs) ListTile(
            contentPadding: EdgeInsets.zero,
            onTap: () => open(d),
            leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: C.greenSoft, borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.description_outlined, color: C.green)),
            title: Text('${d['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text('${d['type']}${d['docNumber'] != null ? ' · ${d['docNumber']}' : ''} · ${tgl(d['createdAt'])}'),
            trailing: Row(mainAxisSize: MainAxisSize.min, children: [Pill.status('${d['status']}'), const Icon(Icons.chevron_right, color: C.mute)]),
          ),
        ]))),
        const SizedBox(width: 12),
        Expanded(flex: 2, child: Column(children: [
          if (widget.canManage) Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const H('Buat dokumen baru'),
            const Text('Mulai dari kerangka siap pakai.', style: TextStyle(color: C.mute, fontSize: 12)),
            const SizedBox(height: 8),
            for (final g in _gen) Padding(padding: const EdgeInsets.only(bottom: 6), child: OutlinedButton(
              style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft, minimumSize: const Size.fromHeight(48)),
              onPressed: () async {
                await guard(context, () async {
                  final r = asMap(await Api.i.post('/api/projects/${widget.projectId}/documents/generate', {'type': g.$1}));
                  if (!mounted) return;
                  await widget.onChanged();
                  if (!mounted) return;
                  await Navigator.of(context).push(MaterialPageRoute(builder: (_) => DocEditorScreen(docId: n(r['id']).toInt())));
                  await widget.onChanged();
                });
              },
              child: Row(children: [const Icon(Icons.add, size: 18), const SizedBox(width: 8), Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(g.$1, style: const TextStyle(fontWeight: FontWeight.w600)), Text(g.$2, style: const TextStyle(fontSize: 11, color: C.mute))])]),
            )),
          ])),
          if (widget.canManage) ...[
            const SizedBox(height: 12),
            Loader<List<Map<String, dynamic>>>(
              key: sk,
              load: () async => asList(await Api.i.get('/api/projects/${widget.projectId}/signatures')),
              builder: (c, sigs, reload) => Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const H('Permintaan tanda tangan'),
                if (sigs.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Belum ada permintaan.', style: TextStyle(color: C.mute))),
                for (final s in sigs.take(6)) ListTile(
                  contentPadding: EdgeInsets.zero, dense: true,
                  title: Text('${s['title']}'),
                  subtitle: Text(s['status'] == 'ditandatangani' ? 'Oleh ${s['signerName']} · ${tglJam(s['signedAt'])}' : 'Berlaku sampai ${tgl(s['expiresAt'])}'),
                  trailing: Pill.status('${s['status']}'),
                  onTap: s['status'] == 'menunggu' && s['link'] != null ? () => Navigator.of(context).push(MaterialPageRoute(fullscreenDialog: true, builder: (_) => ClientModeScreen(token: '${s['link']}'.split('/').last))).then((_) => setState(() => sk = UniqueKey())) : null,
                ),
              ])),
            ),
          ],
        ])),
      ]);
}
