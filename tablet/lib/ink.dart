import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

class Stroke {
  final List<Offset> pts = [];
  final List<double> w = [];
  final Color color;
  final double base;
  final bool highlighter;
  final List<int> t = [];
  int? anno;
  Stroke(this.color, this.base, {this.highlighter = false});

  Map<String, dynamic> toJson() => {
        'c': color.toARGB32(), 'b': base, 'h': highlighter, 'a': anno,
        'p': [for (var i = 0; i < pts.length; i++) [pts[i].dx, pts[i].dy, w[i], i < t.length ? t[i] : 0]],
      };
  static Stroke fromJson(Map<String, dynamic> j) {
    final s = Stroke(Color(j['c'] as int), (j['b'] as num).toDouble(), highlighter: j['h'] == true)..anno = j['a'] as int?;
    for (final p in j['p'] as List) {
      s.pts.add(Offset((p[0] as num).toDouble(), (p[1] as num).toDouble()));
      s.w.add((p[2] as num).toDouble());
      s.t.add((p[3] as num).toInt());
    }
    return s;
  }
}

class InkController extends ChangeNotifier {
  final List<Stroke> strokes = [];
  final List<Stroke> _redo = [];
  void add(Stroke s) { strokes.add(s); _redo.clear(); notifyListeners(); }
  void touch() => notifyListeners();
  void undo() { if (strokes.isNotEmpty) { _redo.add(strokes.removeLast()); notifyListeners(); } }
  void redo() { if (_redo.isNotEmpty) { strokes.add(_redo.removeLast()); notifyListeners(); } }
  void clear() { strokes.clear(); _redo.clear(); notifyListeners(); }
  bool get isEmpty => strokes.isEmpty;
  void removeAnno(int id) { strokes.removeWhere((s) => s.anno == id); notifyListeners(); }
  List<Map<String, dynamic>> toJson() => [for (final s in strokes) s.toJson()];
  void loadJson(List<dynamic> l) { strokes..clear()..addAll(l.map((e) => Stroke.fromJson((e as Map).cast<String, dynamic>()))); notifyListeners(); }

  /// Hapus goresan yang dekat dengan titik [p].
  void eraseAt(Offset p, double r) {
    final before = strokes.length;
    strokes.removeWhere((s) => s.pts.any((q) => (q - p).distance < r));
    if (strokes.length != before) notifyListeners();
  }

  /// PNG dengan latar transparan (untuk tanda tangan).
  Future<String> toPngDataUrl(Size size, {double scale = 2}) async {
    final rec = ui.PictureRecorder();
    final c = Canvas(rec);
    c.scale(scale);
    InkPainter(this).paint(c, size);
    final img = await rec.endRecording().toImage((size.width * scale).round(), (size.height * scale).round());
    final data = await img.toByteData(format: ui.ImageByteFormat.png);
    return 'data:image/png;base64,${base64Encode(data!.buffer.asUint8List())}';
  }
}

class InkPainter extends CustomPainter {
  final InkController ctl;
  InkPainter(this.ctl) : super(repaint: ctl);
  @override
  void paint(Canvas canvas, Size size) {
    for (final s in ctl.strokes) {
      if (s.pts.isEmpty) continue;
      final p = Paint()
        ..color = s.highlighter ? s.color.withValues(alpha: .35) : s.color
        ..strokeCap = s.highlighter ? StrokeCap.butt : StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke;
      if (s.pts.length == 1) {
        canvas.drawCircle(s.pts.first, s.base / 2, Paint()..color = p.color);
        continue;
      }
      for (var i = 1; i < s.pts.length; i++) {
        p.strokeWidth = s.highlighter ? s.base : (s.w[i] * s.base).clamp(.8, 24);
        canvas.drawLine(s.pts[i - 1], s.pts[i], p);
      }
    }
  }
  @override
  bool shouldRepaint(InkPainter o) => true;
}

/// Kanvas tulis: hanya ujung stylus bila [stylusOnly] (telapak tangan diabaikan); mouse selalu diterima.
class InkPad extends StatelessWidget {
  final InkController ctl;
  final Color color;
  final double width;
  final bool stylusOnly;
  final bool highlighter;
  final bool eraser;
  final void Function(Stroke)? onStroke;
  const InkPad({super.key, required this.ctl, this.color = const Color(0xFF1E3A8A), this.width = 3, this.stylusOnly = true, this.highlighter = false, this.eraser = false, this.onStroke});

  bool _ok(PointerEvent e) {
    if (e.kind == PointerDeviceKind.mouse) return true;
    if (e.kind == PointerDeviceKind.stylus || e.kind == PointerDeviceKind.invertedStylus) return true;
    return !stylusOnly;
  }

  @override
  Widget build(BuildContext context) {
    Stroke? cur;
    return Listener(
      behavior: HitTestBehavior.opaque,
      onPointerDown: (e) {
        if (!_ok(e)) return;
        if (eraser || e.kind == PointerDeviceKind.invertedStylus) { ctl.eraseAt(e.localPosition, 14); cur = null; return; }
        cur = Stroke(color, width, highlighter: highlighter);
        cur!.pts.add(e.localPosition);
        cur!.w.add(_pressure(e));
        cur!.t.add(e.timeStamp.inMilliseconds);
        ctl.strokes.add(cur!);
        ctl.touch();
      },
      onPointerMove: (e) {
        if (!_ok(e)) return;
        if (eraser || e.kind == PointerDeviceKind.invertedStylus) { ctl.eraseAt(e.localPosition, 14); return; }
        final s = cur;
        if (s == null) return;
        s.pts.add(e.localPosition);
        s.w.add(_pressure(e));
        s.t.add(e.timeStamp.inMilliseconds);
        ctl.touch();
      },
      onPointerUp: (e) { final s = cur; if (s != null) { cur = null; onStroke?.call(s); } },
      onPointerCancel: (e) => cur = null,
      child: CustomPaint(painter: InkPainter(ctl), size: Size.infinite),
    );
  }

  double _pressure(PointerEvent e) {
    if (e.pressureMax <= e.pressureMin) return 1;
    final p = (e.pressure - e.pressureMin) / (e.pressureMax - e.pressureMin);
    return (.45 + p * .9).clamp(.45, 1.4);
  }
}
