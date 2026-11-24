import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'bug_detail.dart';

/// T10 · Tugas Saya (peran Developer)
class TasksScreen extends StatefulWidget {
  const TasksScreen({super.key});
  @override
  State<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends State<TasksScreen> {
  int f = 0;
  Key k = UniqueKey();
  Future<void> move(Map<String, dynamic> b, String status) => guard(context, () async { await Api.i.patch('/api/bugs/${b['id']}', {'status': status}); setState(() => k = UniqueKey()); });

  @override
  Widget build(BuildContext context) {
    final me = Api.i.session!.user['id'];
    return Scaffold(
      appBar: const TopBar('Tugas Saya'),
      body: Loader<Map<String, dynamic>>(
        key: k,
        load: () async => {'bugs': await Api.i.get('/api/bugs'), 'projects': Api.i.session!.has('proyek', ['lihat', 'kelola']) ? (await Api.i.get('/api/projects'))['projects'] : []},
        builder: (c, d, reload) {
          final all = asList(d['bugs']).where((b) => b['assigneeId'] == me).toList();
          final act = all.where((b) => b['status'] != 'selesai').toList();
          final list = [act, all.where((b) => b['status'] == 'selesai').toList(), all, all.where((b) => b['status'] == 'open').toList(), all.where((b) => b['status'] == 'dikerjakan').toList(), all.where((b) => b['status'] == 'review').toList()];
          final labels = ['Aktif · ${act.length}', 'Selesai · ${list[1].length}', 'Semua', 'Open · ${list[3].length}', 'Dikerjakan · ${list[4].length}', 'Review · ${list[5].length}'];
          return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(flex: 3, child: ListView(padding: const EdgeInsets.all(16), children: [
              Chips(labels, f, (i) => setState(() => f = i)),
              const SizedBox(height: 12),
              if (list[f].isEmpty) const Empty('Tidak ada tugas.'),
              for (final b in list[f]) Padding(padding: const EdgeInsets.only(bottom: 10), child: Panel(child: InkWell(
                onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => BugDetailScreen(id: n(b['id']).toInt()))).then((_) => reload()),
                child: Row(children: [
                  Container(width: 4, height: 56, color: b['severity'] == 'kritis' ? C.red : C.amber),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [Text('${b['code']}', style: const TextStyle(color: C.mute, fontWeight: FontWeight.w600, fontSize: 12)), const SizedBox(width: 8), Pill.status('${b['severity']}'), const SizedBox(width: 6), Pill.status('${b['status']}')]),
                    const SizedBox(height: 6),
                    Text('${b['title']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text('${b['projectName']} · target ${tgl(b['targetDate'])}', style: const TextStyle(color: C.mute, fontSize: 12)),
                  ])),
                  if (b['status'] == 'open') FilledButton(onPressed: () => move(b, 'dikerjakan'), child: const Text('Mulai kerjakan')),
                  if (b['status'] == 'dikerjakan') OutlinedButton(onPressed: () => move(b, 'review'), child: const Text('Kirim ke Review')),
                  if (b['status'] == 'review') const Text('Menunggu review', style: TextStyle(color: C.mute)),
                ]),
              ))),
            ])),
            SizedBox(width: 340, child: ListView(padding: const EdgeInsets.fromLTRB(0, 16, 16, 16), children: [
              Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const H('Proyek saya'),
                const SizedBox(height: 8),
                for (final p in asList(d['projects'])) Padding(padding: const EdgeInsets.only(bottom: 12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [Expanded(child: Text('${p['name']}', style: const TextStyle(color: C.green, fontWeight: FontWeight.w600))), Pill.status('${p['status']}')]),
                  const SizedBox(height: 4),
                  Row(children: [Expanded(child: Progress(n(p['progress']))), const SizedBox(width: 6), Text('${n(p['progress']).round()}%', style: const TextStyle(fontSize: 12))]),
                ])),
              ])),
            ])),
          ]);
        },
      ),
    );
  }
}
