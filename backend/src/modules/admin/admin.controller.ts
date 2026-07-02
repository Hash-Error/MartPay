import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateSystemSettingsDto } from './dto/update-system-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Admin Administration (Dashboard & System Settings)')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ----------------------------------------------------
  // EMBEDDED DASHBOARD WEB INTERFACE (HTML/CSS)
  // ----------------------------------------------------

  @Get()
  @ApiOperation({ summary: 'Serve the visual Admin Dashboard web application' })
  @ApiResponse({ status: 200, description: 'Returns interactive HTML UI.' })
  serveDashboardInterface(@Res() res: any) {
    res.type('text/html');
    return res.send(this.getDashboardHtmlTemplate());
  }

  // ----------------------------------------------------
  // ADMIN METRICS & KPI ENDPOINTS (REST API)
  // ----------------------------------------------------

  @Get('stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Retrieve dashboard metrics and KPI aggregates' })
  async getStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('sales')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Retrieve time-series revenue trends for charting' })
  async getSalesAnalytics() {
    return this.adminService.getSalesAnalytics();
  }

  @Get('logs')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Retrieve audit logs for security oversight' })
  async getLogs() {
    return this.adminService.getAuditLogs();
  }

  @Get('settings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Retrieve system parameters' })
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Post('settings')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update system parameters (tax rate, currency, etc)' })
  async updateSettings(@Body() dto: UpdateSystemSettingsDto) {
    return this.adminService.updateSettings(dto);
  }

  // ----------------------------------------------------
  // GLASSMORPHIC HTML TEMPLATE
  // ----------------------------------------------------

  private getDashboardHtmlTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MartPay Admin Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #050E09;
      --card-bg: rgba(16, 29, 21, 0.45);
      --card-border: rgba(16, 185, 129, 0.15);
      --accent: #10B981;
      --text-main: #E2E8F0;
      --text-muted: #94A3B8;
      --warning: #F59E0B;
      --danger: #EF4444;
      --glow: rgba(16, 185, 129, 0.35);
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Outfit', sans-serif;
    }
    body {
      background-color: var(--bg-color);
      color: var(--text-main);
      overflow-x: hidden;
      min-height: 100vh;
      display: flex;
    }
    /* Animated glowing circles */
    .glow-circle {
      position: absolute;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: var(--glow);
      filter: blur(150px);
      z-index: -1;
      animation: float 20s infinite alternate;
    }
    .circle-1 { top: -100px; left: -100px; }
    .circle-2 { bottom: -100px; right: -100px; background: rgba(245, 158, 11, 0.15); }
    @keyframes float {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(50px, 50px) scale(1.2); }
    }

    /* Auth modal setup */
    #auth-overlay {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(5, 14, 9, 0.95);
      backdrop-filter: blur(10px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999;
    }
    .auth-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 40px;
      width: 400px;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      text-align: center;
    }
    .auth-card h2 {
      font-size: 28px;
      font-weight: 800;
      color: var(--accent);
      margin-bottom: 30px;
      letter-spacing: 1px;
    }
    .input-group {
      margin-bottom: 20px;
      text-align: left;
    }
    .input-group label {
      display: block;
      color: var(--text-muted);
      margin-bottom: 8px;
      font-size: 14px;
    }
    .input-group input {
      width: 100%;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid var(--card-border);
      background: rgba(0, 0, 0, 0.3);
      color: var(--text-main);
      font-size: 16px;
      outline: none;
      transition: 0.3s;
    }
    .input-group input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 10px var(--glow);
    }
    .btn-submit {
      width: 100%;
      padding: 14px;
      border-radius: 10px;
      border: none;
      background: var(--accent);
      color: #000;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: 0.3s;
    }
    .btn-submit:hover {
      box-shadow: 0 0 20px var(--accent);
      transform: translateY(-2px);
    }

    /* Main Dashboard Layout */
    #dashboard-layout {
      display: none;
      width: 100%;
      min-height: 100vh;
    }
    .sidebar {
      width: 260px;
      background: rgba(16, 29, 21, 0.85);
      border-right: 1px solid var(--card-border);
      padding: 30px 20px;
      position: fixed;
      height: 100vh;
      overflow-y: auto;
    }
    .logo-area {
      font-size: 24px;
      font-weight: 800;
      color: var(--accent);
      text-align: center;
      margin-bottom: 45px;
      letter-spacing: 1.5px;
    }
    .logo-area span { color: var(--text-main); }
    .menu-item {
      padding: 14px 20px;
      border-radius: 12px;
      color: var(--text-muted);
      cursor: pointer;
      transition: 0.3s;
      margin-bottom: 8px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .menu-item:hover, .menu-item.active {
      color: #000;
      background: var(--accent);
    }
    .main-content {
      margin-left: 260px;
      padding: 40px;
      width: calc(100% - 260px);
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 40px;
    }
    .header-bar h1 {
      font-size: 32px;
      font-weight: 800;
    }
    .logout-btn {
      padding: 10px 20px;
      background: transparent;
      border: 1px solid var(--danger);
      color: var(--danger);
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
      transition: 0.3s;
    }
    .logout-btn:hover {
      background: var(--danger);
      color: #fff;
    }

    /* Grid cards and KPI blocks */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 25px;
      margin-bottom: 40px;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 24px;
      position: relative;
    }
    .kpi-card h3 {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 10px;
    }
    .kpi-card .value {
      font-size: 28px;
      font-weight: 800;
    }
    .kpi-card .value.revenue { color: var(--accent); }
    .kpi-card .value.alert { color: var(--warning); }

    /* Dashboard Panels */
    .dashboard-panel {
      display: none;
    }
    .dashboard-panel.active {
      display: block;
    }

    /* Tables & Grids styling */
    .grid-container {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 25px;
      margin-bottom: 30px;
      overflow-x: auto;
    }
    .grid-container h2 {
      margin-bottom: 20px;
      font-size: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    th, td {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(16, 185, 129, 0.08);
    }
    th {
      color: var(--text-muted);
      font-weight: 600;
      font-size: 14px;
    }
    td {
      font-size: 15px;
    }
    tr:hover {
      background: rgba(16, 185, 129, 0.03);
    }

    /* Settings Form */
    .settings-form {
      max-width: 500px;
    }

  </style>
</head>
<body>
  <div class="glow-circle circle-1"></div>
  <div class="glow-circle circle-2"></div>

  <!-- AUTH PORTAL -->
  <div id="auth-overlay">
    <div class="auth-card">
      <h2>MartPay Portal</h2>
      <div id="login-error" style="color: var(--danger); margin-bottom: 15px; font-size: 14px; display: none;"></div>
      <div class="input-group">
        <label for="username">Admin Username</label>
        <input type="text" id="username" placeholder="Enter username">
      </div>
      <div class="input-group">
        <label for="password">Password</label>
        <input type="password" id="password" placeholder="Enter password">
      </div>
      <button class="btn-submit" onclick="attemptLogin()">Access Dashboard</button>
    </div>
  </div>

  <!-- DASHBOARD LAYOUT -->
  <div id="dashboard-layout">
    <div class="sidebar">
      <div class="logo-area">Mart<span>Pay</span></div>
      <div class="menu-item active" onclick="switchPanel('dashboard', this)">Dashboard</div>
      <div class="menu-item" onclick="switchPanel('sales', this)">Sales & Revenue</div>
      <div class="menu-item" onclick="switchPanel('logs', this)">Audit Logs</div>
      <div class="menu-item" onclick="switchPanel('settings', this)">Settings</div>
    </div>

    <div class="main-content">
      <div class="header-bar">
        <h1 id="panel-title">Dashboard Overview</h1>
        <button class="logout-btn" onclick="logout()">Logout</button>
      </div>

      <!-- KPI METRICS SUMMARY -->
      <div class="kpi-row">
        <div class="kpi-card">
          <h3>Total Revenue</h3>
          <div class="value revenue" id="kpi-revenue">$0.00</div>
        </div>
        <div class="kpi-card">
          <h3>Successful Sales</h3>
          <div class="value" id="kpi-sales-count">0</div>
        </div>
        <div class="kpi-card">
          <h3>Low Stock Warnings</h3>
          <div class="value alert" id="kpi-alerts">0</div>
        </div>
        <div class="kpi-card">
          <h3>Active Customers</h3>
          <div class="value" id="kpi-customers">0</div>
        </div>
      </div>

      <!-- PANEL: DASHBOARD -->
      <div id="panel-dashboard" class="dashboard-panel active">
        <div class="grid-container">
          <h2>Overview Indicators</h2>
          <p style="color: var(--text-muted); font-size: 15px;">Welcome to the MartPay Admin portal. Select side panel tabs to browse logs and parameters.</p>
        </div>
      </div>

      <!-- PANEL: SALES -->
      <div id="panel-sales" class="dashboard-panel">
        <div class="grid-container">
          <h2>Revenue Mapping Series</h2>
          <div id="sales-series" style="color: var(--text-muted); line-height: 2;">Loading daily aggregates...</div>
        </div>
      </div>

      <!-- PANEL: LOGS -->
      <div id="panel-logs" class="dashboard-panel">
        <div class="grid-container">
          <h2>Recent Activity Trails</h2>
          <table>
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Message Description</th>
                <th>User / Operator</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody id="logs-table-body">
              <tr><td colspan="4" style="color: var(--text-muted);">Loading logs...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- PANEL: SETTINGS -->
      <div id="panel-settings" class="dashboard-panel">
        <div class="grid-container">
          <h2>Global System Parameters</h2>
          <div id="settings-status" style="color: var(--accent); margin-bottom: 15px; font-size: 14px;"></div>
          <div class="settings-form">
            <div class="input-group">
              <label for="set-tax">Global Tax Rate (%)</label>
              <input type="number" id="set-tax" min="0" step="0.1">
            </div>
            <div class="input-group">
              <label for="set-currency">Default Currency</label>
              <input type="text" id="set-currency">
            </div>
            <button class="btn-submit" onclick="saveSettings()">Save Configuration</button>
          </div>
        </div>
      </div>

    </div>
  </div>

  <script>
    // Panel switcher
    function switchPanel(panelId, element) {
      document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
      element.classList.add('active');

      document.querySelectorAll('.dashboard-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel-' + panelId).classList.add('active');

      document.getElementById('panel-title').innerText = element.innerText;
      loadDashboardData();
    }

    // Auth flows
    async function attemptLogin() {
      const u = document.getElementById('username').value;
      const p = document.getElementById('password').value;
      const errEl = document.getElementById('login-error');

      errEl.style.display = 'none';

      try {
        const response = await fetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: u, password: p })
        });
        const resData = await response.json();
        
        if (response.ok && resData.data?.accessToken) {
          localStorage.setItem('martpay_jwt', resData.data.accessToken);
          document.getElementById('auth-overlay').style.display = 'none';
          document.getElementById('dashboard-layout').style.display = 'block';
          loadDashboardData();
        } else {
          errEl.innerText = resData.message || 'Authentication failed';
          errEl.style.display = 'block';
        }
      } catch (err) {
        errEl.innerText = 'Unable to connect to server';
        errEl.style.display = 'block';
      }
    }

    function logout() {
      localStorage.removeItem('martpay_jwt');
      document.getElementById('auth-overlay').style.display = 'flex';
      document.getElementById('dashboard-layout').style.display = 'none';
    }

    // Fetch and load
    async function loadDashboardData() {
      const token = localStorage.getItem('martpay_jwt');
      if (!token) return;

      const headers = { 'Authorization': 'Bearer ' + token };

      try {
        // Stats
        const statsRes = await fetch('admin/stats', { headers });
        if (statsRes.ok) {
          const stats = await statsRes.json();
          document.getElementById('kpi-revenue').innerText = '$' + stats.data.sales.revenue.toFixed(2);
          document.getElementById('kpi-sales-count').innerText = stats.data.sales.count;
          document.getElementById('kpi-alerts').innerText = stats.data.inventory.lowStockAlerts;
          document.getElementById('kpi-customers').innerText = stats.data.customersCount;
        }

        // Logs
        const logsRes = await fetch('admin/logs', { headers });
        if (logsRes.ok) {
          const logs = await logsRes.json();
          const tbody = document.getElementById('logs-table-body');
          tbody.innerHTML = '';
          logs.data.logs.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = \`
              <td><b style="color: var(--accent);">\${log.eventType}</b></td>
              <td>\${log.message}</td>
              <td>\${log.user?.username || 'System'}</td>
              <td>\${new Date(log.timestamp).toLocaleTimeString()}</td>
            \`;
            tbody.appendChild(row);
          });
        }

        // Sales trend
        const salesRes = await fetch('admin/sales', { headers });
        if (salesRes.ok) {
          const data = await salesRes.json();
          const list = document.getElementById('sales-series');
          list.innerHTML = '';
          data.data.series.forEach(item => {
            list.innerHTML += \`<div><b>\${item.date}</b>: $\${item.amount.toFixed(2)}</div>\`;
          });
        }

        // Settings
        const settingsRes = await fetch('admin/settings', { headers });
        if (settingsRes.ok) {
          const s = await settingsRes.json();
          document.getElementById('set-tax').value = s.data.settings.globalTaxRate;
          document.getElementById('set-currency').value = s.data.settings.defaultCurrency;
        }

      } catch (err) {
        console.error(err);
      }
    }

    // Save configurations
    async function saveSettings() {
      const token = localStorage.getItem('martpay_jwt');
      const tax = parseFloat(document.getElementById('set-tax').value);
      const curr = document.getElementById('set-currency').value;

      try {
        const res = await fetch('admin/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ globalTaxRate: tax, defaultCurrency: curr })
        });
        if (res.ok) {
          document.getElementById('settings-status').innerText = 'Configuration saved successfully!';
          setTimeout(() => document.getElementById('settings-status').innerText = '', 3000);
          loadDashboardData();
        }
      } catch (err) {
        console.error(err);
      }
    }

    // Auto load if logged in
    if (localStorage.getItem('martpay_jwt')) {
      document.getElementById('auth-overlay').style.display = 'none';
      document.getElementById('dashboard-layout').style.display = 'block';
      loadDashboardData();
    }
  </script>
</body>
</html>
    `;
  }
}
