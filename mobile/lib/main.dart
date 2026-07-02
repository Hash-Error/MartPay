import 'package:flutter/material';

void main() {
  runApp(const MartPayApp());
}

class MartPayApp extends StatelessWidget {
  const MartPayApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MartPay',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF059669), // Emerald 600
        scaffoldBackgroundColor: const Color(0xFF060D0A), // Deep Obsidian Emerald tint
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF10B981), // Emerald 500
          secondary: Color(0xFF34D399), // Emerald 400
          surface: Color(0xFF111E18), // Dark Glass base
          background: Color(0xFF060D0A),
        ),
        textTheme: const TextTheme(
          displayLarge: TextStyle(fontFamily: 'Outfit', fontWeight: FontWeight.bold, color: Colors.white),
          titleLarge: TextStyle(fontFamily: 'Outfit', fontWeight: FontWeight.w600, color: Colors.white70),
          bodyLarge: TextStyle(fontFamily: 'Inter', color: Colors.white60),
        ),
      ),
      initialRoute: '/',
      routes: {
        '/': (context) => const LoginScreen(),
        '/register': (context) => const RegisterScreen(),
        '/scan': (context) => const BarcodeScannerScreen(),
        '/cart': (context) => const CartCheckoutScreen(),
        '/pass': (context) => const ExitPassScreen(),
        '/gate': (context) => const GateScannerScreen(),
        '/admin': (context) => const AdminLogsScreen(),
      },
    );
  }
}

// ----------------------------------------------------
// UI Screen Placeholders (Midnight Emerald Aesthetics)
// ----------------------------------------------------

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('MartPay', style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: Color(0xFF10B981))),
              const SizedBox(height: 8),
              const Text('Scan. Pay. Go.', style: TextStyle(fontSize: 16, color: Colors.white38)),
              const SizedBox(height: 48),
              ElevatedButton(
                onPressed: () => Navigator.pushNamed(context, '/scan'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                ),
                child: const Text('Login (Mock Session)'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class RegisterScreen extends StatelessWidget {
  const RegisterScreen({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Register Screen')));
}

class BarcodeScannerScreen extends StatelessWidget {
  const BarcodeScannerScreen({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Barcode Scanner (Mock Camera view)')));
}

class CartCheckoutScreen extends StatelessWidget {
  const CartCheckoutScreen({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Cart & Payments Checkout')));
}

class ExitPassScreen extends StatelessWidget {
  const ExitPassScreen({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Secure Exit QR Pass & Expiry Timer')));
}

class GateScannerScreen extends StatelessWidget {
  const GateScannerScreen({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Security Exit Gate Scanner Console')));
}

class AdminLogsScreen extends StatelessWidget {
  const AdminLogsScreen({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Admin Audit Log Dashboard')));
}
