import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'invoice_form.dart';
import 'invoice_detail.dart';

/// T04 · Pembayaran
class PaymentsScreen extends StatefulWidget {
  const PaymentsScreen({super.key});
  @override
  State<PaymentsScreen> createState() => _PaymentsScreenState();
}

class _PaymentsScreenState extends State<PaymentsScreen> {
  int filter = 0;
  Key reloadKey = UniqueKey();

  Future<Map<String, dynamic>> _load() async {
    final r = await Future.wait([Api.i.get('/api/invoices'), Api.i.get('/api/finance/summary')]);
    return {'inv': asMap(r[0]), 'sum': asMap(r[1])};
  }

  void _pay(Map<String, dynamic> inv) {
    final amount = TextEditingController(text: '${(n(inv['total']) - n(inv['paid'])).round()}');
    final method = TextEditingController(text: 'Transfer bank');
    showDialog<void>(context: context, builder: (ctx) => AlertDialog(
      title: Text('Catat pembayaran ${inv['number']}'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: amount, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Nominal (Rp)')),
        const SizedBox(height: 12),
        TextField(controller: method, decoration: const InputDecoration(labelText: 'Metode')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
        FilledButton(onPressed: () async {
          Navigator.pop(ctx);
          await guard(context, () async {
            await Api.i.post('/api/payments', {'invoiceId': inv['id'], 'amount': int.tryParse(amount.text) ?? 0, 'date': DateTime.now().toIso8601String().substring(0, 10), 'method': method.text});
            setState(() => reloadKey = UniqueKey());
          }, ok: 'Pembayaran dicatat.');
        }, child: const Text('Simpan')),
      ],
    ));
  }

  @override
  Widget build(BuildContext context) {
    final canManage = Api.i.session!.has('keuangan', ['kelola']);
    return Scaffold(
      appBar: TopBar('Pembayaran', actions: [if (canManage) topBtn('Buat Invoice', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const InvoiceFormScreen())), icon: Icons.add, primary: true)]),
      body: Loader<Map<String, dynamic>>(
        key: reloadKey,
        load: _load,
        builder: (c, d, reload) {
          final s = asMap(d['sum']);
          final inv = asList(asMap(d['inv'])['invoices']);
          final unbilled = asList(asMap(d['inv'])['unbilled']);
          final aging = asList(s['aging']);
          var list = inv;
          if (filter == 1) list = inv.where((i) => i['displayStatus'] == 'terkirim' || i['displayStatus'] == 'draf').toList();
          if (filter == 2) list = inv.where((i) => i['displayStatus'] == 'terlambat').toList();
          if (filter == 3) list = inv.where((i) => i['displayStatus'] == 'lunas').toList();
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.all(16), children: [
              KpiRow([
                Kpi('Piutang klien', rp(s['receivables'])),
                Kpi('Lewat jatuh tempo', rp(s['overdue']), sub: '${s['overdueCount'] ?? 0} invoice', valueColor: C.red),
                Kpi('Pemasukan diterima', rp(s['revenue'])),
                Kpi('Saldo kas OCN', rp(s['balance']), sub: 'Pengeluaran ${rp(s['expenses'])}'),
              ]),
              const SizedBox(height: 12),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(flex: 3, child: Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const H('Invoice & Termin'),
                  const SizedBox(height: 10),
                  Chips(const ['Semua', 'Belum lunas', 'Terlambat', 'Lunas'], filter, (i) => setState(() => filter = i)),
                  const SizedBox(height: 6),
                  if (list.isEmpty) const Empty('Belum ada invoice.'),
                  for (final i in list) ListTile(
                    contentPadding: EdgeInsets.zero,
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => InvoiceDetailScreen(id: n(i['id']).toInt()))).then((_) => setState(() => reloadKey = UniqueKey())),
                    title: Text('${i['number']}', style: const TextStyle(color: C.green, fontWeight: FontWeight.w700)),
                    subtitle: Text('${i['projectName']} · ${i['termName'] ?? ''}\nJatuh tempo ${tgl(i['dueDate'])}'),
                    isThreeLine: true,
                    trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                      Text(rp(i['total']), style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(width: 10),
                      Pill.status('${i['displayStatus']}'),
                      if (canManage && i['displayStatus'] != 'lunas' && i['displayStatus'] != 'batal' && i['displayStatus'] != 'draf') IconButton(tooltip: 'Catat pembayaran', icon: const Icon(Icons.payments_outlined), onPressed: () => _pay(i)),
                    ]),
                  ),
                ]))),
                const SizedBox(width: 12),
                Expanded(flex: 2, child: Column(children: [
                  Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const H('Umur Piutang'),
                    const SizedBox(height: 8),
                    for (final a in aging) Row2('${a['label']}', rp(a['amount'])),
                  ])),
                  const SizedBox(height: 12),
                  Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const H('Termin belum ditagih'),
                    if (unbilled.isEmpty) const Empty('Semua termin sudah ditagih.'),
                    for (final t in unbilled.take(6)) ListTile(contentPadding: EdgeInsets.zero, dense: true, title: Text('${t['projectName']}'), subtitle: Text('${t['termName']} · ${tgl(t['dueDate'])}'), trailing: Text(rp(t['amount']), style: const TextStyle(fontWeight: FontWeight.w700))),
                  ])),
                ])),
              ]),
            ]),
          );
        },
      ),
    );
  }
}
