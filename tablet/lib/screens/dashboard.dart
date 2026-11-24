import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

/// Grafik batang arus kas bulanan (pemasukan & pengeluaran).
class CashflowChart extends StatelessWidget {
  final List<Map<String, dynamic>> data;
  const CashflowChart(this.data, {super.key});
  @override
  Widget build(BuildContext context) => SizedBox(height: 200, child: CustomPaint(painter: _CfPainter(data), size: Size.infinite));
}

class _CfPainter extends CustomPainter {
  final List<Map<String, dynamic>> d;
  _CfPainter(this.d);
  static const _m = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  @override
  void paint(Canvas c, Size s) {
    if (d.isEmpty) return;
    final mx = d.fold<num>(1, (a, e) => [a, n(e['income']), n(e['expense'])].reduce((x, y) => x > y ? x : y)).toDouble();
    final slot = s.width / d.length;
    final bw = (slot * .28).clamp(6.0, 28.0);
    final base = s.height - 22;
    for (var i = 0; i < d.length; i++) {
      final x = i * slot + slot / 2;
      final hi = n(d[i]['income']) / mx * (base - 6), he = n(d[i]['expense']) / mx * (base - 6);
      c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x - bw - 1, base - hi, bw, hi), const Radius.circular(3)), Paint()..color = C.green);
      c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(x + 1, base - he, bw, he), const Radius.circular(3)), Paint()..color = const Color(0xFFF59E0B));
      final mo = int.tryParse('${d[i]['month']}'.split('-').last) ?? 1;
      final tp = TextPainter(text: TextSpan(text: _m[(mo - 1).clamp(0, 11)], style: const TextStyle(color: C.mute, fontSize: 11)), textDirection: TextDirection.ltr)..layout();
      tp.paint(c, Offset(x - tp.width / 2, base + 4));
    }
  }
  @override
  bool shouldRepaint(_CfPainter o) => o.d != d;
}

/// T02 · Dashboard Investor
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const TopBar('Dashboard Investor'),
        body: Loader<Map<String, dynamic>>(
          load: () async => asMap(await Api.i.get('/api/dashboard')),
          builder: (c, d, reload) {
            final k = asMap(d['kpis']);
            final flows = asList(d['cashflow']);
            final usage = asList(d['usage']);
            final projects = asList(d['projects']);
            final dists = asList(d['distributions']);
            final totalUsage = usage.fold<num>(0, (a, e) => a + n(e['amount']));
            const cols = [C.green, C.blue, C.purple, C.amber, Color(0xFFD1D5DB)];
            return RefreshIndicator(
              onRefresh: reload,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                KpiRow([
                  Kpi('Modal Investor Disetor', rp(k['capital']), sub: '${k['capitalCount'] ?? 0} setoran · sejak ${tgl(k['capitalSince'])}'),
                  Kpi('Nilai Kontrak Aktif', rpShort(n(k['activeContract'])), sub: '${k['activeCount'] ?? 0} proyek berjalan'),
                  Kpi('Kas Operasional Tersisa', rp(k['cash']), sub: '${k['cashPctOfCapital'] ?? 0}% dari modal'),
                  Kpi('Bagi Hasil Diterima', rp(k['payouts']), sub: '${k['payoutCount'] ?? 0} distribusi · ${k['payoutPctOfCapital'] ?? 0}% dari modal'),
                ]),
                const SizedBox(height: 12),
                IntrinsicHeight(
                  child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Expanded(flex: 3, child: Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      H('Arus Kas Bulanan', trailing: const Row(children: [Icon(Icons.circle, size: 9, color: C.green), SizedBox(width: 4), Text('Pemasukan  ', style: TextStyle(fontSize: 11)), Icon(Icons.circle, size: 9, color: Color(0xFFF59E0B)), SizedBox(width: 4), Text('Pengeluaran', style: TextStyle(fontSize: 11))])),
                      const SizedBox(height: 12),
                      flows.isEmpty ? const Empty('Belum ada arus kas pada periode ini.') : CashflowChart(flows),
                    ]))),
                    const SizedBox(width: 12),
                    Expanded(flex: 2, child: Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const H('Penggunaan Modal'),
                      const SizedBox(height: 10),
                      if (totalUsage > 0) ClipRRect(borderRadius: BorderRadius.circular(4), child: Row(children: [
                        for (var i = 0; i < usage.length; i++) Expanded(flex: (n(usage[i]['amount']) / totalUsage * 1000).round().clamp(1, 1000), child: Container(height: 9, color: cols[i % cols.length])),
                      ])),
                      const SizedBox(height: 12),
                      for (var i = 0; i < usage.length; i++) Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [
                        Icon(Icons.circle, size: 9, color: cols[i % cols.length]), const SizedBox(width: 8),
                        Expanded(child: Text('${usage[i]['label']}', style: const TextStyle(fontSize: 13))),
                        Text('${rp(usage[i]['amount'])} · ${totalUsage > 0 ? (n(usage[i]['amount']) / totalUsage * 100).round() : 0}%', style: const TextStyle(fontSize: 12, color: C.mute)),
                      ])),
                    ]))),
                  ]),
                ),
                const SizedBox(height: 12),
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const H('Proyek yang Didanai'),
                  const SizedBox(height: 8),
                  if (projects.isEmpty) const Empty('Belum ada proyek yang didanai.'),
                  for (final p in projects) Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(children: [
                    Expanded(flex: 3, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${p['name']}', style: const TextStyle(color: C.green, fontWeight: FontWeight.w600)),
                      Text('${p['client'] ?? ''}', style: const TextStyle(color: C.mute, fontSize: 12)),
                    ])),
                    Expanded(flex: 3, child: Row(children: [Expanded(child: Progress(n(p['progress']))), const SizedBox(width: 8), Text('${n(p['progress']).round()}%')])),
                    Expanded(flex: 2, child: Text('${rp(p['paid'])}\ndari ${rp(p['contractValue'])}', textAlign: TextAlign.right, style: const TextStyle(fontSize: 12))),
                    Expanded(flex: 2, child: Text(n(p['openBugs']) > 0 ? '${p['openBugs']} terbuka' : '0', textAlign: TextAlign.center)),
                    Expanded(flex: 2, child: Align(child: Pill.status('${p['status']}'))),
                  ])),
                ])),
                if (dists.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const H('Distribusi Terakhir'),
                    for (final x in dists) ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text('${x['project']}'), subtitle: Text(tgl(x['date'])), trailing: Text(rp(x['share']), style: const TextStyle(fontWeight: FontWeight.w700))),
                  ])),
                ],
              ]),
            );
          },
        ),
      );
}
