import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';
import '../widgets.dart';
import 'dashboard.dart';
import 'projects.dart';
import 'payments.dart';
import 'tracker.dart';
import 'investors.dart';
import 'reports.dart';
import 'tasks.dart';
import 'settings.dart';

class _Dest {
  final String label;
  final IconData icon;
  final Widget Function() root;
  _Dest(this.label, this.icon, this.root);
}

/// Kerangka tablet: rel navigasi gelap di kiri, tiap tujuan punya tumpukan layar sendiri.
class Shell extends StatefulWidget {
  final Session session;
  final VoidCallback onLogout;
  const Shell({super.key, required this.session, required this.onLogout});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int index = 0;
  late final List<_Dest> dests;
  late final List<GlobalKey<NavigatorState>> keys;

  @override
  void initState() {
    super.initState();
    final s = widget.session;
    final isDev = s.role == 'developer';
    dests = [
      if (s.has('laporan', ['lihat']) && !isDev) _Dest('Dashboard', Icons.dashboard_outlined, () => const DashboardScreen()),
      if (isDev || (s.has('bug', ['ditugaskan']) && !s.has('bug', ['kelola', 'lihat']))) _Dest('Tugas', Icons.task_alt, () => const TasksScreen()),
      if (s.has('proyek', ['lihat', 'kelola'])) _Dest('Proyek', Icons.folder_outlined, () => const ProjectsScreen()),
      if (s.has('keuangan', ['lihat', 'kelola'])) _Dest('Pembayaran', Icons.account_balance_wallet_outlined, () => const PaymentsScreen()),
      if (s.has('bug', ['lihat', 'ditugaskan', 'kelola'])) _Dest('Tracker', Icons.bug_report_outlined, () => const TrackerScreen()),
      if (s.has('investor', ['lihat', 'kelola'])) _Dest('Investor', Icons.people_outline, () => const InvestorsScreen()),
      if (s.has('laporan', ['lihat'])) _Dest('Laporan', Icons.description_outlined, () => const ReportsScreen()),
      _Dest('Pengaturan', Icons.settings_outlined, () => SettingsScreen(session: s, onLogout: widget.onLogout)),
    ];
    keys = List.generate(dests.length, (_) => GlobalKey<NavigatorState>());
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        final nav = keys[index].currentState;
        if (nav != null && nav.canPop()) nav.pop();
      },
      child: Scaffold(
        backgroundColor: Colors.white,
        body: SafeArea(child: Row(children: [
          Container(
            width: 84,
            color: C.navy,
            child: SafeArea(
              child: Column(children: [
                const SizedBox(height: 14),
                const LogoMark(size: 40),
                const SizedBox(height: 14),
                Expanded(
                  child: ListView(children: [
                    for (var i = 0; i < dests.length; i++) _item(i),
                  ]),
                ),
              ]),
            ),
          ),
          Expanded(
            child: IndexedStack(index: index, children: [
              for (var i = 0; i < dests.length; i++)
                Navigator(key: keys[i], onGenerateRoute: (_) => MaterialPageRoute(builder: (_) => dests[i].root())),
            ]),
          ),
        ])),
      ),
    );
  }

  Widget _item(int i) {
    final sel = i == index;
    return InkWell(
      onTap: () {
        if (sel) { keys[i].currentState?.popUntil((r) => r.isFirst); }
        setState(() => index = i);
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(color: sel ? const Color(0xFF1E2E45) : Colors.transparent, borderRadius: BorderRadius.circular(10)),
          child: Column(children: [
            Icon(dests[i].icon, color: sel ? const Color(0xFF5EEAD4) : const Color(0xFF9AA7BA), size: 24),
            const SizedBox(height: 4),
            Text(dests[i].label, style: TextStyle(fontSize: 10.5, color: sel ? Colors.white : const Color(0xFF9AA7BA), fontWeight: sel ? FontWeight.w700 : FontWeight.w500)),
          ]),
        ),
      ),
    );
  }
}
