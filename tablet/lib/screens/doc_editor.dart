import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import '../api.dart';
import '../ink.dart';
import '../theme.dart';
import '../widgets.dart';
import 'pdf_preview.dart';
import 'annotations.dart';
import 'handwriting.dart';

typedef J = Map<String, dynamic>;

String _textOf(dynamic node) {
  if (node is! Map) return '';
  if (node['type'] == 'text') return '${node['text'] ?? ''}';
  if (node['type'] == 'hardBreak') return '\n';
  return ((node['content'] as List?) ?? const []).map(_textOf).join();
}

/// Paragraf pertama di dalam node (untuk sel tabel dan butir daftar).
J? _firstPara(J node) {
  if (node['type'] == 'paragraph' || node['type'] == 'heading') return node;
  for (final c in (node['content'] as List? ?? const [])) {
    final r = c is Map<String, dynamic> ? _firstPara(c) : null;
    if (r != null) return r;
  }
  return null;
}

void _setText(J para, String text) {
  final old = ((para['content'] as List?) ?? const []).whereType<Map>().where((e) => e['type'] == 'text').toList();
  final marks = old.isNotEmpty ? old.first['marks'] : null;
  if (text.isEmpty) {
    para.remove('content');
  } else {
    para['content'] = [for (final line in text.split('\n').indexed) ...[if (line.$1 > 0) {'type': 'hardBreak'}, if (line.$2.isNotEmpty) {'type': 'text', 'text': line.$2, if (marks != null) 'marks': marks}]];
  }
}

bool _hasMark(J para, String mark) {
  final t = ((para['content'] as List?) ?? const []).whereType<Map>().where((e) => e['type'] == 'text').toList();
  return t.isNotEmpty && t.every((e) => ((e['marks'] as List?) ?? const []).any((m) => m['type'] == mark));
}

void _toggleMark(J para, String mark) {
  final on = _hasMark(para, mark);
  for (final t in ((para['content'] as List?) ?? const []).whereType<Map>().where((e) => e['type'] == 'text')) {
    final ms = ((t['marks'] as List?) ?? []).where((m) => m['type'] != mark).toList();
    if (!on) ms.add({'type': mark});
    if (ms.isEmpty) { t.remove('marks'); } else { t['marks'] = ms; }
  }
}

/// T16 · Editor Dokumen (+ T18–T20 mode stylus)
class DocEditorScreen extends StatefulWidget {
  final int docId;
  const DocEditorScreen({super.key, required this.docId});
  @override
  State<DocEditorScreen> createState() => _DocEditorScreenState();
}

enum Tool { text, pen, highlighter, eraser, write }

class _DocEditorScreenState extends State<DocEditorScreen> {
  J? doc;
  late J content;
  final name = TextEditingController();
  final ctrls = Map<Object, TextEditingController>.identity();
  final foci = Map<Object, FocusNode>.identity();
  final ink = InkController();
  final history = <String>[];
  int hi = -1;
  bool dirty = false, loading = true, saving = false, stylusOnly = true;
  String? error;
  J? focused; // paragraf yang sedang difokus
  J? focusedTop; // blok tingkat atas yang memuat fokus
  Tool tool = Tool.text;
  Color penColor = const Color(0xFF1D4ED8);
  double penW = 2.5;
  Timer? snap, persist;
  final annos = <Anno>[];
  int? annoFocus;
  DateTime lastStroke = DateTime.fromMillisecondsSinceEpoch(0);

  bool get isFinal => doc?['status'] == 'final';

  @override
  void initState() {
    super.initState();
    _load();
    AnnoStore.load(widget.docId).then((r) {
      if (!mounted) return;
      ink.loadJson([for (final st in r.$1) st.toJson()]);
      setState(() => annos..clear()..addAll(r.$2));
      ink.addListener(_inkChanged);
    });
  }

  void _inkChanged() {
    final used = {for (final st in ink.strokes) if (st.anno != null) st.anno};
    final before = annos.length;
    annos.removeWhere((a) => !used.contains(a.id));
    if (annos.length != before && mounted) setState(() {});
    _persistSoon();
  }

  void _persistSoon() {
    persist?.cancel();
    persist = Timer(const Duration(milliseconds: 800), () => AnnoStore.save(widget.docId, ink, annos));
  }

  void _onPenStroke(Stroke st) {
    final now = DateTime.now();
    final kind = tool == Tool.highlighter ? 'Stabilo' : 'Pena';
    final last = annos.isEmpty ? null : annos.last;
    if (last != null && last.kind == kind && now.difference(lastStroke).inMilliseconds < 2500) {
      st.anno = last.id;
    } else {
      final id = (annos.isEmpty ? 0 : annos.map((a) => a.id).reduce((a, b) => a > b ? a : b)) + 1;
      annos.add(Anno(id, kind, Api.i.session?.name ?? 'Anda', tglJam(now.toIso8601String())));
      st.anno = id;
      annoFocus = id;
    }
    lastStroke = now;
    setState(() {});
    _persistSoon();
  }

  void _insertParagraph(String text) {
    final list = content['content'] as List;
    final i = focusedTop == null ? list.length - 1 : list.indexWhere((e) => identical(e, focusedTop));
    list.insert(i + 1, {'type': 'paragraph', 'content': [{'type': 'text', 'text': text}]});
    _changed();
    toast(context, 'Teks disisipkan.');
  }

  @override
  void dispose() {
    snap?.cancel();
    persist?.cancel();
    AnnoStore.save(widget.docId, ink, annos);
    ink.removeListener(_inkChanged);
    for (final c in ctrls.values) { c.dispose(); }
    for (final f in foci.values) { f.dispose(); }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final d = asMap(await Api.i.get('/api/documents/${widget.docId}'));
      content = (jsonDecode(jsonEncode(d['content'])) as Map).cast<String, dynamic>();
      content['content'] ??= <dynamic>[];
      name.text = '${d['name']}';
      history..clear()..add(jsonEncode(content));
      hi = 0;
      setState(() { doc = d; loading = false; });
    } on ApiError catch (e) {
      setState(() { error = e.message; loading = false; });
    }
  }

  void _changed() {
    dirty = true;
    snap?.cancel();
    snap = Timer(const Duration(milliseconds: 700), _snapshot);
    setState(() {});
  }

  void _snapshot() {
    final s = jsonEncode(content);
    if (hi >= 0 && history[hi] == s) return;
    history.removeRange(hi + 1, history.length);
    history.add(s);
    hi = history.length - 1;
    if (mounted) setState(() {});
  }

  void _restore(int i) {
    snap?.cancel();
    hi = i;
    content = (jsonDecode(history[i]) as Map).cast<String, dynamic>();
    for (final c in ctrls.values) { c.dispose(); }
    ctrls.clear();
    for (final f in foci.values) { f.dispose(); }
    foci.clear();
    focused = null;
    dirty = true;
    setState(() {});
  }

  Future<void> _save({String? status}) async {
    setState(() => saving = true);
    await guard(context, () async {
      _snapshot();
      final body = <String, dynamic>{'name': name.text.trim()};
      if (!isFinal) body['content'] = content;
      if (status != null) body['status'] = status;
      await Api.i.patch('/api/documents/${widget.docId}', body);
      dirty = false;
      if (status != null) doc!['status'] = status;
    }, ok: status == 'final' ? 'Dokumen ditandai Final.' : 'Dokumen disimpan.');
    if (mounted) setState(() => saving = false);
  }

  TextEditingController _ctl(J para) => ctrls.putIfAbsent(para, () => TextEditingController(text: _textOf(para)));
  FocusNode _foc(J para, J top) => foci.putIfAbsent(para, () {
        final f = FocusNode();
        f.addListener(() { if (f.hasFocus) setState(() { focused = para; focusedTop = top; }); });
        return f;
      });

  Widget _field(J para, J top, TextStyle st, {bool header = false}) {
    final bold = _hasMark(para, 'bold') || header;
    final it = _hasMark(para, 'italic');
    final ul = _hasMark(para, 'underline');
    return TextField(
      controller: _ctl(para),
      focusNode: _foc(para, top),
      readOnly: isFinal || tool != Tool.text,
      maxLines: null,
      style: st.copyWith(fontWeight: bold ? FontWeight.w700 : st.fontWeight, fontStyle: it ? FontStyle.italic : null, decoration: ul ? TextDecoration.underline : null),
      decoration: const InputDecoration(isDense: true, filled: false, border: InputBorder.none, enabledBorder: InputBorder.none, focusedBorder: InputBorder.none, contentPadding: EdgeInsets.symmetric(vertical: 3, horizontal: 2)),
      onChanged: (v) { _setText(para, v); _changed(); },
    );
  }

  Widget _block(J node) {
    const body = TextStyle(fontSize: 13.5, height: 1.45, color: Colors.black);
    switch (node['type']) {
      case 'heading':
        final lv = (node['attrs']?['level'] as num?)?.toInt() ?? 2;
        return Padding(padding: const EdgeInsets.only(top: 10), child: _field(node, node, TextStyle(fontSize: lv == 1 ? 20 : lv == 2 ? 16 : 14, fontWeight: FontWeight.w700, color: Colors.black)));
      case 'paragraph':
        return _field(node, node, body);
      case 'bulletList':
      case 'orderedList':
        final items = (node['content'] as List? ?? const []).whereType<J>().toList();
        return Column(children: [
          for (final e in items.indexed) () {
            final p = _firstPara(e.$2);
            return p == null ? const SizedBox() : Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Padding(padding: const EdgeInsets.only(left: 6, right: 6, top: 4), child: Text(node['type'] == 'bulletList' ? '•' : '${e.$1 + 1}.', style: body)),
              Expanded(child: _field(p, node, body)),
            ]);
          }(),
        ]);
      case 'table':
        final rows = (node['content'] as List? ?? const []).whereType<J>().toList();
        return Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Table(
          border: TableBorder.all(color: const Color(0xFFBFC5CE), width: .6),
          children: [
            for (final r in rows) TableRow(children: [
              for (final cell in (r['content'] as List? ?? const []).whereType<J>()) () {
                final p = _firstPara(cell);
                return Container(
                  color: cell['type'] == 'tableHeader' ? const Color(0xFFF1F3F6) : null,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: p == null ? const SizedBox(height: 28) : _field(p, node, body.copyWith(fontSize: 12.5), header: cell['type'] == 'tableHeader'),
                );
              }(),
            ]),
          ],
        ));
      default:
        return const SizedBox();
    }
  }

  // ----- perintah toolbar -----
  void _setBlock(String kind) {
    final t = focusedTop;
    if (t == null || (t['type'] != 'paragraph' && t['type'] != 'heading')) return;
    if (kind == 'p') { t['type'] = 'paragraph'; t.remove('attrs'); } else { t['type'] = 'heading'; t['attrs'] = {'level': kind == 'h2' ? 2 : 3}; }
    _changed();
  }

  void _mark(String m) { final p = focused; if (p == null) return; _toggleMark(p, m); _changed(); }

  void _toList(String type) {
    final t = focusedTop;
    final list = content['content'] as List;
    if (t == null || t['type'] != 'paragraph') return;
    final i = list.indexWhere((e) => identical(e, t));
    if (i < 0) return;
    list[i] = {'type': type, 'content': [{'type': 'listItem', 'content': [t]}]};
    focused = null; focusedTop = null;
    _changed();
  }

  void _insertTable() {
    final list = content['content'] as List;
    final i = focusedTop == null ? list.length - 1 : list.indexWhere((e) => identical(e, focusedTop));
    J cell(String t, bool h) => {'type': h ? 'tableHeader' : 'tableCell', 'attrs': {'colspan': 1, 'rowspan': 1}, 'content': [{'type': 'paragraph', if (t.isNotEmpty) 'content': [{'type': 'text', 'text': t}]}]};
    list.insert(i + 1, {'type': 'table', 'content': [
      {'type': 'tableRow', 'content': [cell('Kolom 1', true), cell('Kolom 2', true), cell('Kolom 3', true)]},
      {'type': 'tableRow', 'content': [cell('', false), cell('', false), cell('', false)]},
    ]});
    _changed();
  }

  Widget _tb(String label, VoidCallback? on, {bool active = false, IconData? icon}) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2),
        child: InkWell(
          onTap: on,
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(color: active ? C.greenSoft : null, borderRadius: BorderRadius.circular(8)),
            child: Row(children: [if (icon != null) Icon(icon, size: 18, color: on == null ? C.line : (active ? C.green : C.ink)), if (icon != null && label.isNotEmpty) const SizedBox(width: 4), if (label.isNotEmpty) Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: on == null ? C.line : (active ? C.green : C.ink)))]),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    if (loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (error != null || doc == null) return Scaffold(appBar: const TopBar('Dokumen', back: true), body: Center(child: Text(error ?? 'Gagal memuat.')));
    final lay = asMap(doc!['layout']);
    final biz = asMap(lay['business']);
    final top = (content['content'] as List).whereType<J>().toList();
    final ro = isFinal;
    final fp = focused;
    return Scaffold(
      appBar: TopBar(name.text.isEmpty ? 'Dokumen' : name.text, back: true, actions: [
        topBtn('Pratinjau PDF', () async {
          if (dirty && !ro) await _save();
          if (!mounted) return;
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => PdfPreviewScreen(docId: widget.docId, name: name.text, status: '${doc!['status']}', projectId: n(doc!['projectId']).toInt())));
        }),
        if (!ro) topBtn('Tandai Final', saving ? null : () async { await _save(); await _save(status: 'final'); }, icon: Icons.check) else topBtn('Buka sebagai Draf', () async { await _save(status: 'draf'); await _load(); }),
        if (!ro) topBtn('Simpan', saving || !dirty ? null : _save, primary: true),
      ]),
      body: Column(children: [
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(children: [
            Pill.status('${doc!['status']}'), const SizedBox(width: 8),
            Text('${doc!['projectName']} · ${doc!['type']} · ${doc!['docNumber'] ?? ''}', style: const TextStyle(color: C.mute, fontSize: 12)),
            const Spacer(),
            Text(dirty ? 'Perubahan belum disimpan' : 'Tersimpan', style: TextStyle(color: dirty ? C.amber : C.mute, fontSize: 12)),
          ]),
        ),
        Container(
          color: Colors.white,
          padding: const EdgeInsets.all(8),
          child: SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
            _tb('H2', ro ? null : () => _setBlock('h2'), active: focusedTop?['type'] == 'heading' && focusedTop?['attrs']?['level'] == 2),
            _tb('H3', ro ? null : () => _setBlock('h3'), active: focusedTop?['type'] == 'heading' && focusedTop?['attrs']?['level'] == 3),
            _tb('P', ro ? null : () => _setBlock('p'), active: focusedTop?['type'] == 'paragraph'),
            const SizedBox(width: 10),
            _tb('B', ro ? null : () => _mark('bold'), active: fp != null && _hasMark(fp, 'bold')),
            _tb('I', ro ? null : () => _mark('italic'), active: fp != null && _hasMark(fp, 'italic')),
            _tb('U', ro ? null : () => _mark('underline'), active: fp != null && _hasMark(fp, 'underline')),
            const SizedBox(width: 10),
            _tb('Poin', ro ? null : () => _toList('bulletList')),
            _tb('Nomor', ro ? null : () => _toList('orderedList')),
            _tb('Tabel', ro ? null : _insertTable),
            const SizedBox(width: 10),
            _tb('Pena', () => setState(() => tool = tool == Tool.pen ? Tool.text : Tool.pen), icon: Icons.edit, active: tool == Tool.pen),
            _tb('Stabilo', () => setState(() => tool = tool == Tool.highlighter ? Tool.text : Tool.highlighter), icon: Icons.border_color, active: tool == Tool.highlighter),
            _tb('Penghapus', () => setState(() => tool = tool == Tool.eraser ? Tool.text : Tool.eraser), icon: Icons.cleaning_services_outlined, active: tool == Tool.eraser),
            _tb('Tulis→Teks', ro ? null : () => setState(() => tool = tool == Tool.write ? Tool.text : Tool.write), icon: Icons.text_fields, active: tool == Tool.write),
            const SizedBox(width: 10),
            _tb('', hi > 0 ? () => _restore(hi - 1) : null, icon: Icons.undo),
            _tb('', hi < history.length - 1 ? () => _restore(hi + 1) : null, icon: Icons.redo),
          ])),
        ),
        const Divider(height: 1),
        Expanded(
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 720),
                    child: Stack(children: [
                      Container(
                        padding: const EdgeInsets.fromLTRB(32, 28, 32, 28),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4), border: const Border(top: BorderSide(color: C.green, width: 4)), boxShadow: const [BoxShadow(color: Color(0x14000000), blurRadius: 10)]),
                        constraints: const BoxConstraints(minHeight: 900),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            const LogoMark(size: 34),
                            const SizedBox(width: 10),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('${biz['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                              Text('${biz['address'] ?? ''}', style: const TextStyle(fontSize: 10, color: C.mute)),
                            ])),
                            Text('${doc!['docNumber'] ?? ''}', style: const TextStyle(color: C.green, fontWeight: FontWeight.w700, fontSize: 12)),
                          ]),
                          const Divider(height: 28),
                          for (final b in top) _block(b),
                          const SizedBox(height: 40),
                          const Text('Kop, tanda tangan, dan footer dipasang otomatis dari template.', style: TextStyle(fontSize: 10, color: C.mute)),
                        ]),
                      ),
                      if (tool == Tool.pen || tool == Tool.highlighter || tool == Tool.eraser)
                        Positioned.fill(child: InkPad(onStroke: _onPenStroke, ctl: ink, color: penColor, width: tool == Tool.highlighter ? 14 : penW, highlighter: tool == Tool.highlighter, eraser: tool == Tool.eraser, stylusOnly: stylusOnly))
                      else
                        Positioned.fill(child: IgnorePointer(child: CustomPaint(painter: InkPainter(ink)))),
                      for (final a in annos) () {
                        final st = ink.strokes.where((x) => x.anno == a.id).firstOrNull;
                        if (st == null || st.pts.isEmpty) return const SizedBox();
                        final o = st.pts.first;
                        return Positioned(left: o.dx - 20, top: o.dy - 10, child: IgnorePointer(child: CircleAvatar(radius: 10, backgroundColor: a.status == 'selesai' ? C.green : C.amber, child: Text('${a.id}', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)))));
                      }(),
                    ]),
                  ),
                ),
              ),
            ),
            SizedBox(width: 300, child: ListView(padding: const EdgeInsets.fromLTRB(0, 16, 16, 16), children: [
              Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const H('Dokumen'),
                const SizedBox(height: 10),
                TextField(controller: name, readOnly: ro, decoration: const InputDecoration(labelText: 'Nama dokumen'), onChanged: (_) => _changed()),
                const SizedBox(height: 10),
                Row2('Jenis', '${doc!['type']}'),
                Row2('Nomor', '${doc!['docNumber'] ?? '—'}'),
                Row2('Klien', '${doc!['clientName'] ?? '—'}'),
              ])),
              const SizedBox(height: 12),
              Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const H('Mode stylus'),
                const SizedBox(height: 6),
                SwitchListTile(contentPadding: EdgeInsets.zero, dense: true, activeThumbColor: C.green, title: const Text('Abaikan telapak tangan'), subtitle: const Text('Hanya ujung stylus yang menggambar', style: TextStyle(fontSize: 11)), value: stylusOnly, onChanged: (v) => setState(() => stylusOnly = v)),
                const Text('Warna pena', style: TextStyle(fontSize: 12, color: C.mute)),
                const SizedBox(height: 6),
                Row(children: [for (final c in [const Color(0xFF111827), const Color(0xFF1D4ED8), const Color(0xFFDC2626), const Color(0xFF16A34A), const Color(0xFFD97706)]) Padding(padding: const EdgeInsets.only(right: 8), child: GestureDetector(onTap: () => setState(() => penColor = c), child: Container(width: 28, height: 28, decoration: BoxDecoration(color: c, shape: BoxShape.circle, border: Border.all(color: penColor == c ? C.green : Colors.transparent, width: 3)))))]),
                const SizedBox(height: 10),
                const Text('Ketebalan', style: TextStyle(fontSize: 12, color: C.mute)),
                Slider(value: penW, min: 1, max: 6, activeColor: C.green, onChanged: (v) => setState(() => penW = v)),
                const SizedBox(height: 4),
                Row(children: [Expanded(child: OutlinedButton(onPressed: ink.isEmpty ? null : ink.clear, child: const Text('Hapus coretan')))]),
                const SizedBox(height: 8),
                const Text('Coretan stylus adalah anotasi di layar dan tidak ikut tercetak di PDF.', style: TextStyle(fontSize: 11, color: C.mute)),
              ])),
              const SizedBox(height: 12),
              AnnotationPanel(
                annos: annos, focusId: annoFocus,
                onChanged: (a) { setState(() {}); _persistSoon(); },
                onDelete: (a) => ink.removeAnno(a.id),
                onFocus: (a) => setState(() => annoFocus = a.id),
              ),
            ])),
          ]),
        ),
        if (tool == Tool.write) ...[const Divider(height: 1), HandwritePanel(stylusOnly: stylusOnly, onInsert: _insertParagraph)],
      ]),
    );
  }
}
