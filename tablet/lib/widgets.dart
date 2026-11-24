import 'package:flutter/material.dart';
import 'api.dart';
import 'theme.dart';

class Panel extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  final Color? color;
  final Color? border;
  const Panel({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.color, this.border});
  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(color: color ?? Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: border ?? C.line)),
        child: child,
      );
}

class Pill extends StatelessWidget {
  final String text;
  final Color fg;
  final Color bg;
  const Pill(this.text, {super.key, this.fg = C.mute, this.bg = const Color(0xFFF1F3F6)});
  factory Pill.status(String s) {
    final k = s.toLowerCase();
    Color fg = C.mute, bg = const Color(0xFFF1F3F6);
    if (['lunas', 'selesai', 'final', 'aktif', 'sudah', 'ditandatangani', 'diterima'].contains(k)) { fg = const Color(0xFF047857); bg = C.greenSoft; }
    if (['berjalan', 'terkirim', 'dikerjakan', 'review', 'menulis'].contains(k)) { fg = C.blue; bg = C.blueSoft; }
    if (['persiapan', 'calon', 'menunggu', 'draf', 'draft', 'open', 'sebagian'].contains(k)) { fg = const Color(0xFFB45309); bg = C.amberSoft; }
    if (['tertunda', 'terlambat', 'kritis', 'batal', 'kedaluwarsa', 'dibatalkan'].contains(k)) { fg = C.red; bg = C.redSoft; }
    if (k == 'tinggi') { fg = C.amber; bg = C.amberSoft; }
    if (k == 'sedang') { fg = C.blue; bg = C.blueSoft; }
    if (k == 'review') { fg = C.purple; bg = const Color(0xFFEDE9FE); }
    return Pill(s.isEmpty ? '' : s[0].toUpperCase() + s.substring(1), fg: fg, bg: bg);
  }
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
        child: Text(text, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600)),
      );
}

class Kpi extends StatelessWidget {
  final String label, value, sub;
  final Color? valueColor;
  const Kpi(this.label, this.value, {super.key, this.sub = '', this.valueColor});
  @override
  Widget build(BuildContext context) => Panel(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text(label, style: const TextStyle(color: C.mute, fontSize: 12)),
          const SizedBox(height: 6),
          FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: valueColor ?? C.ink))),
          if (sub.isNotEmpty) ...[const SizedBox(height: 4), Text(sub, style: const TextStyle(color: C.mute, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis)],
        ]),
      );
}

class KpiRow extends StatelessWidget {
  final List<Widget> items;
  const KpiRow(this.items, {super.key});
  @override
  Widget build(BuildContext context) => Row(children: [
        for (var i = 0; i < items.length; i++) ...[if (i > 0) const SizedBox(width: 12), Expanded(child: items[i])],
      ]);
}

class H extends StatelessWidget {
  final String t;
  final Widget? trailing;
  const H(this.t, {super.key, this.trailing});
  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(child: Text(t, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
        if (trailing != null) trailing!,
      ]);
}

class Progress extends StatelessWidget {
  final num value;
  final Color color;
  const Progress(this.value, {super.key, this.color = C.green});
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(99),
        child: LinearProgressIndicator(value: (value / 100).clamp(0, 1).toDouble(), minHeight: 7, backgroundColor: const Color(0xFFE5E9EF), color: color),
      );
}

class Avatar extends StatelessWidget {
  final String text;
  final double size;
  final Color? color;
  const Avatar(this.text, {super.key, this.size = 36, this.color});
  @override
  Widget build(BuildContext context) => Container(
        width: size, height: size, alignment: Alignment.center,
        decoration: BoxDecoration(color: color ?? C.green, shape: BoxShape.circle),
        child: Text(text, style: TextStyle(color: Colors.white, fontSize: size * .36, fontWeight: FontWeight.w700)),
      );
}

String initialsOf(String? name) {
  final p = (name ?? '?').trim().split(RegExp(r'\s+'));
  return (p.first.isEmpty ? '?' : p.first[0] + (p.length > 1 ? p.last[0] : '')).toUpperCase();
}

Color hexColor(dynamic v, [Color fallback = C.green]) {
  final s = '$v'.replaceAll('#', '');
  if (s.length == 6) { final x = int.tryParse(s, radix: 16); if (x != null) return Color(0xFF000000 | x); }
  return fallback;
}

/// Memuat data async dengan status memuat / galat / coba lagi.
class Loader<T> extends StatefulWidget {
  final Future<T> Function() load;
  final Widget Function(BuildContext, T, Future<void> Function() reload) builder;
  const Loader({super.key, required this.load, required this.builder});
  @override
  State<Loader<T>> createState() => _LoaderState<T>();
}

class _LoaderState<T> extends State<Loader<T>> {
  late Future<T> f = widget.load();
  Future<void> reload() async {
    final nf = widget.load();
    setState(() => f = nf);
    try { await nf; } catch (_) {}
  }
  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
        future: f,
        builder: (c, s) {
          if (s.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (s.hasError) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.cloud_off, size: 40, color: C.mute),
              const SizedBox(height: 8),
              Text('${s.error}', textAlign: TextAlign.center),
              const SizedBox(height: 12),
              OutlinedButton(onPressed: reload, child: const Text('Coba lagi')),
            ]));
          }
          return widget.builder(c, s.data as T, reload);
        },
      );
}

void toast(BuildContext c, String m, {bool error = false}) {
  ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(m), backgroundColor: error ? C.red : C.navy, behavior: SnackBarBehavior.floating));
}

Future<void> guard(BuildContext c, Future<void> Function() fn, {String? ok}) async {
  try {
    await fn();
    if (ok != null && c.mounted) toast(c, ok);
  } on ApiError catch (e) {
    if (c.mounted) toast(c, e.message, error: true);
  }
}

/// Kepala halaman: judul, aksi, lonceng, avatar.
class TopBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget> actions;
  final bool back;
  final Widget? bottom;
  const TopBar(this.title, {super.key, this.actions = const [], this.back = false, this.bottom});
  @override
  Size get preferredSize => const Size.fromHeight(64);
  @override
  Widget build(BuildContext context) => Container(
        height: 64,
        decoration: const BoxDecoration(color: Colors.white, border: Border(bottom: BorderSide(color: C.line))),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(children: [
          if (back) IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.maybePop(context)),
          Expanded(child: Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis)),
          for (final a in actions) Padding(padding: const EdgeInsets.only(left: 8), child: a),
          const SizedBox(width: 8),
          Avatar(Api.i.session?.initials ?? '?'),
        ]),
      );
}

Widget topBtn(String label, VoidCallback? onTap, {IconData? icon, bool primary = false}) {
  final child = Row(mainAxisSize: MainAxisSize.min, children: [
    if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 6)],
    Text(label),
  ]);
  return primary ? FilledButton(onPressed: onTap, child: child) : OutlinedButton(onPressed: onTap, child: child);
}

class Tabs extends StatelessWidget {
  final List<String> labels;
  final int index;
  final ValueChanged<int> onTap;
  const Tabs(this.labels, this.index, this.onTap, {super.key});
  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(children: [
          for (var i = 0; i < labels.length; i++)
            InkWell(
              onTap: () => onTap(i),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: i == index ? C.green : Colors.transparent, width: 2))),
                child: Text(labels[i], style: TextStyle(fontWeight: i == index ? FontWeight.w700 : FontWeight.w500, color: i == index ? C.green : C.mute)),
              ),
            ),
        ]),
      );
}

class Chips extends StatelessWidget {
  final List<String> labels;
  final int index;
  final ValueChanged<int> onTap;
  const Chips(this.labels, this.index, this.onTap, {super.key});
  @override
  Widget build(BuildContext context) => Wrap(spacing: 8, runSpacing: 8, children: [
        for (var i = 0; i < labels.length; i++)
          ChoiceChip(label: Text(labels[i]), selected: i == index, onSelected: (_) => onTap(i), selectedColor: C.green, labelStyle: TextStyle(color: i == index ? Colors.white : C.ink, fontWeight: FontWeight.w600), showCheckmark: false, backgroundColor: Colors.white, side: const BorderSide(color: C.line)),
      ]);
}

class Empty extends StatelessWidget {
  final String text;
  const Empty(this.text, {super.key});
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.all(24), child: Center(child: Text(text, style: const TextStyle(color: C.mute))));
}

class Row2 extends StatelessWidget {
  final String k;
  final String v;
  const Row2(this.k, this.v, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [Expanded(child: Text(k, style: const TextStyle(color: C.mute, fontSize: 13))), Text(v, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))]),
      );
}

/// Logo OCN Project Hub (sama dengan public/logo-mark.svg).
class LogoMark extends StatelessWidget {
  final double size;
  const LogoMark({super.key, this.size = 40});
  @override
  Widget build(BuildContext context) => SizedBox(width: size, height: size, child: CustomPaint(painter: _LogoPainter()));
}

class _LogoPainter extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final k = s.width / 64;
    c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(0, 0, s.width, s.height), Radius.circular(14 * k)), Paint()..color = const Color(0xFF0B6E63));
    final line = Paint()..color = const Color(0xFF5FD3C1)..strokeWidth = 3.5 * k..strokeCap = StrokeCap.round;
    c.drawLine(Offset(32 * k, 32 * k), Offset(32 * k, 15 * k), line);
    c.drawLine(Offset(32 * k, 32 * k), Offset(17.5 * k, 40.5 * k), line);
    c.drawLine(Offset(32 * k, 32 * k), Offset(46.5 * k, 40.5 * k), line);
    c.drawCircle(Offset(32 * k, 32 * k), 8 * k, Paint()..color = Colors.white);
    final dot = Paint()..color = const Color(0xFF5FD3C1);
    c.drawCircle(Offset(32 * k, 14 * k), 5 * k, dot);
    c.drawCircle(Offset(16 * k, 41 * k), 5 * k, dot);
    c.drawCircle(Offset(48 * k, 41 * k), 5 * k, dot);
  }
  @override
  bool shouldRepaint(covariant CustomPainter o) => false;
}

/// Tabel bergaya: kepala berlatar, garis antarbaris, belang-belang, kolom angka rata kanan,
/// baris "Total" disorot. Sel boleh berupa String atau Widget (mis. Pill).
class AppTable extends StatelessWidget {
  final List<String> head;
  final List<List<dynamic>> rows;
  final List<int> right;
  final List<int>? flex;
  final bool zebra;
  const AppTable({super.key, required this.head, required this.rows, this.right = const [], this.flex, this.zebra = true});

  @override
  Widget build(BuildContext context) {
    TextAlign al(int i) => right.contains(i) ? TextAlign.right : TextAlign.left;
    Widget cell(dynamic v, int i, {bool bold = false, Color? color}) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          child: v is Widget
              ? Align(alignment: right.contains(i) ? Alignment.centerRight : Alignment.centerLeft, child: v)
              : Text('$v', textAlign: al(i), style: TextStyle(fontSize: 13.5, fontWeight: bold ? FontWeight.w700 : FontWeight.w400, color: color ?? C.ink)),
        );
    final totalRow = rows.isNotEmpty && rows.last.isNotEmpty && '${rows.last.first}'.toLowerCase() == 'total';
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: C.line)),
      clipBehavior: Clip.antiAlias,
      child: Table(
        columnWidths: {for (var i = 0; i < head.length; i++) i: FlexColumnWidth((flex != null && i < flex!.length ? flex![i] : (i == 0 ? 3 : 2)).toDouble())},
        defaultVerticalAlignment: TableCellVerticalAlignment.middle,
        border: const TableBorder(horizontalInside: BorderSide(color: C.line)),
        children: [
          TableRow(
            decoration: const BoxDecoration(color: Color(0xFFEFF4F3)),
            children: [for (var i = 0; i < head.length; i++) Padding(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12), child: Text(head[i].toUpperCase(), textAlign: al(i), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: C.mute, letterSpacing: .6)))],
          ),
          for (var r = 0; r < rows.length; r++)
            TableRow(
              decoration: BoxDecoration(color: totalRow && r == rows.length - 1 ? C.greenSoft : (zebra && r.isOdd ? const Color(0xFFF8FAFB) : Colors.white)),
              children: [for (var i = 0; i < head.length; i++) cell(i < rows[r].length ? rows[r][i] : '', i, bold: totalRow && r == rows.length - 1, color: i == 0 && !(totalRow && r == rows.length - 1) ? C.green : null)],
            ),
        ],
      ),
    );
  }
}
