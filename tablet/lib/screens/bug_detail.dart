import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

/// T06 · Detail Bug
class BugDetailScreen extends StatefulWidget {
  final int id;
  const BugDetailScreen({super.key, required this.id});
  @override
  State<BugDetailScreen> createState() => _BugDetailScreenState();
}

class _BugDetailScreenState extends State<BugDetailScreen> {
  final comment = TextEditingController();
  Key k = UniqueKey();
  void refresh() => setState(() => k = UniqueKey());

  Future<void> patch(Map<String, dynamic> body) => guard(context, () async { await Api.i.patch('/api/bugs/${widget.id}', body); refresh(); });

  @override
  Widget build(BuildContext context) => Loader<Map<String, dynamic>>(
        key: k,
        load: () async => asMap(await Api.i.get('/api/bugs/${widget.id}')),
        builder: (c, d, _) {
          final b = asMap(d['bug']);
          final can = asMap(d['can']);
          final comments = asList(d['comments']);
          final check = asList(b['checklist']);
          final done = check.where((e) => e['done'] == true).length;
          final assignable = asList(d['assignable']);
          return Scaffold(
            appBar: TopBar('${b['code']}', back: true),
            body: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(flex: 3, child: ListView(padding: const EdgeInsets.all(16), children: [
                Text('${b['title']}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Wrap(spacing: 6, children: [Pill('${b['type']}', fg: C.red, bg: C.redSoft), Pill.status('${b['severity']}'), Pill.status('${b['status']}'), if (b['blocksTerm'] == true) const Pill('Menghambat termin', fg: Color(0xFFB45309), bg: C.amberSoft)]),
                const SizedBox(height: 12),
                if ('${b['description'] ?? ''}'.isNotEmpty) Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const H('Deskripsi'), const SizedBox(height: 6), Text('${b['description']}')])),
                if (check.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    H('Checklist', trailing: Text('$done/${check.length}', style: const TextStyle(color: C.mute))),
                    const SizedBox(height: 6),
                    Progress(check.isEmpty ? 0 : done / check.length * 100),
                    for (var i = 0; i < check.length; i++) CheckboxListTile(
                      dense: true, contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, activeColor: C.green,
                      value: check[i]['done'] == true, title: Text('${check[i]['text']}'),
                      onChanged: can['changeStatus'] == true ? (v) { final nl = [for (final e in check) {'text': e['text'], 'done': e['done']}]; nl[i]['done'] = v; patch({'checklist': nl}); } : null,
                    ),
                  ])),
                ],
                if ('${b['expected'] ?? ''}${b['actual'] ?? ''}'.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: Panel(color: C.greenSoft, border: C.greenSoft, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Seharusnya', style: TextStyle(fontWeight: FontWeight.w700, color: C.green)), Text('${b['expected'] ?? '—'}')]))),
                    const SizedBox(width: 12),
                    Expanded(child: Panel(color: C.redSoft, border: C.redSoft, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('Kenyataan', style: TextStyle(fontWeight: FontWeight.w700, color: C.red)), Text('${b['actual'] ?? '—'}')]))),
                  ]),
                ],
                const SizedBox(height: 12),
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const H('Aktivitas & Komentar'),
                  const SizedBox(height: 8),
                  for (final m in comments) ListTile(contentPadding: EdgeInsets.zero, leading: Avatar(initialsOf('${m['userName']}'), color: hexColor(m['avatarColor'])), title: Text('${m['body']}'), subtitle: Text('${m['userName'] ?? 'Sistem'} · ${tglJam(m['createdAt'])}')),
                  if (can['comment'] == true) Row(children: [
                    Expanded(child: TextField(controller: comment, decoration: const InputDecoration(hintText: 'Tulis komentar…'))),
                    const SizedBox(width: 8),
                    IconButton.filled(style: IconButton.styleFrom(backgroundColor: C.green), icon: const Icon(Icons.send), onPressed: () async {
                      if (comment.text.trim().isEmpty) return;
                      await guard(context, () async { await Api.i.post('/api/bugs/${widget.id}/comments', {'body': comment.text.trim()}); comment.clear(); refresh(); });
                    }),
                  ]),
                ])),
              ])),
              SizedBox(width: 340, child: ListView(padding: const EdgeInsets.fromLTRB(0, 16, 16, 16), children: [
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  DropdownButtonFormField<String>(initialValue: '${b['status']}', decoration: const InputDecoration(labelText: 'Status'), items: [for (final s in ['open', 'dikerjakan', 'review', 'selesai']) DropdownMenuItem(value: s, child: Text(s[0].toUpperCase() + s.substring(1)))], onChanged: can['changeStatus'] == true ? (v) => patch({'status': v}) : null),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int?>(initialValue: assignable.any((u) => n(u['id']) == b['assigneeId']) ? n(b['assigneeId']).toInt() : null, decoration: const InputDecoration(labelText: 'Ditugaskan ke'), items: [const DropdownMenuItem(value: null, child: Text('Belum ditugaskan')), for (final u in assignable) DropdownMenuItem(value: n(u['id']).toInt(), child: Text('${u['name']}'))], onChanged: can['editAll'] == true ? (v) => patch({'assigneeId': v}) : null),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(initialValue: '${b['severity']}', decoration: const InputDecoration(labelText: 'Keparahan'), items: [for (final s in ['kritis', 'tinggi', 'sedang', 'rendah']) DropdownMenuItem(value: s, child: Text(s[0].toUpperCase() + s.substring(1)))], onChanged: can['editAll'] == true ? (v) => patch({'severity': v}) : null),
                  const SizedBox(height: 12),
                  Row2('Proyek', '${asMap(d['project'])['name'] ?? ''}'),
                  Row2('Dilaporkan oleh', '${b['reporter'] ?? '—'}'),
                  Row2('Target selesai', tgl(b['targetDate'])),
                ])),
                if (asList(d['terms']).isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Panel(color: C.amberSoft, border: C.amberSoft, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Terkait pembayaran', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFFB45309))),
                    for (final t in asList(d['terms'])) Text('${t['name']} ${rp(t['amount'])} (jatuh tempo ${tgl(t['dueDate'])}) menunggu perbaikan.'),
                  ])),
                ],
              ])),
            ]),
          );
        },
      );
}
