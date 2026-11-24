import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_mlkit_digital_ink_recognition/google_mlkit_digital_ink_recognition.dart' as ml;
import '../ink.dart';
import '../theme.dart';

/// T18 · Tulisan tangan jadi teks. Dikenali di perangkat dengan ML Kit (bahasa Indonesia);
/// model bahasa diunduh sekali saat pertama dipakai.
class HandwritePanel extends StatefulWidget {
  final void Function(String text) onInsert;
  final bool stylusOnly;
  final bool autoInsert;
  const HandwritePanel({super.key, required this.onInsert, this.stylusOnly = true, this.autoInsert = false});
  @override
  State<HandwritePanel> createState() => _HandwritePanelState();
}

class _HandwritePanelState extends State<HandwritePanel> {
  static const lang = 'id';
  final ink = InkController();
  final text = TextEditingController();
  final manager = ml.DigitalInkRecognizerModelManager();
  ml.DigitalInkRecognizer? rec;
  Timer? timer;
  List<ml.RecognitionCandidate> cands = [];
  String? status;
  bool busy = false;

  @override
  void dispose() {
    timer?.cancel();
    rec?.close();
    super.dispose();
  }

  void _stroke(Stroke _) {
    timer?.cancel();
    timer = Timer(const Duration(milliseconds: 1600), _recognize);
  }

  Future<void> _recognize() async {
    if (ink.isEmpty || busy) return;
    setState(() { busy = true; status = null; });
    try {
      if (!await manager.isModelDownloaded(lang)) {
        setState(() => status = 'Mengunduh model bahasa Indonesia (sekali saja, perlu internet)…');
        await manager.downloadModel(lang);
      }
      rec ??= ml.DigitalInkRecognizer(languageCode: lang);
      final mk = ml.Ink();
      var base = 0;
      for (final s in ink.strokes) {
        final st = ml.Stroke();
        for (var i = 0; i < s.pts.length; i++) {
          final t = s.t.length > i && s.t[i] > 0 ? s.t[i] : base + i * 10;
          st.points.add(ml.StrokePoint(x: s.pts[i].dx, y: s.pts[i].dy, t: t));
        }
        if (st.points.isNotEmpty) base = st.points.last.t + 50;
        mk.strokes.add(st);
      }
      final r = await rec!.recognize(mk);
      if (!mounted) return;
      setState(() {
        cands = r;
        if (r.isNotEmpty) text.text = r.first.text;
        status = r.isEmpty ? 'Tulisan belum terbaca. Coba tulis lebih jelas.' : null;
      });
    } catch (e) {
      if (mounted) setState(() => status = 'Pengenalan gagal: $e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _clear() { ink.clear(); text.clear(); setState(() { cands = []; status = null; }); }

  void _insert() {
    if (text.text.trim().isEmpty) return;
    widget.onInsert(text.text.trim());
    _clear();
  }

  @override
  Widget build(BuildContext context) => Container(
        color: Colors.white,
        padding: const EdgeInsets.all(12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(flex: 3, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Row(children: [Icon(Icons.draw, size: 18, color: C.green), SizedBox(width: 6), Text('Tulisan tangan jadi teks', style: TextStyle(fontWeight: FontWeight.w700))]),
            const SizedBox(height: 8),
            Container(
              height: 150, width: double.infinity,
              decoration: BoxDecoration(color: C.greenSoft.withValues(alpha: .4), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFF7DD3C0))),
              child: Stack(children: [
                if (ink.isEmpty) const Center(child: Text('Tulis dengan stylus di sini', style: TextStyle(color: C.mute))),
                Positioned.fill(child: InkPad(ctl: ink, stylusOnly: widget.stylusOnly, color: const Color(0xFF0B3B7A), width: 3, onStroke: _stroke)),
              ]),
            ),
            const SizedBox(height: 6),
            Row(children: [
              OutlinedButton.icon(onPressed: () => setState(ink.undo), icon: const Icon(Icons.undo, size: 16), label: const Text('Urungkan')),
              const SizedBox(width: 8),
              OutlinedButton.icon(onPressed: _clear, icon: const Icon(Icons.delete_outline, size: 16), label: const Text('Hapus')),
              const SizedBox(width: 8),
              if (busy) const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) else TextButton(onPressed: _recognize, child: const Text('Kenali sekarang')),
            ]),
          ])),
          const SizedBox(width: 16),
          Expanded(flex: 2, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Teks dikenali · Bahasa Indonesia', style: TextStyle(fontSize: 12, color: C.mute)),
            const SizedBox(height: 6),
            TextField(controller: text, maxLines: 2, decoration: const InputDecoration(hintText: 'Hasil pengenalan muncul di sini')),
            if (cands.length > 1) ...[
              const SizedBox(height: 6),
              Wrap(spacing: 6, runSpacing: 4, children: [for (final c in cands.skip(1).take(4)) ActionChip(label: Text(c.text, style: const TextStyle(fontSize: 12)), onPressed: () => setState(() => text.text = c.text))]),
            ],
            if (status != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(status!, style: const TextStyle(fontSize: 11, color: C.mute))),
            const SizedBox(height: 8),
            Row(children: [FilledButton(onPressed: _insert, child: const Text('Sisipkan')), const SizedBox(width: 8), const Expanded(child: Text('Disisipkan sebagai paragraf baru setelah blok yang dipilih.', style: TextStyle(fontSize: 11, color: C.mute)))]),
          ])),
        ]),
      );
}
