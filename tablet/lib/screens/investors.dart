import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

/// T07 · Investor & Modal
class InvestorsScreen extends StatefulWidget {
  const InvestorsScreen({super.key});
  @override
  State<InvestorsScreen> createState() => _InvestorsScreenState();
}

class _InvestorsScreenState extends State<InvestorsScreen> {
  Key k = UniqueKey();

  void deposit(Map<String, dynamic> inv) {
    final amount = TextEditingController();
    final purpose = TextEditingController();
    showDialog<void>(context: context, builder: (ctx) => AlertDialog(
      title: Text('Setoran modal · ${inv['name']}'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: amount, keyboardType: TextInputType.number, inputFormatters: [ThousandsFormatter()], decoration: const InputDecoration(labelText: 'Nominal', prefixText: 'Rp ')),
        const SizedBox(height: 12),
        TextField(controller: purpose, decoration: const InputDecoration(labelText: 'Peruntukan')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
        FilledButton(onPressed: () async {
          Navigator.pop(ctx);
          await guard(context, () async {
            await Api.i.post('/api/capital-deposits', {'investorId': inv['investorId'] ?? inv['id'], 'date': DateTime.now().toIso8601String().substring(0, 10), 'amount': parseMoney(amount.text), 'purpose': purpose.text.isEmpty ? null : purpose.text});
            setState(() => k = UniqueKey());
          }, ok: 'Setoran dicatat.');
        }, child: const Text('Simpan')),
      ],
    ));
  }

  @override
  Widget build(BuildContext context) {
    final manage = Api.i.session!.has('investor', ['kelola']);
    return Scaffold(
      appBar: const TopBar('Investor & Modal'),
      body: Loader<Map<String, dynamic>>(
        key: k,
        load: () async => asMap(await Api.i.get('/api/investors')),
        builder: (c, d, reload) {
          final s = asMap(d['summary']);
          final invs = asList(d['investors']);
          final deps = asList(d['deposits']);
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              KpiRow([
                Kpi('Total modal disetor', rp(s['totalCapital']), sub: '${s['activeInvestors'] ?? 0} investor aktif · ${s['prospects'] ?? 0} calon'),
                Kpi('Kas OCN tersedia', rp(s['cash'])),
                Kpi('Bagi hasil dibayarkan', rp(s['totalPayout'])),
                Kpi('Investor', '${invs.length}', sub: 'Terdaftar'),
              ]),
              const SizedBox(height: 12),
              Wrap(spacing: 12, runSpacing: 12, children: [
                for (final i in invs) SizedBox(
                  width: (MediaQuery.of(context).size.width - 84 - 32 - 12) / 2,
                  child: Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Avatar(initialsOf('${i['name']}'), size: 40, color: hexColor(i['avatarColor'], C.purple)),
                      const SizedBox(width: 10),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${i['name']}', style: const TextStyle(fontWeight: FontWeight.w700)), Text('${i['email'] ?? ''}', style: const TextStyle(color: C.mute, fontSize: 12))])),
                      Pill.status('${i['status']}'),
                      if (manage) IconButton(onPressed: () => deposit(i), icon: const Icon(Icons.add_circle_outline), tooltip: 'Setoran'),
                    ]),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: _m('Modal disetor', rp(i['capital']))),
                      Expanded(child: _m('Porsi modal', '${n(i['percent'] ?? i['portion'] ?? 0).round()}%')),
                      Expanded(child: _m('Bagi hasil', rp(i['payout']))),
                    ]),
                  ])),
                ),
              ]),
              const SizedBox(height: 12),
              const H('Riwayat Setoran Modal'),
              const SizedBox(height: 8),
              deps.isEmpty
                  ? const Panel(child: Empty('Belum ada setoran.'))
                  : AppTable(
                      head: const ['Tanggal', 'Investor', 'Peruntukan', 'Nominal'],
                      flex: const [2, 3, 4, 2],
                      right: const [3],
                      rows: [for (final x in deps) [tgl(x['date']), '${x['name']}', '${x['purpose'] ?? '—'}', rp(x['amount'])]],
                    ),
            ]),
          );
        },
      ),
    );
  }

  Widget _m(String k, String v) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(k, style: const TextStyle(color: C.mute, fontSize: 11)), Text(v, style: const TextStyle(fontWeight: FontWeight.w700))]);
}
