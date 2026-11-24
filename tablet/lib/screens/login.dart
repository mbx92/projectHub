import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';

/// T01 · Masuk
class LoginScreen extends StatefulWidget {
  final void Function(Session) onLoggedIn;
  const LoginScreen({super.key, required this.onLoggedIn});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final pass = TextEditingController();
  bool remember = true, busy = false;
  String? error;

  Future<void> submit() async {
    if (email.text.trim().isEmpty || pass.text.isEmpty) { setState(() => error = 'Email dan kata sandi wajib diisi.'); return; }
    setState(() { busy = true; error = null; });
    try {
      widget.onLoggedIn(await Api.i.login(email.text, pass.text, remember));
    } on ApiError catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final form = Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: C.line)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              const Text('Masuk', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              const Text('Gunakan akun yang dikirim lewat undangan.', style: TextStyle(color: C.mute)),
              const SizedBox(height: 22),
              const Text('Email', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              TextField(controller: email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email], decoration: const InputDecoration(hintText: 'nama@email.com')),
              const SizedBox(height: 16),
              const Text('Kata sandi', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              TextField(controller: pass, obscureText: true, onSubmitted: (_) => submit(), decoration: const InputDecoration(hintText: '••••••••')),
              const SizedBox(height: 10),
              Row(children: [
                Checkbox(value: remember, onChanged: (v) => setState(() => remember = v ?? true), activeColor: C.green),
                const Text('Ingat saya'),
                const Spacer(),
                TextButton(onPressed: forgot, child: const Text('Lupa kata sandi?')),
              ]),
              if (error != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(error!, style: const TextStyle(color: C.red))),
              FilledButton(onPressed: busy ? null : submit, child: busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('Masuk')),
              const SizedBox(height: 18),
              const Text('Belum punya akses? Hubungi admin OCN Development.', textAlign: TextAlign.center, style: TextStyle(color: C.mute, fontSize: 12)),
            ]),
          ),
        ),
      ),
    );
    final hero = Container(
      color: C.navy,
      padding: const EdgeInsets.all(40),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const LogoMark(size: 40),
          const SizedBox(width: 12),
          const Text('OCN Project Hub', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
        ]),
        const Spacer(),
        const Text('Proyek, pembayaran, dan bagi hasil dalam satu tempat.', style: TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w700, height: 1.15)),
        const SizedBox(height: 24),
        const Text('Tim melihat progres dan bug, investor melihat modal dan hasilnya secara transparan.', style: TextStyle(color: Color(0xFFB8C2D1), fontSize: 15)),
        const Spacer(),
      ]),
    );
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(child: LayoutBuilder(builder: (c, k) => k.maxWidth > 800 ? Row(children: [Expanded(child: hero), Expanded(child: form)]) : form)),
    );
  }

  void forgot() {
    final c = TextEditingController(text: email.text);
    showDialog<void>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Atur ulang kata sandi'),
      content: TextField(controller: c, decoration: const InputDecoration(hintText: 'Email akun')),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
        FilledButton(onPressed: () async {
          try { await Api.i.post('/api/auth/forgot', {'email': c.text.trim()}); } catch (_) {}
          if (ctx.mounted) Navigator.pop(ctx);
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Jika email terdaftar, tautan pengaturan ulang telah dikirim.')));
        }, child: const Text('Kirim')),
      ],
    ));
  }
}
