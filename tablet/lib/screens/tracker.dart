import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'bug_detail.dart';

const _cols = [('open', 'Open', C.red), ('dikerjakan', 'Dikerjakan', C.blue), ('review', 'Review', C.amber), ('selesai', 'Selesai', C.green)];

Widget bugCard(BuildContext c, Map<String, dynamic> b, {VoidCallback? onBack, bool draggable = false}) {
  final card = Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.of(c).push(MaterialPageRoute(builder: (_) => BugDetailScreen(id: n(b['id']).toInt()))).then((_) => onBack?.call()),
        child: Panel(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text('${b['code']}', style: const TextStyle(fontSize: 11, color: C.mute, fontWeight: FontWeight.w600)),
              const SizedBox(width: 6),
              Pill('${b['type']}'.isEmpty ? '' : '${b['type']}'[0].toUpperCase() + '${b['type']}'.substring(1), fg: C.red, bg: C.redSoft),
              const Spacer(),
              Pill.status('${b['severity']}'),
            ]),
            const SizedBox(height: 8),
            Text('${b['title']}', style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text('${b['projectName']}', style: const TextStyle(color: C.green, fontSize: 12)),
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.schedule, size: 14, color: C.mute), const SizedBox(width: 4),
              Text(tgl(b['targetDate']), style: const TextStyle(fontSize: 12, color: C.mute)),
              if (b['blocksTerm'] == true) ...[const SizedBox(width: 8), const Pill('Hambat termin', fg: Color(0xFFB45309), bg: C.amberSoft)],
              const Spacer(),
              if (b['assigneeName'] != null) Avatar(initialsOf('${b['assigneeName']}'), size: 24, color: hexColor(b['assigneeColor'])),
            ]),
          ]),
        ),
      ),
    );
  if (!draggable) return card;
  return LongPressDraggable<Map<String, dynamic>>(
    data: b,
    delay: const Duration(milliseconds: 220),
    feedback: Material(color: Colors.transparent, child: SizedBox(width: 270, child: Opacity(opacity: .92, child: card))),
    childWhenDragging: Opacity(opacity: .3, child: card),
    child: card,
  );
}

/// T05 · Tracker (Kanban seret-lepas / Daftar)
class TrackerScreen extends StatefulWidget {
  const TrackerScreen({super.key});
  @override
  State<TrackerScreen> createState() => _TrackerScreenState();
}

class _TrackerScreenState extends State<TrackerScreen> {
  int type = 0;
  bool mine = false, kanban = true;
  String project = '', severity = '';
  String? hoverCol;
  List<Map<String, dynamic>>? all;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final l = asList(await Api.i.get('/api/bugs'));
      if (mounted) setState(() { all = l; error = null; });
    } on ApiError catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  Future<void> _move(Map<String, dynamic> b, String status) async {
    if (b['status'] == status) return;
    final old = '${b['status']}';
    setState(() => b['status'] = status);
    try {
      await Api.i.patch('/api/bugs/${b['id']}', {'status': status});
      if (mounted) toast(context, '${b['code']} dipindah ke ${status[0].toUpperCase()}${status.substring(1)}.');
    } on ApiError catch (e) {
      if (mounted) { setState(() => b['status'] = old); toast(context, e.message, error: true); }
    }
  }

  Widget _dd(String hint, String value, List<String> opts, ValueChanged<String> on) => Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: C.line)),
        child: DropdownButtonHideUnderline(child: DropdownButton<String>(
          value: value, isDense: true, style: const TextStyle(color: C.ink, fontSize: 14),
          items: [DropdownMenuItem(value: '', child: Text(hint)), for (final o in opts) DropdownMenuItem(value: o, child: Text(o[0].toUpperCase() + o.substring(1)))],
          onChanged: (v) => on(v ?? ''),
        )),
      );

  @override
  Widget build(BuildContext context) {
    final me = Api.i.session!.user['id'];
    return Scaffold(
      appBar: const TopBar('Tracker'),
      body: error != null
          ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(error!), const SizedBox(height: 8), OutlinedButton(onPressed: _load, child: const Text('Coba lagi'))]))
          : all == null
              ? const Center(child: CircularProgressIndicator())
              : _body(me),
    );
  }

  Widget _body(dynamic me) {
    final all = this.all!;
    int cnt(String t) => all.where((b) => b['type'] == t).length;
    final projects = {for (final b in all) '${b['projectName']}'}.toList()..sort();
    var list = all;
    if (type > 0) list = list.where((b) => b['type'] == ['', 'bug', 'fitur', 'tugas'][type]).toList();
    if (mine) list = list.where((b) => b['assigneeId'] == me).toList();
    if (project.isNotEmpty) list = list.where((b) => '${b['projectName']}' == project).toList();
    if (severity.isNotEmpty) list = list.where((b) => b['severity'] == severity).toList();
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(12),
        child: Wrap(spacing: 10, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
          Chips(['Semua · ${all.length}', 'Bug · ${cnt('bug')}', 'Fitur · ${cnt('fitur')}', 'Tugas · ${cnt('tugas')}'], type, (i) => setState(() => type = i)),
          _dd('Keparahan', severity, const ['kritis', 'tinggi', 'sedang', 'rendah'], (v) => setState(() => severity = v)),
          _dd('Proyek', project, projects, (v) => setState(() => project = v)),
          Row(mainAxisSize: MainAxisSize.min, children: [const Text('Milik saya'), Switch(value: mine, onChanged: (v) => setState(() => mine = v), activeThumbColor: C.green)]),
          SegmentedButton<bool>(showSelectedIcon: false, segments: const [ButtonSegment(value: true, label: Text('Kanban')), ButtonSegment(value: false, label: Text('Daftar'))], selected: {kanban}, onSelectionChanged: (s) => setState(() => kanban = s.first)),
        ]),
      ),
      Expanded(
        child: kanban
            ? LayoutBuilder(builder: (c, k) {
                final w = (k.maxWidth - 24 - 12 * 3) / 4;
                final cols = [for (final col in _cols) _column(col, list.where((b) => b['status'] == col.$1).toList())];
                if (w >= 230) {
                  return Padding(padding: const EdgeInsets.fromLTRB(12, 0, 12, 12), child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    for (var i = 0; i < cols.length; i++) ...[if (i > 0) const SizedBox(width: 12), Expanded(child: cols[i])],
                  ]));
                }
                return ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.fromLTRB(12, 0, 12, 12), children: [for (final col in cols) Padding(padding: const EdgeInsets.only(right: 12), child: SizedBox(width: 260, child: col))]);
              })
            : ListView(padding: const EdgeInsets.fromLTRB(12, 0, 12, 12), children: [for (final b in list) bugCard(context, b, onBack: _load)]),
      ),
    ]);
  }

  Widget _column((String, String, Color) col, List<Map<String, dynamic>> items) => DragTarget<Map<String, dynamic>>(
        onWillAcceptWithDetails: (d) => d.data['status'] != col.$1,
        onMove: (_) { if (hoverCol != col.$1) setState(() => hoverCol = col.$1); },
        onLeave: (_) { if (hoverCol == col.$1) setState(() => hoverCol = null); },
        onAcceptWithDetails: (d) { setState(() => hoverCol = null); _move(d.data, col.$1); },
        builder: (c, cand, rej) => Container(
          decoration: BoxDecoration(color: cand.isNotEmpty ? C.greenSoft.withValues(alpha: .6) : Colors.transparent, borderRadius: BorderRadius.circular(12), border: cand.isNotEmpty ? Border.all(color: C.green) : null),
          padding: const EdgeInsets.all(4),
          child: Column(children: [
            Padding(padding: const EdgeInsets.fromLTRB(4, 4, 4, 8), child: Row(children: [Icon(Icons.circle, size: 10, color: col.$3), const SizedBox(width: 6), Text(col.$2, style: const TextStyle(fontWeight: FontWeight.w700)), const Spacer(), Text('${items.length}', style: const TextStyle(color: C.mute))])),
            Expanded(child: ListView(children: [for (final b in items) bugCard(context, b, onBack: _load, draggable: true), if (items.isEmpty) const Padding(padding: EdgeInsets.all(12), child: Text('Seret kartu ke sini', textAlign: TextAlign.center, style: TextStyle(color: C.mute, fontSize: 12)))])),
          ]),
        ),
      );
}
