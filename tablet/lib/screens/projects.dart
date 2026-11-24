import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'bug_detail.dart';
import 'documents.dart';
import 'invoice_form.dart';
import 'invoice_detail.dart';

/// T03 · Proyek (daftar + detail dua panel)
class ProjectsScreen extends StatefulWidget {
  const ProjectsScreen({super.key});
  @override
  State<ProjectsScreen> createState() => _ProjectsScreenState();
}

class _ProjectsScreenState extends State<ProjectsScreen> {
  int filter = 0;
  int? selected;
  String q = '';
  final key = GlobalKey<State<StatefulWidget>>();

  @override
  Widget build(BuildContext context) {
    final s = Api.i.session!;
    return Scaffold(
      appBar: TopBar('Proyek', actions: [
        SizedBox(width: 240, height: 40, child: TextField(onChanged: (v) => setState(() => q = v.toLowerCase()), decoration: const InputDecoration(hintText: 'Cari proyek…', prefixIcon: Icon(Icons.search, size: 18)))),
      ]),
      body: Loader<Map<String, dynamic>>(
        load: () async => asMap(await Api.i.get('/api/projects')),
        builder: (c, d, reload) {
          var list = asList(d['projects']);
          final cnt = {'berjalan': 0, 'persiapan': 0};
          for (final p in list) { cnt.update('${p['status']}', (v) => v + 1, ifAbsent: () => 1); }
          final labels = ['Semua · ${list.length}', 'Berjalan · ${cnt['berjalan']}', 'Persiapan · ${cnt['persiapan']}'];
          if (filter == 1) list = list.where((p) => p['status'] == 'berjalan').toList();
          if (filter == 2) list = list.where((p) => p['status'] == 'persiapan').toList();
          if (q.isNotEmpty) list = list.where((p) => '${p['name']} ${p['clientName']}'.toLowerCase().contains(q)).toList();
          final sel = selected ?? (list.isNotEmpty ? n(list.first['id']).toInt() : null);
          return Row(children: [
            SizedBox(
              width: 380,
              child: Column(children: [
                Padding(padding: const EdgeInsets.all(12), child: Align(alignment: Alignment.centerLeft, child: Chips(labels, filter, (i) => setState(() => filter = i)))),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: reload,
                    child: ListView(padding: const EdgeInsets.fromLTRB(12, 0, 12, 12), children: [
                      if (list.isEmpty) const Empty('Tidak ada proyek.'),
                      for (final p in list)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () => setState(() => selected = n(p['id']).toInt()),
                            child: Panel(
                              border: n(p['id']) == sel ? C.green : null,
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [Expanded(child: Text('${p['name']}', style: const TextStyle(fontWeight: FontWeight.w700))), Pill.status('${p['status']}')]),
                                Text('${p['clientName'] ?? ''}', style: const TextStyle(color: C.mute, fontSize: 12)),
                                const SizedBox(height: 10),
                                Row(children: [Expanded(child: Progress(n(p['progress']))), const SizedBox(width: 8), Text('${n(p['progress']).round()}%', style: const TextStyle(fontSize: 12))]),
                                const SizedBox(height: 8),
                                Row(children: [
                                  if (p['paid'] != null) Expanded(child: Text('${rp(p['paid'])}\ndari ${rp(p['contractValue'])}', style: const TextStyle(fontSize: 12))) else const Spacer(),
                                  if (p['openBugs'] != null) Text(n(p['openBugs']) > 0 ? '${p['openBugs']} bug' : 'Tanpa bug', style: TextStyle(color: n(p['criticalBugs']) > 0 ? C.red : C.mute, fontWeight: FontWeight.w600, fontSize: 12)),
                                ]),
                              ]),
                            ),
                          ),
                        ),
                    ]),
                  ),
                ),
              ]),
            ),
            const VerticalDivider(width: 1),
            Expanded(child: sel == null ? const Empty('Pilih proyek.') : ProjectDetail(key: ValueKey(sel), id: sel, canInvoice: s.has('keuangan', ['kelola']))),
          ]);
        },
      ),
    );
  }
}

class ProjectDetail extends StatefulWidget {
  final int id;
  final bool canInvoice;
  const ProjectDetail({super.key, required this.id, required this.canInvoice});
  @override
  State<ProjectDetail> createState() => _ProjectDetailState();
}

class _ProjectDetailState extends State<ProjectDetail> {
  int tab = 0;
  @override
  Widget build(BuildContext context) => Loader<Map<String, dynamic>>(
        load: () async => asMap(await Api.i.get('/api/projects/${widget.id}')),
        builder: (c, d, reload) {
          final p = asMap(d['project']);
          final can = asMap(d['can']);
          final fin = d['finance'] == null ? null : asMap(d['finance']);
          final terms = fin == null ? <Map<String, dynamic>>[] : asList(fin['terms']);
          final exps = fin == null ? <Map<String, dynamic>>[] : asList(fin['expenses']);
          final bugs = asList(d['bugs']);
          final members = asList(d['members']);
          final docs = asList(d['documents']);
          final labels = ['Ringkasan', if (fin != null) 'Pembayaran', if (fin != null) 'Pengeluaran', if (can['bugs'] == true) 'Bug · ${bugs.length}', if (can['team'] == true) 'Tim', if (can['team'] == true) 'Dokumen · ${docs.length}'];
          final names = [for (final l in labels) l.split(' ·').first];
          final cur = names[tab.clamp(0, names.length - 1)];
          Widget body;
          switch (cur) {
            case 'Pembayaran':
              final paid = n(fin!['paid']), total = n(p['contractValue']);
              body = Column(children: [
                KpiRow([Kpi('Nilai kontrak', rp(total)), Kpi('Sudah dibayar', rp(paid), sub: total > 0 ? '${(paid / total * 100).round()}% dari kontrak' : '', valueColor: C.green), Kpi('Sisa tagihan', rp(total - paid))]),
                const SizedBox(height: 12),
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const H('Termin Pembayaran Klien'),
                  for (final t in terms) ListTile(
                    contentPadding: EdgeInsets.zero,
                    onTap: t['invoice'] == null ? null : () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => InvoiceDetailScreen(id: n(asMap(t['invoice'])['id']).toInt()))),
                    title: Text('${t['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text('Jatuh tempo ${tgl(asMap(t['invoice'])['dueDate'] ?? t['dueDate'])}${t['invoice'] != null ? ' · ${asMap(t['invoice'])['number']}' : ''}'),
                    trailing: Row(mainAxisSize: MainAxisSize.min, children: [Text(rp(t['amount']), style: const TextStyle(fontWeight: FontWeight.w700)), const SizedBox(width: 10), Pill.status('${t['displayStatus'] ?? t['status']}')]),
                  ),
                ])),
              ]);
            case 'Pengeluaran':
              body = Panel(child: Column(children: [
                if (exps.isEmpty) const Empty('Belum ada pengeluaran.'),
                for (final e in exps) ListTile(contentPadding: EdgeInsets.zero, title: Text('${e['description']}'), subtitle: Text('${tgl(e['date'])} · ${e['category']}'), trailing: Text(rp(e['amount']), style: const TextStyle(fontWeight: FontWeight.w700))),
              ]));
            case 'Bug':
              body = Panel(child: Column(children: [
                if (bugs.isEmpty) const Empty('Tidak ada bug.'),
                for (final b in bugs) ListTile(
                  contentPadding: EdgeInsets.zero,
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => BugDetailScreen(id: n(b['id']).toInt()))),
                  title: Text('${b['code']} · ${b['title']}'),
                  subtitle: Text('${b['assigneeName'] ?? 'Belum ditugaskan'}'),
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [Pill.status('${b['severity']}'), const SizedBox(width: 6), Pill.status('${b['status']}')]),
                ),
              ]));
            case 'Tim':
              body = Panel(child: Column(children: [
                for (final m in members) ListTile(contentPadding: EdgeInsets.zero, leading: Avatar(initialsOf('${m['name']}'), color: hexColor(m['avatarColor'])), title: Text('${m['name']}'), subtitle: Text('${m['roleInProject'] ?? m['role'] ?? ''}')),
              ]));
            case 'Dokumen':
              body = ProjectDocuments(projectId: widget.id, docs: docs, canManage: can['manageDocs'] == true, onChanged: reload);
            default:
              body = Column(children: [
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const H('Ringkasan'),
                  const SizedBox(height: 8),
                  Row2('Klien', '${asMap(d['client'])['name'] ?? '—'}'),
                  Row2('Penanggung jawab', '${asMap(d['pic'])['name'] ?? '—'}'),
                  Row2('Mulai', tgl(p['startDate'])),
                  Row2('Target selesai', tgl(p['targetDate'])),
                  Row2('Nilai kontrak', rp(p['contractValue'])),
                ])),
                const SizedBox(height: 12),
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const H('Milestone'),
                  for (final m in asList(d['milestones'])) ListTile(contentPadding: EdgeInsets.zero, dense: true, leading: Icon(m['done'] == true ? Icons.check_circle : Icons.radio_button_unchecked, color: m['done'] == true ? C.green : C.mute), title: Text('${m['name'] ?? m['title'] ?? ''}'), subtitle: Text(tgl(m['dueDate'] ?? m['targetDate']))),
                ])),
              ]);
          }
          return ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [
              Expanded(child: Text('${p['name']}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700))),
              Pill.status('${p['status']}'),
              if (widget.canInvoice) ...[const SizedBox(width: 12), FilledButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => InvoiceFormScreen(projectId: widget.id))), child: const Text('Buat Invoice'))],
            ]),
            const SizedBox(height: 10),
            Row(children: [Expanded(child: Progress(n(p['progress']))), const SizedBox(width: 10), Text('${n(p['progress']).round()}%', style: const TextStyle(fontWeight: FontWeight.w700))]),
            const SizedBox(height: 8),
            Container(decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.line))), child: Tabs(labels, tab.clamp(0, labels.length - 1), (i) => setState(() => tab = i))),
            const SizedBox(height: 12),
            body,
          ]);
        },
      );
}
