import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'api.dart';
import 'theme.dart';
import 'screens/login.dart';
import 'screens/shell.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('id_ID');
  await SystemChrome.setPreferredOrientations([DeviceOrientation.landscapeLeft, DeviceOrientation.landscapeRight, DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.dark, systemNavigationBarColor: Colors.white, systemNavigationBarIconBrightness: Brightness.dark));
  await Api.i.init();
  runApp(const HubApp());
}

class HubApp extends StatefulWidget {
  const HubApp({super.key});
  @override
  State<HubApp> createState() => _HubAppState();
}

class _HubAppState extends State<HubApp> {
  Session? session;
  bool booting = true;

  @override
  void initState() {
    super.initState();
    Api.i.restore().then((s) => setState(() { session = s; booting = false; }));
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'OCN Project Hub',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(),
        home: booting
            ? const Scaffold(body: Center(child: CircularProgressIndicator()))
            : session == null
                ? LoginScreen(onLoggedIn: (s) => setState(() => session = s))
                : Shell(session: session!, onLogout: () async { await Api.i.logout(); setState(() => session = null); }),
      );
}
