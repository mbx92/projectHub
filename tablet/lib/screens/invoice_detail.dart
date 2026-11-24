import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'pdf_preview.dart';

/// Detail Invoice: kertas invoice, riwayat pembayaran, kirim / catat bayar / batalkan / PDF.
class InvoiceDetailScreen extends StatefulWidget {
  final int id;
  const InvoiceDetailScreen({super.key, required this.id});
  @override
  State<InvoiceDetailScreen> createState() => _InvoiceDetailScreenState();
}

class _InvoiceDetailScreenState extends State<InvoiceDetailScreen> {
  Key k = UniqueKey();
  void refresh() => setState(() => k = UniqueKey());

  void _pay(Map<String, dynamic> inv, num outstanding) {
    final amount = TextEditingController(text: numStr(outstanding));
    final method = TextEditingController(text: 'Transfer bank');
    showDialog<void>(context: context, builder: (ctx) => AlertDialog(
      title: Text('Catat pembayaran ${inv['number']}'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: amount, keyboardType: TextInputType.number, inputFormatters: [ThousandsFormatter()], decoration: const InputDecoration(labelText: 'Nominal', prefixText: 'Rp ')),
        const SizedBox(height: 12),
        TextField(controller: method, decoration: const InputDecoration(labelText: 'Metode')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
        FilledButton(onPressed: () async {
          Navigator.pop(ctx);
          await guard(context, () async {
            await Api.i.post('/api/payments', {'invoiceId': inv['id'], 'amount': parseMoney(amount.text), 'date': DateTime.now().toIso8601String().substring(0, 10), 'method': method.text});
            refresh();
          }, ok: 'Pembayaran dicatat.');
        }, child: const Text('Simpan')),
      ],
    ));
  }

  Future<void> _confirm(String title, String msg, Future<void> Function() act, String ok) async {
    final y = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: Text(title), content: Text(msg),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Batal')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Lanjut'))],
    ));
    if (y == true && mounted) await guard(context, () async { await act(); refresh(); }, ok: ok);
  }

  @override
  Widget build(BuildContext context) {
    final manage = Api.i.session!.has('keuangan', ['kelola']);
    return Loader<Map<String, dynamic>>(
      key: k,
      load: () async => asMap(await Api.i.get('/api/invoices/${widget.id}')),
      builder: (c, d, _) {
        final inv = asMap(d['invoice']);
        final items = asList(d['items']);
        final pays = asList(d['payments']);
        final biz = asMap(asMap(d['paper'])['business']);
        final bank = d['bank'] == null ? null : asMap(d['bank']);
        final status = '${d['displayStatus']}';
        final outstanding = n(d['outstanding']);
        final active = status != 'lunas' && status != 'batal';
        return Scaffold(
          appBar: TopBar('${inv['number']}', back: true, actions: [
            topBtn('PDF', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => PdfViewScreen(title: '${inv['number']}', path: '/api/invoices/${widget.id}/pdf', filename: '${inv['number']}.pdf'))), icon: Icons.picture_as_pdf),
            if (manage && active) topBtn(status == 'draf' ? 'Kirim Invoice' : 'Kirim Ulang', () => _confirm('Kirim invoice?', 'Invoice dikirim ke klien lewat email (bila ada) dan berstatus Terkirim.', () async { await Api.i.post('/api/invoices/${widget.id}/send', {}); }, 'Invoice dikirim.'), icon: Icons.send, primary: status == 'draf'),
            if (manage && active) topBtn('Catat Pembayaran', () => _pay(inv, outstanding), icon: Icons.payments_outlined, primary: status != 'draf'),
          ]),
          body: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(flex: 3, child: ListView(padding: const EdgeInsets.all(16), children: [
              Panel(padding: const EdgeInsets.all(28), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const LogoMark(size: 40), const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${biz['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700)), Text('${biz['address'] ?? ''}', style: const TextStyle(fontSize: 11, color: C.mute))])),
                  Column(crossAxisAlignment: CrossAxisAlignment.end, children: [const Text('INVOICE', style: TextStyle(color: C.green, fontWeight: FontWeight.w800, fontSize: 20)), Text('${inv['number']}', style: const TextStyle(color: C.mute))]),
                ]),
                const Divider(height: 32),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('DITAGIHKAN KE', style: TextStyle(fontSize: 10, color: C.mute, fontWeight: FontWeight.w700)), const SizedBox(height: 4), Text('${asMap(d['client'])['name'] ?? '—'}', style: const TextStyle(fontWeight: FontWeight.w600)), Text('${asMap(d['project'])['name'] ?? ''}', style: const TextStyle(fontSize: 12, color: C.mute))])),
                  Expanded(child: Column(children: [Row2('Terbit', tgl(inv['issueDate'])), Row2('Jatuh tempo', tgl(inv['dueDate'])), Row2('Termin', '${asMap(d['term'])['name'] ?? '—'}')])),
                ]),
                const SizedBox(height: 20),
                Container(color: const Color(0xFFF1F3F6), padding: const EdgeInsets.all(8), child: const Row(children: [Expanded(flex: 5, child: Text('Deskripsi', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700))), Expanded(child: Text('Qty', textAlign: TextAlign.right, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700))), Expanded(flex: 2, child: Text('Harga', textAlign: TextAlign.right, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700))), Expanded(flex: 2, child: Text('Jumlah', textAlign: TextAlign.right, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)))])),
                for (final i in items) Padding(padding: const EdgeInsets.all(8), child: Row(children: [Expanded(flex: 5, child: Text('${i['description']}')), Expanded(child: Text('${i['qty']}', textAlign: TextAlign.right)), Expanded(flex: 2, child: Text(rp(i['price']), textAlign: TextAlign.right)), Expanded(flex: 2, child: Text(rp(n(i['qty']) * n(i['price'])), textAlign: TextAlign.right))])),
                const Divider(),
                Align(alignment: Alignment.centerRight, child: SizedBox(width: 280, child: Column(children: [
                  Row2('Subtotal', rp(inv['subtotal'])),
                  if (n(inv['discount']) > 0) Row2('Diskon', '- ${rp(inv['discount'])}'),
                  if (n(inv['taxAmount']) > 0) Row2('Pajak (${inv['taxPercent']}%)', rp(inv['taxAmount'])),
                  Row2('Sudah dibayar', rp(d['paid'])),
                  const SizedBox(height: 6),
                  Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: C.greenSoft, borderRadius: BorderRadius.circular(8)), child: Row(children: [const Expanded(child: Text('Total', style: TextStyle(fontWeight: FontWeight.w700))), Text(rp(inv['total']), style: const TextStyle(fontWeight: FontWeight.w800, color: C.green, fontSize: 16))])),
                ]))),
                if (bank != null) ...[
                  const SizedBox(height: 20),
                  const Text('PEMBAYARAN', style: TextStyle(fontSize: 10, color: C.mute, fontWeight: FontWeight.w700)),
                  Text('${bank['bankName']} ${bank['accountNumber']} a.n. ${bank['accountName']}'),
                ],
                if ('${inv['notes'] ?? ''}'.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 12), child: Text('${inv['notes']}', style: const TextStyle(color: C.mute, fontSize: 12))),
              ])),
            ])),
            SizedBox(width: 340, child: ListView(padding: const EdgeInsets.fromLTRB(0, 16, 16, 16), children: [
              Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [const Expanded(child: H('Status')), Pill.status(status)]),
                const SizedBox(height: 8),
                Row2('Total', rp(inv['total'])),
                Row2('Dibayar', rp(d['paid'])),
                Row2('Sisa tagihan', rp(outstanding)),
              ])),
              const SizedBox(height: 12),
              Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const H('Riwayat Pembayaran'),
                if (pays.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Text('Belum ada pembayaran.', style: TextStyle(color: C.mute))),
                for (final p in pays) ListTile(
                  contentPadding: EdgeInsets.zero, dense: true,
                  title: Text(rp(p['amount']), style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text('${tgl(p['date'])} · ${p['method'] ?? ''}'),
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                    IconButton(tooltip: 'Kuitansi', icon: const Icon(Icons.receipt_long_outlined, size: 20), onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => PdfViewScreen(title: 'Kuitansi', path: '/api/payments/${p['id']}/receipt', filename: 'kuitansi-${p['id']}.pdf')))),
                    if (manage) IconButton(tooltip: 'Hapus', icon: const Icon(Icons.delete_outline, size: 20, color: C.mute), onPressed: () => _confirm('Hapus pembayaran?', 'Pembayaran ${rp(p['amount'])} akan dihapus dan status invoice dihitung ulang.', () async { await _delete('/api/payments/${p['id']}'); }, 'Pembayaran dihapus.')),
                  ]),
                ),
              ])),
              if (manage && active && pays.isEmpty) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(style: OutlinedButton.styleFrom(foregroundColor: C.red), onPressed: () => _confirm('Batalkan invoice?', 'Termin kembali Terjadwal sehingga bisa ditagih lagi.', () async { await Api.i.post('/api/invoices/${widget.id}/cancel', {}); }, 'Invoice dibatalkan.'), icon: const Icon(Icons.block), label: const Text('Batalkan invoice')),
              ],
            ])),
          ]),
        );
      },
    );
  }

  Future<void> _delete(String path) => Api.i.delete(path);
}
