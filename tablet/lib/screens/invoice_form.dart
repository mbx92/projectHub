import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

class _Item {
  final desc = TextEditingController();
  final qty = TextEditingController(text: '1');
  final price = TextEditingController();
  num get total => (num.tryParse(qty.text) ?? 0) * parseMoney(price.text);
}

/// T09 · Buat Invoice
class InvoiceFormScreen extends StatefulWidget {
  final int? projectId;
  const InvoiceFormScreen({super.key, this.projectId});
  @override
  State<InvoiceFormScreen> createState() => _InvoiceFormScreenState();
}

class _InvoiceFormScreenState extends State<InvoiceFormScreen> {
  int? projectId, termId, bankId;
  bool qris = false, busy = false;
  late DateTime issue = DateTime.now(), due = DateTime.now().add(const Duration(days: 14));
  final items = <_Item>[_Item()];
  final notes = TextEditingController();
  List<Map<String, dynamic>> terms = [];

  String iso(DateTime d) => d.toIso8601String().substring(0, 10);
  num get subtotal => items.fold<num>(0, (a, e) => a + e.total);

  Future<void> save(bool send) async {
    if (termId == null) { toast(context, 'Pilih termin yang akan ditagih.', error: true); return; }
    setState(() => busy = true);
    await guard(context, () async {
      final r = await Api.i.post('/api/invoices', {
        'termId': termId, 'issueDate': iso(issue), 'dueDate': iso(due),
        'items': [for (final i in items) {'description': i.desc.text, 'qty': num.tryParse(i.qty.text) ?? 0, 'price': parseMoney(i.price.text)}],
        'discount': 0, 'taxPercent': 0, 'notes': notes.text.isEmpty ? null : notes.text, 'bankAccountId': bankId, 'showQris': qris,
      });
      if (send) await Api.i.post('/api/invoices/${asMap(r)['id']}/send', {});
      if (mounted) { toast(context, send ? 'Invoice dikirim.' : 'Draf invoice disimpan.'); Navigator.pop(context); }
    });
    if (mounted) setState(() => busy = false);
  }

  Future<void> pick(bool isIssue) async {
    final d = await showDatePicker(context: context, initialDate: isIssue ? issue : due, firstDate: DateTime(2024), lastDate: DateTime(2100));
    if (d != null) setState(() => isIssue ? issue = d : due = d);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: TopBar('Buat Invoice', back: true, actions: [
          topBtn('Simpan Draf', busy ? null : () => save(false)),
          topBtn('Kirim Invoice', busy ? null : () => save(true), icon: Icons.send, primary: true),
        ]),
        body: Loader<Map<String, dynamic>>(
          load: () async => asMap(await Api.i.get('/api/invoices/context')),
          builder: (c, d, _) {
            final projects = asList(d['projects']);
            final banks = asList(d['banks']);
            projectId ??= widget.projectId;
            final myTerms = asList(d['terms']).where((t) => n(t['projectId']) == projectId && t['billable'] == true).toList();
            terms = myTerms;
            bankId ??= banks.isNotEmpty ? n(banks.first['id']).toInt() : null;
            final proj = projects.where((p) => n(p['id']) == projectId).firstOrNull;
            return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: ListView(padding: const EdgeInsets.all(16), children: [
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const H('Proyek & Klien'),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: DropdownButtonFormField<int>(initialValue: projectId, isExpanded: true, decoration: const InputDecoration(labelText: 'Proyek'), items: [for (final p in projects) DropdownMenuItem(value: n(p['id']).toInt(), child: Text('${p['name']}', overflow: TextOverflow.ellipsis))], onChanged: (v) => setState(() { projectId = v; termId = null; }))),
                    const SizedBox(width: 12),
                    Expanded(child: DropdownButtonFormField<int>(initialValue: myTerms.any((t) => n(t['id']) == termId) ? termId : null, isExpanded: true, decoration: const InputDecoration(labelText: 'Termin'), items: [for (final t in myTerms) DropdownMenuItem(value: n(t['id']).toInt(), child: Text('${t['name']}', overflow: TextOverflow.ellipsis))], onChanged: (v) => setState(() {
                      termId = v;
                      final t = myTerms.firstWhere((x) => n(x['id']) == v);
                      items.first.desc.text = '${t['name']} — ${proj?['name'] ?? ''}';
                      items.first.price.text = numStr(n(t['amount']));
                      items.first.qty.text = '1';
                    }))),
                  ]),
                  if (proj != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text('Ditagihkan ke ${asMap(proj['client'])['name'] ?? '—'} · Nilai kontrak ${rp(proj['contractValue'])}', style: const TextStyle(color: C.mute))),
                ])),
                const SizedBox(height: 12),
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const H('Detail Invoice'),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(child: InputDecorator(decoration: const InputDecoration(labelText: 'No. invoice'), child: Text('${d['nextNumber']}'))),
                    const SizedBox(width: 12),
                    Expanded(child: OutlinedButton.icon(onPressed: () => pick(true), icon: const Icon(Icons.event, size: 18), label: Text('Terbit ${tgl(iso(issue))}'))),
                    const SizedBox(width: 12),
                    Expanded(child: OutlinedButton.icon(onPressed: () => pick(false), icon: const Icon(Icons.event, size: 18), label: Text('Tempo ${tgl(iso(due))}'))),
                  ]),
                ])),
                const SizedBox(height: 12),
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const H('Item'),
                  const SizedBox(height: 10),
                  for (var i = 0; i < items.length; i++) Padding(padding: const EdgeInsets.only(bottom: 10), child: Row(children: [
                    Expanded(flex: 5, child: TextField(controller: items[i].desc, decoration: const InputDecoration(labelText: 'Deskripsi'))),
                    const SizedBox(width: 8),
                    Expanded(child: TextField(controller: items[i].qty, keyboardType: TextInputType.number, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'Qty'))),
                    const SizedBox(width: 8),
                    Expanded(flex: 2, child: TextField(controller: items[i].price, keyboardType: TextInputType.number, inputFormatters: [ThousandsFormatter()], onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'Harga', prefixText: 'Rp '))),
                    IconButton(onPressed: items.length > 1 ? () => setState(() => items.removeAt(i)) : null, icon: const Icon(Icons.close)),
                  ])),
                  TextButton(onPressed: () => setState(() => items.add(_Item())), child: const Text('+ Tambah item')),
                  const Divider(),
                  Row2('Subtotal', rp(subtotal)),
                  Row(children: [const Expanded(child: Text('Total', style: TextStyle(fontWeight: FontWeight.w700))), Text(rp(subtotal), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))]),
                ])),
                const SizedBox(height: 12),
                Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const H('Pembayaran & Catatan'),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<int>(initialValue: bankId, isExpanded: true, decoration: const InputDecoration(labelText: 'Rekening tujuan'), items: [for (final b in banks) DropdownMenuItem(value: n(b['id']).toInt(), child: Text('${b['bankName'] ?? b['bank'] ?? ''} ${b['accountNumber'] ?? b['number'] ?? ''} a.n. ${b['accountName'] ?? b['holder'] ?? ''}', overflow: TextOverflow.ellipsis))], onChanged: (v) => setState(() => bankId = v)),
                  CheckboxListTile(contentPadding: EdgeInsets.zero, value: qris, onChanged: (v) => setState(() => qris = v ?? false), title: const Text('Tampilkan kode QRIS di invoice'), controlAffinity: ListTileControlAffinity.leading, activeColor: C.green),
                  TextField(controller: notes, maxLines: 2, decoration: const InputDecoration(labelText: 'Catatan (opsional)')),
                ])),
              ])),
              SizedBox(width: 340, child: Padding(padding: const EdgeInsets.fromLTRB(0, 16, 16, 16), child: Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const H('Pratinjau'),
                const SizedBox(height: 12),
                Text('${asMap(d['business'])['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)),
                Text('INVOICE ${d['nextNumber']}', style: const TextStyle(color: C.green, fontWeight: FontWeight.w800)),
                const Divider(),
                Row2('Terbit', tgl(iso(issue))),
                Row2('Jatuh tempo', tgl(iso(due))),
                const Divider(),
                for (final i in items) Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [Expanded(child: Text(i.desc.text.isEmpty ? '—' : i.desc.text, style: const TextStyle(fontSize: 12))), Text(rp(i.total), style: const TextStyle(fontSize: 12))])),
                const Divider(),
                Row(children: [const Expanded(child: Text('Total', style: TextStyle(fontWeight: FontWeight.w700))), Text(rp(subtotal), style: const TextStyle(fontWeight: FontWeight.w800, color: C.green))]),
                const SizedBox(height: 10),
                const Text('Pratinjau PDF resmi (sesuai template aktif) tersedia setelah invoice disimpan.', style: TextStyle(color: C.mute, fontSize: 11)),
              ])))),
            ]);
          },
        ),
      );
}
