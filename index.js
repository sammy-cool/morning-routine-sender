// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const {
  createTransporter,
  closeTransporter,
} = require("./config/email-config");
const emailTracker = require("./email-core/emailTracker");
const emailScheduler = require("./email-core/emailScheduler"); // Add this
const logger = require("./logger");

const app = express();
// const allowedOrigins = [
//   "https://morning-routine-sender.onrender.com/",
//   "https://priyanshu-eureka.netlify.app/",
//   "http://localhost:2900/",
//   "http://localhost:2900/send-test-email",
// ];

// const corsOptions = {
//   origin: function (origin, callback) {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
// };

// app.use(cors(corsOptions));
app.use(cors());

const PORT = process.env.PORT || 2900;

app.use(express.json());
app.use("/assets", express.static("assets"));

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mode: "auto-scheduling-enabled",
  });
});

// index.js - Enhanced admin dashboard endpoint
app.get("/", (req, res) => {
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const domain = protocol + "://" + req.get("host");
  logger.info("Dashboard accessed", { domain, ip: req.ip });

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="Morning Routine Email Sender - Admin Dashboard" />
        <title>📧 Morning Routine Sender - Admin Dashboard</title>
        
        <!-- Fonts -->
        <link preload href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        
        <!-- Toast Notification Library -->
        <script defer src="https://cdn.jsdelivr.net/npm/customizable-toast-notification@latest/dist/index.umd.js"></script>
        
        <!-- Icons -->
        <link async rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link defer rel="icon" type="image/png" sizes="64x64" href="/assets/mrn-brand-ico.png">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          :root {
            --primary: #6366f1;
            --primary-dark: #4f46e5;
            --secondary: #8b5cf6;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --info: #3b82f6;
            --dark: #1f2937;
            --light: #f3f4f6;
            --border: #e5e7eb;
          }
          
          body {
            margin: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #1f2937;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }
          
          .dashboard-container {
            width: 100%;
            max-width: 1200px;
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
            animation: fadeIn 0.5s ease-in-out;
          }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .header {
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            padding: 32px;
            text-align: center;
            color: white;
          }
          
          .header h1 {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
          }
          
          .header p {
            opacity: 0.9;
            font-size: 1rem;
          }
          
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 32px;
            background: var(--light);
          }
          
          .stat-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
            cursor: pointer;
          }
          
          .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
          }
          
          .stat-card .icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            margin-bottom: 12px;
          }
          
          .stat-card.primary .icon { background: rgba(99, 102, 241, 0.1); color: var(--primary); }
          .stat-card.success .icon { background: rgba(16, 185, 129, 0.1); color: var(--success); }
          .stat-card.warning .icon { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
          .stat-card.info .icon { background: rgba(59, 130, 246, 0.1); color: var(--info); }
          
          .stat-card .value {
            font-size: 2rem;
            font-weight: 700;
            color: var(--dark);
            margin-bottom: 4px;
          }
          
          .stat-card .label {
            color: #6b7280;
            font-size: 0.875rem;
            font-weight: 500;
          }
          
          .actions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            padding: 0 32px 32px;
          }
          
          .action-card {
            background: white;
            padding: 24px;
            border-radius: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.3s ease;
          }
          
          .action-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
          }
          
          .action-card h3 {
            font-size: 1.125rem;
            font-weight: 600;
            margin-bottom: 12px;
            color: var(--dark);
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .action-card p {
            color: #6b7280;
            font-size: 0.875rem;
            margin-bottom: 16px;
            line-height: 1.5;
          }
          
          .btn {
            width: 100%;
            padding: 12px 24px;
            border: none;
            border-radius: 10px;
            font-size: 0.875rem;
            font-weight: 600;
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          
          .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.2);
          }
          
          .btn:active {
            transform: translateY(0);
          }
          
          .btn-primary { background: var(--primary); }
          .btn-primary:hover { background: var(--primary-dark); }
          
          .btn-success { background: var(--success); }
          .btn-success:hover { background: #059669; }
          
          .btn-warning { background: var(--warning); }
          .btn-warning:hover { background: #d97706; }
          
          .btn-danger { background: var(--danger); }
          .btn-danger:hover { background: #dc2626; }
          
          .btn-info { background: var(--info); }
          .btn-info:hover { background: #2563eb; }
          
          .btn-secondary { background: var(--secondary); }
          .btn-secondary:hover { background: #7c3aed; }
          
          .footer {
            padding: 24px 32px;
            text-align: center;
            background: var(--light);
            color: #6b7280;
            font-size: 0.875rem;
          }
          
          .footer a {
            color: var(--primary);
            text-decoration: none;
            font-weight: 600;
          }
          
          .footer a:hover {
            text-decoration: underline;
          }
          
          @media (max-width: 768px) {
            .header h1 { font-size: 1.5rem; }
            .stats-grid, .actions-grid {
              grid-template-columns: 1fr;
            }
          }
          
          .loading {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 0.8s linear infinite;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      
      <body>
        <div class="dashboard-container">
          <!-- Header -->
          <div class="header">
            <h1>
              <i class="fas fa-envelope-open-text"></i>
              Morning Routine Sender
            </h1>
            <p>Automated Email Scheduling & Management Dashboard</p>
          </div>
          
          <!-- Stats Grid -->
          <div class="stats-grid">
            <div class="stat-card primary" onclick="getStats()">
              <div class="icon"><i class="fas fa-paper-plane"></i></div>
              <div class="value" id="totalSent">--</div>
              <div class="label">Total Emails Sent</div>
            </div>
            
            <div class="stat-card success" onclick="getScheduledJobs()">
              <div class="icon"><i class="fas fa-clock"></i></div>
              <div class="value" id="scheduledJobs">--</div>
              <div class="label">Scheduled Jobs</div>
            </div>
            
            <div class="stat-card warning" onclick="getDatabaseStats()">
              <div class="icon"><i class="fas fa-database"></i></div>
              <div class="value" id="dbRecords">--</div>
              <div class="label">Database Records</div>
            </div>
            
            <div class="stat-card info" onclick="healthCheck()">
              <div class="icon"><i class="fas fa-heartbeat"></i></div>
              <div class="value" id="status">Online</div>
              <div class="label">System Status</div>
            </div>
          </div>
          
          <!-- Actions Grid -->
          <div class="actions-grid">
            <!-- Email Actions -->
            <div class="action-card">
              <h3><i class="fas fa-envelope"></i> Email Management</h3>
              <p>Send test emails or trigger bulk email sending</p>
              <button class="btn btn-primary" onclick="sendTestEmail()">
                <i class="fas fa-paper-plane"></i> Send Test Email
              </button>
              <button class="btn btn-success" onclick="sendBulkEmails()" style="margin-top: 10px;">
                <i class="fas fa-rocket"></i> Send Bulk Emails
              </button>
            </div>
            
            <!-- Scheduling -->
            <div class="action-card">
              <h3><i class="fas fa-calendar-alt"></i> Scheduling</h3>
              <p>View and manage scheduled email jobs</p>
              <button class="btn btn-info" onclick="viewScheduledJobs()">
                <i class="fas fa-list"></i> View Scheduled Jobs
              </button>
              <button class="btn btn-secondary" onclick="rescheduleJobs()" style="margin-top: 10px;">
                <i class="fas fa-sync"></i> Reschedule Jobs
              </button>
            </div>
            
            <!-- Database Management -->
            <div class="action-card">
              <h3><i class="fas fa-database"></i> Database</h3>
              <p>Clean up old records and optimize database</p>
              <button class="btn btn-warning" onclick="cleanupDatabase()">
                <i class="fas fa-broom"></i> Cleanup Database
              </button>
              <button class="btn btn-info" onclick="viewDatabaseStats()" style="margin-top: 10px;">
                <i class="fas fa-chart-bar"></i> View Statistics
              </button>
            </div>
            
            <!-- System Management -->
            <div class="action-card">
              <h3><i class="fas fa-cog"></i> System Management</h3>
              <p>System health, logs, and configuration</p>
              <button class="btn btn-success" onclick="systemHealth()">
                <i class="fas fa-heartbeat"></i> Health Check
              </button>
              <button class="btn btn-danger" onclick="viewLogs()" style="margin-top: 10px;">
                <i class="fas fa-file-alt"></i> View Logs
              </button>
            </div>
            
            <!-- Templates -->
            <div class="action-card">
              <h3><i class="fas fa-file-code"></i> Email Templates</h3>
              <p>Manage and preview email templates</p>
              <button class="btn btn-primary" onclick="viewTemplates()">
                <i class="fas fa-eye"></i> View Templates
              </button>
              <button class="btn btn-secondary" onclick="testTemplate()" style="margin-top: 10px;">
                <i class="fas fa-flask"></i> Test Template
              </button>
            </div>
            
            <!-- External Links -->
            <div class="action-card">
              <h3><i class="fas fa-external-link-alt"></i> Quick Links</h3>
              <p>Access external resources and documentation</p>
              <button class="btn btn-info" onclick="openWebsite()">
                <i class="fas fa-globe"></i> Open Website
              </button>
              <button class="btn btn-primary" onclick="openDocs()" style="margin-top: 10px;">
                <i class="fas fa-book"></i> Documentation
              </button>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p>
              Built with ❤️ by <a href="https://priyanshu-eureka.netlify.app/" target="_blank">Priyanshu</a>
              | Version 2.0.0 | 
              <a href="https://github.com/sammy-cool" target="_blank"><i class="fab fa-github"></i> GitHub</a>
            </p>
          </div>
        </div>
        
        <script>
          const API_BASE = "${domain}";
          
          // Toast helper
          function showToast(message, type = "success", duration = 5000) {
          customizableToast.noop();
            customizableToast.createToast({
              duration,
              message,
              type,
              position: "top-right",
              textColor: "snow"
            });
          }
          
          // Show loading toast
          function showLoadingToast(message) {
            return customizableToast.createToast({
              duration: 30000,
              message: message,
              type: "info",
              position: "top-right"
            });
          }
          
          // API call helper
          async function apiCall(url, options = {}) {
            try {
              const response = await fetch(API_BASE + url, options);
              const data = await response.json();
              return { success: response.ok, data };
            } catch (error) {
              return { success: false, error: error.message };
            }
          }
          
          // Get stats on page load
          window.addEventListener('DOMContentLoaded', async () => {
            await loadDashboardStats();
          });
          
          async function loadDashboardStats() {
            // Get scheduled jobs count
            const jobs = await apiCall('/scheduled-jobs');
            if (jobs.success) {
              document.getElementById('scheduledJobs').textContent = jobs.data.count || 0;
            }
            
            // Get database stats
            const dbStats = await apiCall('/admin/database-stats');
            if (dbStats.success) {
              document.getElementById('dbRecords').textContent = dbStats.data.totalRecords || 0;
              document.getElementById('totalSent').textContent = dbStats.data.totalRecords || 0;
            }
          }
          
          // Send Test Email
          async function sendTestEmail() {
            const email = prompt("Enter email address:", "test@example.com");
            if (!email) return;
            
            const template = prompt("Enter template type (default, deep-work, career, learning, mindfulness, reflection):", "default");
            
            const loading = showLoadingToast('Sending test email...');
            
            const result = await apiCall('/send-test-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, templateType: template })
            });
            
            // loading.remove();
            
            if (result.success) {
              showToast(\`✅ Email sent successfully to \${email}\`, "success");
            } else {
              showToast("❌ Failed to send email: " + result.error, "error");
            }
          }
          
          // Send Bulk Emails
          async function sendBulkEmails() {
            if (!confirm("Are you sure you want to send bulk emails to all users?")) return;
            
            const loading = showLoadingToast('Sending bulk emails...');
            
            const result = await apiCall('/send-bulk-now', { method: 'POST' });
            
            // loading.remove();
            
            if (result.success) {
              showToast(\`✅ Bulk emails sent! Success: \${result.data.successCount}, Failed: \${result.data.failureCount}\`, "success", 8000);
              await loadDashboardStats();
            } else {
              showToast("❌ Bulk send failed: " + result.error, "error");
            }
          }
          
          // View Scheduled Jobs
          async function viewScheduledJobs() {
            const result = await apiCall('/scheduled-jobs');
            
            if (result.success) {
              const jobs = result.data.jobs;
              let message = \`📅 Scheduled Jobs (\${jobs.length}): \\n\\n\`;
              jobs.forEach(job => {
                message += \`• \${job.email} - \${job.cronPattern}\\n\`;
              });
              alert(message);
            } else {
              showToast("Failed to load scheduled jobs", "error");
            }
          }
          
          // Database Cleanup
          async function cleanupDatabase() {
            const days = prompt("Delete records older than how many days?", "30");
            if (!days) return;
            
            if (!confirm(\`Delete all records older than \${days} days?\`)) return;
            
            const loading = showLoadingToast('Cleaning up database...');
            
            const result = await apiCall('/admin/cleanup-database', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ days: parseInt(days) })
            });
            
            // loading.remove();
            
            if (result.success) {
              showToast(\`✅ Cleanup completed! Deleted \${result.data.deleted} records\`, "success");
              await loadDashboardStats();
            } else {
              showToast("❌ Cleanup failed", "error");
            }
          }
          
          // View Database Stats
          async function viewDatabaseStats() {
            const result = await apiCall('/admin/database-stats');
            
            if (result.success) {
              const stats = result.data;
              alert(\`📊 Database Statistics:\\n\\nTotal Records: \${stats.totalRecords}\\nOldest Record: \${stats.oldestRecord}\\nNewest Record: \${stats.newestRecord}\`);
            }
          }
          
          // System Health Check
          async function systemHealth() {
            const loading = showLoadingToast('Checking system health...');
            
            const result = await apiCall('/health');
            
            // loading.remove();
            
            if (result.success) {
              showToast(\`✅ System is healthy! Status: \${result.data.status}\`, "success");
              document.getElementById('status').textContent = result.data.status;
            } else {
              showToast("❌ System health check failed", "error");
              document.getElementById('status').textContent = "Offline";
            }
          }
          
          // View Logs (opens in new window)
          function viewLogs() {
            showToast("📋 Log viewing feature coming soon! Check logs/ directory", "info");
          }
          
          // View Templates
          function viewTemplates() {
            const templates = ['default', 'routine-deep-work', 'routine-career', 'learning', 'mindfulness', 'reflection'];
            let message = "📧 Available Templates:\\n\\n";
            templates.forEach(t => message += \`• \${t}\\n\`);
            alert(message);
          }
          
          // Test Template
          async function testTemplate() {
            const template = prompt("Enter template name to test:", "default");
            if (!template) return;
            
            await sendTestEmail();
          }
          
          // Open Website
          function openWebsite() {
            window.open("https://priyanshu-eureka.netlify.app/", '_blank');
            showToast("🌐 Opening website...", "info");
          }
          
          // Open Documentation
          function openDocs() {
            window.open("https://github.com/sammy-cool/morning-routine-sender", '_blank');
            showToast("📚 Opening documentation...", "info");
          }
          
          // Reschedule Jobs
          async function rescheduleJobs() {
            if (!confirm("Reschedule all email jobs? This will reload the job scheduler.")) return;
            
            showToast("🔄 Rescheduling jobs... (requires server restart)", "warning");
          }
          
          // Stats shortcuts
          function getStats() { viewDatabaseStats(); }
          function getScheduledJobs() { viewScheduledJobs(); }
          function getDatabaseStats() { viewDatabaseStats(); }
          function healthCheck() { systemHealth(); }
        </script>
      </body>
    </html>
  `);
});

// Manual database cleanup endpoint (admin only)
app.post("/admin/cleanup-database", async (req, res) => {
  try {
    const { days = 30 } = req.body;
    const { cleanupOldEmailRecords } = require("./helper/database-cleanup");

    const result = await cleanupOldEmailRecords(days);

    res.json(result);
  } catch (error) {
    logger.error("Manual cleanup failed", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Database stats endpoint
app.get("/admin/database-stats", async (req, res) => {
  try {
    const { getDatabaseStats } = require("./helper/database-cleanup");
    const stats = await getDatabaseStats();

    res.json(stats);
  } catch (error) {
    logger.error("Failed to get stats", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Logs cleanup endpoint
app.post("/admin/cleanup-logs", async (req, res) => {
  try {
    const fs = require("fs").promises;
    const path = require("path");
    const logsDir = path.join(__dirname, "logs");

    const files = await fs.readdir(logsDir);
    let deleted = 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 3);

    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stats = await fs.stat(filePath);

      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        deleted++;
        logger.info("Deleted old log file", { file });
      }
    }

    res.json({ success: true, deleted });
  } catch (error) {
    logger.error("Log cleanup failed", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual email trigger endpoint
app.post("/send-test-email", async (req, res) => {
  try {
    const { email, templateType } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const emailService = require("./email-core/emailService");

    const result = await emailService.sendRoutineEmail(
      getTransporter(),
      email,
      templateType || "default"
    );

    await emailTracker.recordSend(
      email,
      templateType || "default",
      result.messageId,
      { manual: true }
    );

    logger.info("✅ Test email sent successfully", {
      email,
      messageId: result.messageId,
      templateType: templateType || "default",
    });

    return res.status(200).json({
      success: true,
      messageId: result.messageId,
      email,
      templateType: templateType || "default",
    });
  } catch (error) {
    logger.error("❌ Failed to send test email", {
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error occurred",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// NEW: Get scheduled jobs status
app.get("/scheduled-jobs", (req, res) => {
  const jobs = emailScheduler.getScheduledJobsStatus();
  res.json({
    count: jobs.length,
    jobs,
  });
});

// NEW: Trigger bulk send manually (for testing)
app.post("/send-bulk-now", async (req, res) => {
  try {
    const result = await emailScheduler.sendBulkEmails();
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("❌ Bulk send failed", { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`✅ Server started on port ${PORT}`);
  logger.info("🔄 Mode: Auto-scheduling enabled with node-cron");

  // Initialize automatic scheduling
  setTimeout(() => {
    logger.info("⏰ Initializing automatic email scheduling...");
    emailScheduler.scheduleAllJobs();
  }, 8000); // 8 second delay to ensure everything is ready

  // Schedule cleanup jobs
  setTimeout(() => {
    emailScheduler.scheduleCleanupJobs();
    logger.info("🧹 Database cleanup scheduled (daily at 2 AM)");
  }, 10000);
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`${signal} received, starting graceful shutdown...`);

  try {
    server.close();

    // Stop all cron jobs
    emailScheduler.stopAllJobs();

    if (transporter) {
      await closeTransporter(transporter);
      transporter = null;
    }

    await emailTracker.close();

    logger.info("✅ Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error during shutdown", { error: error.message });
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.message });
  gracefulShutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason });
  gracefulShutdown("unhandledRejection");
});
