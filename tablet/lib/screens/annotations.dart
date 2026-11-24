import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../ink.dart';
import '../theme.dart';
import '../widgets.dart';

class Anno {
  final int id;
  final String kind, author, at;
  String note, status;
  Anno(this.id, this.kind, this.author, this.at, {this.note = '', this.status = 'terbuka'});
  Map<String, dynamic> toJson() => {'id': id, 'kind': kind, 'author': author, 'at': at, 'note': note, 'status': status};
  static Anno fromJson(Map<String, dynamic> j) => Anno(j['id'] as int, '${j['kind']}', '${j['author']}', '${j['at']}', note: '${j['note'] ?? ''}', status: '${j['status']}');
}

/// Penyimpanan anotasi stylus per dokumen (di perangkat).
class AnnoStore {
  static Future<(List<Stroke>, List<Anno>)> load(int docId) async {
    final raw = (await SharedPreferences.getInstance()).getString('ink_$docId');
    if (raw == null) return (<Stroke>[], <Anno>[]);
    final j = jsonDecode(raw) as Map<String, dynamic>;
    return ([for (final s in j['strokes'] as List) Stroke.fromJson((s as Map).cast<String, dynamic>())], [for (final a in j['annos'] as List) Anno.fromJson((a as Map).cast<String, dynamic>())]);
  }

  static Future<void> save(int docId, InkController ink, List<Anno> annos) async =>
      (await SharedPreferences.getInstance()).setString('ink_$docId', jsonEncode({'strokes': ink.toJson(), 'annos': [for (final a in annos) a.toJson()]}));
}

/// T20 · Daftar anotasi review
class AnnotationPanel extends StatefulWidget {
  final List<Anno> annos;
  final void Function(Anno) onChanged;
  final void Function(Anno) onDelete;
  final void Function(Anno) onFocus;
  final int? focusId;
  const AnnotationPanel({super.key, required this.annos, required this.onChanged, required this.onDelete, required this.onFocus, this.focusId});
  @override
  State<AnnotationPanel> createState() => _AnnotationPanelState();
}

class _AnnotationPanelState extends State<AnnotationPanel> {
  int f = 0;
  @override
  Widget build(BuildContext context) {
    final open = widget.annos.where((a) => a.status == 'terbuka').length;
    final list = widget.annos.where((a) => f == 0 || (f == 1 ? a.status == 'terbuka' : a.status == 'selesai')).toList();
    return Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      H('Anotasi review · ${widget.annos.length}'),
      const SizedBox(height: 8),
      Chips(['Semua · ${widget.annos.length}', 'Terbuka · $open', 'Selesai · ${widget.annos.length - open}'], f, (i) => setState(() => f = i)),
      const SizedBox(height: 8),
      if (list.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Text('Belum ada anotasi. Pilih Pena atau Stabilo lalu coret dokumen dengan stylus.', style: TextStyle(color: C.mute, fontSize: 12))),
      for (final a in list) Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), border: Border.all(color: widget.focusId == a.id ? C.green : C.line, width: widget.focusId == a.id ? 2 : 1)),
        child: InkWell(
          onTap: () => widget.onFocus(a),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              CircleAvatar(radius: 11, backgroundColor: a.status == 'selesai' ? C.green : C.amber, child: Text('${a.id}', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700))),
              const SizedBox(width: 8),
              Expanded(child: Text(a.kind, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
              Pill.status(a.status == 'selesai' ? 'selesai' : 'menunggu'),
            ]),
            const SizedBox(height: 4),
            Text('${a.author} · ${a.at}', style: const TextStyle(color: C.mute, fontSize: 11)),
            const SizedBox(height: 6),
            TextFormField(
              initialValue: a.note,
              key: ValueKey('${a.id}-${a.note.isEmpty}'),
              maxLines: null,
              decoration: const InputDecoration(hintText: 'Tulis catatan…', isDense: true),
              style: const TextStyle(fontSize: 13),
              onChanged: (v) { a.note = v; widget.onChanged(a); },
            ),
            const SizedBox(height: 6),
            Row(children: [
              if (a.status == 'terbuka') FilledButton(style: FilledButton.styleFrom(minimumSize: const Size(0, 34)), onPressed: () { a.status = 'selesai'; widget.onChanged(a); setState(() {}); }, child: const Text('Tandai selesai'))
              else OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size(0, 34)), onPressed: () { a.status = 'terbuka'; widget.onChanged(a); setState(() {}); }, child: const Text('Buka lagi')),
              const Spacer(),
              IconButton(onPressed: () => widget.onDelete(a), icon: const Icon(Icons.delete_outline, size: 20, color: C.mute)),
            ]),
          ]),
        ),
      ),
    ]));
  }
}
