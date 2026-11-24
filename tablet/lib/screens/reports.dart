import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'dashboard.dart';

/// T08 · Laporan
class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});
  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  int tab = 0;
  static const tabs = ['Ringkasan', 'Laba Rugi', 'Piutang', 'Arus Kas', 'Per Proyek', 'Bug'];

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const TopBar('Laporan'),
        body: Loader<Map<String, dynamic>>(
          load: () async => asMap(await Api.i.get('/api/reports')),
          builder: (c, d, reload) {
            final k = asMap(d['kpis']);
            final pnl = asList(d['pnl']);
            final cats = asList(d['categories']).where((e) => e['isAsset'] != true).toList();
            final maxCat = cats.fold<num>(1, (a, e) => n(e['total']) > a ? n(e['total']) : a);
            final aging = asList(d['aging']);
            final recv = asList(d['receivables']);
            final bugs = asList(d['bugs']);
            final flows = asList(d['cashflow']);
            Widget table(List<String> head, List<List<String>> rows, {List<int> right = const []}) => AppTable(
                  head: head,
                  right: right,
                  rows: [for (final r in rows) [for (var i = 0; i < r.length; i++) (head[i] == 'Status' ? Pill.status(r[i]) : r[i])]],
                );
            Widget body;
            switch (tab) {
              case 1:
                body = table(['Proyek', 'Pendapatan', 'Beban', 'Laba bersih', 'Margin'],
                    [for (final p in pnl) ['${p['name']}', rp(p['revenue']), rp(p['expenses']), rp(p['profit']), '${p['margin']}%']], right: [1, 2, 3, 4]);
              case 2:
                body = Column(children: [
                  Panel(child: Column(children: [for (final a in aging) Row2('${a['label']}', rp(a['amount']))])),
                  const SizedBox(height: 12),
                  table(['Proyek', 'Termin', 'Sisa tagihan'], [for (final r in recv) ['${r['projectName'] ?? r['project'] ?? ''}', '${r['termName'] ?? r['term'] ?? ''}', rp(r['outstanding'])]], right: [2]),
                ]);
              case 3:
                body = flows.isEmpty ? const Empty('Belum ada data.') : Panel(child: CashflowChart(flows));
              case 4:
                body = table(['Proyek', 'Status', 'Kontrak', 'Pendapatan', 'Laba'], [for (final p in pnl) ['${p['name']}', '${p['status']}', rp(p['contractValue']), rp(p['revenue']), rp(p['profit'])]], right: [2, 3, 4]);
              case 5:
                body = table(['Proyek', 'Terbuka', 'Kritis', 'Selesai', 'Rerata hari'], [for (final b in bugs) ['${b['name']}', '${b['open']}', '${b['critical']}', '${b['done']}', '${b['avgDays'] ?? '—'}']], right: [1, 2, 3, 4]);
              default:
                body = Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(flex: 3, child: table(['Proyek', 'Pendapatan', 'Beban', 'Laba Bersih', 'Margin'], [
                    for (final p in pnl) ['${p['name']}', rp(p['revenue']), rp(p['expenses']), rp(p['profit']), '${p['margin']}%'],
                    ['Total', rp(k['revenue']), rp(k['expenses']), rp(k['profit']), '${k['margin']}%'],
                  ], right: [1, 2, 3, 4])),
                  const SizedBox(width: 12),
                  Expanded(flex: 2, child: Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const H('Pengeluaran per Kategori'),
                    const SizedBox(height: 10),
                    for (final e in cats.take(8)) Padding(padding: const EdgeInsets.only(bottom: 10), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [Expanded(child: Text('${e['category']}', style: const TextStyle(fontSize: 13))), Text(rp(e['total']), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))]),
                      const SizedBox(height: 4),
                      Progress(n(e['total']) / maxCat * 100),
                    ])),
                  ]))),
                ]);
            }
            return RefreshIndicator(
              onRefresh: reload,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                Container(decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: C.line))), child: Tabs(tabs, tab, (i) => setState(() => tab = i))),
                const SizedBox(height: 12),
                KpiRow([
                  Kpi('Pendapatan diterima', rp(k['revenue']), sub: 'Tahun ini'),
                  Kpi('Laba bersih', rp(k['profit']), sub: 'Margin ${k['margin'] ?? 0}%', valueColor: C.green),
                  Kpi('Saldo kas akhir', rp(k['cash'])),
                  Kpi('Piutang klien', rp(k['receivables']), sub: 'Per hari ini'),
                ]),
                const SizedBox(height: 12),
                body,
              ]),
            );
          },
        ),
      );
}
