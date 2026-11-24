import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'signing.dart';

/// T17 · Pratinjau PDF
class PdfPreviewScreen extends StatelessWidget {
  final int docId;
  final String name;
  final String status;
  final int projectId;
  const PdfPreviewScreen({super.key, required this.docId, required this.name, required this.status, required this.projectId});

  Future<void> _share(BuildContext c, String fmt) async {
    await guard(c, () async {
      final b = await Api.i.bytes('/api/documents/$docId/export', q: {'format': fmt, 'download': '1'});
      await Printing.sharePdf(bytes: Uint8List.fromList(b), filename: '$name.${fmt == 'pdf' ? 'pdf' : 'docx'}');
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: TopBar('Pratinjau PDF', back: true, actions: [
          topBtn('Unduh Word', () => _share(context, 'docx')),
          topBtn('Unduh PDF', () => _share(context, 'pdf'), icon: Icons.download),
          topBtn('Minta Tanda Tangan', () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SignScreen(docId: docId, projectId: projectId))), icon: Icons.draw, primary: true),
        ]),
        body: Column(children: [
          Padding(padding: const EdgeInsets.all(12), child: Row(children: [Text(name, style: const TextStyle(color: C.mute)), const SizedBox(width: 10), Pill.status(status)])),
          Expanded(
            child: PdfPreview(
              build: (_) async => Uint8List.fromList(await Api.i.bytes('/api/documents/$docId/export', q: {'format': 'pdf'})),
              canChangeOrientation: false,
              canChangePageFormat: false,
              canDebug: false,
              allowPrinting: false,
              allowSharing: false,
              useActions: false,
              pdfPreviewPageDecoration: const BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Color(0x22000000), blurRadius: 8)]),
              scrollViewDecoration: const BoxDecoration(color: C.bg),
            ),
          ),
        ]),
      );
}

/// Pratinjau PDF umum (mis. invoice, kuitansi).
class PdfViewScreen extends StatelessWidget {
  final String title, path, filename;
  const PdfViewScreen({super.key, required this.title, required this.path, required this.filename});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: TopBar(title, back: true, actions: [
          topBtn('Bagikan / Unduh', () => guard(context, () async {
            final b = await Api.i.bytes(path);
            await Printing.sharePdf(bytes: Uint8List.fromList(b), filename: filename);
          }), icon: Icons.download),
        ]),
        body: PdfPreview(
          build: (_) async => Uint8List.fromList(await Api.i.bytes(path)),
          canChangeOrientation: false, canChangePageFormat: false, canDebug: false, allowPrinting: false, allowSharing: false, useActions: false,
          pdfPreviewPageDecoration: const BoxDecoration(color: Colors.white, boxShadow: [BoxShadow(color: Color(0x22000000), blurRadius: 8)]),
          scrollViewDecoration: const BoxDecoration(color: C.bg),
        ),
      );
}
