import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class C {
  static const green = Color(0xFF0F7B66);
  static const greenSoft = Color(0xFFE3F4EE);
  static const navy = Color(0xFF111C2D);
  static const bg = Color(0xFFF4F6F9);
  static const line = Color(0xFFE5E9EF);
  static const ink = Color(0xFF111827);
  static const mute = Color(0xFF6B7280);
  static const red = Color(0xFFDC2626);
  static const redSoft = Color(0xFFFDE8E8);
  static const amber = Color(0xFFD97706);
  static const amberSoft = Color(0xFFFEF3C7);
  static const blue = Color(0xFF2563EB);
  static const blueSoft = Color(0xFFDBEAFE);
  static const purple = Color(0xFF7C3AED);
}

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: C.green, primary: C.green, surface: Colors.white),
    scaffoldBackgroundColor: C.bg,
    fontFamily: 'Roboto',
  );
  return base.copyWith(
    appBarTheme: const AppBarTheme(backgroundColor: Colors.white, foregroundColor: C.ink, elevation: 0, scrolledUnderElevation: 0),
    inputDecorationTheme: InputDecorationTheme(
      isDense: true,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: C.line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: C.line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: C.green, width: 1.5)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(backgroundColor: C.green, minimumSize: const Size(0, 44), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(foregroundColor: C.ink, minimumSize: const Size(0, 44), side: const BorderSide(color: C.line), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
    ),
  );
}

final _rp = NumberFormat.decimalPattern('id_ID');
String rp(num? v) => v == null ? '—' : 'Rp ${_rp.format(v)}';
String rpShort(num v) {
  if (v.abs() >= 1e9) return 'Rp ${(v / 1e9).toStringAsFixed(1)} M';
  if (v.abs() >= 1e6) return 'Rp ${(v / 1e6).toStringAsFixed(v.abs() >= 1e8 ? 0 : 1)} jt';
  return rp(v);
}

const _bln = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
String tgl(dynamic v) {
  if (v == null) return '—';
  final d = DateTime.tryParse(v.toString())?.toLocal();
  if (d == null) return v.toString();
  return '${d.day} ${_bln[d.month - 1]} ${d.year}';
}
String tglJam(dynamic v) {
  final d = DateTime.tryParse(v?.toString() ?? '')?.toLocal();
  if (d == null) return '—';
  return '${d.day} ${_bln[d.month - 1]} ${d.year} · ${d.hour.toString().padLeft(2, '0')}.${d.minute.toString().padLeft(2, '0')}';
}
