import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// URL produksi OCN Project Hub.
const kBaseUrl = String.fromEnvironment('API_BASE', defaultValue: 'https://project-hub.ocnetworks.web.id');

class ApiError implements Exception {
  final String message;
  final int? status;
  ApiError(this.message, [this.status]);
  @override
  String toString() => message;
}

class Session {
  final Map<String, dynamic> user;
  Session(this.user);
  String get name => '${user['name'] ?? ''}';
  String get role => '${user['role'] ?? ''}';
  String get initials {
    final p = name.trim().split(RegExp(r'\s+'));
    return p.isEmpty || p.first.isEmpty ? '?' : (p.first[0] + (p.length > 1 ? p.last[0] : '')).toUpperCase();
  }
  Map<String, dynamic> get access => (user['access'] as Map?)?.cast<String, dynamic>() ?? {};
  bool get isAdmin => role == 'admin';
  bool has(String module, List<String> levels) => isAdmin || levels.contains(access[module]);
}

/// Klien API: sesi lewat cookie `ocn_session` yang disimpan di perangkat.
class Api {
  Api._();
  static final Api i = Api._();
  final Dio _dio = Dio(BaseOptions(
    baseUrl: kBaseUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 40),
    validateStatus: (s) => s != null && s < 400,
  ));
  String? _cookie;
  Session? session;

  Future<void> init() async {
    final p = await SharedPreferences.getInstance();
    _cookie = p.getString('cookie');
  }

  void _capture(Response r) {
    for (final c in r.headers['set-cookie'] ?? const <String>[]) {
      final kv = c.split(';').first;
      if (kv.startsWith('ocn_session=')) {
        _cookie = kv.endsWith('=') ? null : kv;
        SharedPreferences.getInstance().then((p) => _cookie == null ? p.remove('cookie') : p.setString('cookie', _cookie!));
      }
    }
  }

  Future<Response<T>> _send<T>(String method, String path, {Map<String, dynamic>? q, Object? data, ResponseType? rt}) async {
    try {
      final r = await _dio.request<T>(path,
          queryParameters: q,
          data: data,
          options: Options(method: method, headers: {if (_cookie != null) 'Cookie': _cookie}, responseType: rt));
      _capture(r);
      return r;
    } on DioException catch (e) {
      final res = e.response;
      if (res != null) {
        _capture(res);
        var msg = 'Terjadi kesalahan (${res.statusCode}).';
        final d = res.data;
        try {
          final m = d is String ? jsonDecode(d) : (d is List<int> ? jsonDecode(utf8.decode(d)) : d);
          if (m is Map) msg = '${m['statusMessage'] ?? m['message'] ?? msg}';
        } catch (_) {}
        if (res.statusCode == 401) session = null;
        throw ApiError(msg, res.statusCode);
      }
      throw ApiError('Tidak bisa terhubung ke server. Periksa koneksi internet.');
    }
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? q}) async => (await _send<dynamic>('GET', path, q: q)).data;
  Future<dynamic> post(String path, [Object? body]) async => (await _send<dynamic>('POST', path, data: body ?? {})).data;
  Future<dynamic> patch(String path, Object body) async => (await _send<dynamic>('PATCH', path, data: body)).data;
  Future<dynamic> put(String path, Object body) async => (await _send<dynamic>('PUT', path, data: body)).data;
  Future<dynamic> delete(String path) async => (await _send<dynamic>('DELETE', path)).data;
  Future<List<int>> bytes(String path, {Map<String, dynamic>? q}) async =>
      ((await _send<List<int>>('GET', path, q: q, rt: ResponseType.bytes)).data as List<int>);

  Future<Session> login(String email, String password, bool remember) async {
    await post('/api/auth/login', {'email': email.trim(), 'password': password, 'remember': remember});
    return (await restore())!;
  }

  Future<Session?> restore() async {
    if (_cookie == null) return null;
    try {
      final d = await get('/api/auth/me');
      final u = (d as Map)['user'];
      if (u == null) return null;
      return session = Session((u as Map).cast<String, dynamic>());
    } on ApiError {
      return null;
    }
  }

  Future<void> logout() async {
    try { await post('/api/auth/logout'); } catch (_) {}
    _cookie = null;
    session = null;
    (await SharedPreferences.getInstance()).remove('cookie');
  }
}

List<Map<String, dynamic>> asList(dynamic v) => (v as List? ?? const []).map((e) => (e as Map).cast<String, dynamic>()).toList();
Map<String, dynamic> asMap(dynamic v) => (v as Map? ?? const {}).cast<String, dynamic>();
num n(dynamic v) => v is num ? v : (num.tryParse('$v') ?? 0);
