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

  res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- Essential Meta Tags -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    
    <!-- SEO Meta Tags -->
    <meta name="description" content="Morning Routine Email Sender - Automated email scheduling and management dashboard for daily routine notifications with analytics, cron job management, and database monitoring.">
    <meta name="keywords" content="email automation, morning routine, scheduled emails, email dashboard, cron jobs, email analytics">
    <meta name="author" content="Priyanshu">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#6366f1">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:title" content="Morning Routine Sender - Admin Dashboard">
    <meta property="og:description" content="Automated email scheduling and management dashboard for daily routine notifications.">
    <meta property="og:image" content="/assets/mrn-brand-ico.png">
    <meta property="og:url" content="${domain}">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Morning Routine Sender - Admin Dashboard">
    <meta name="twitter:description" content="Automated email scheduling and management dashboard.">
    <meta name="twitter:image" content="/assets/mrn-brand-ico.png">
    
    <!-- Title -->
    <title>Morning Routine Sender - Admin Dashboard | Automated Email Management</title>
    
     <!-- Canonical URL -->
    <link rel="canonical" href="${domain}" />

    <!-- Favicon -->
    <link rel="icon" type="image/png" sizes="64x64" href="/assets/mrn-brand-ico.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/mrn-brand-ico.png">
    
    <!-- Performance Optimization: DNS Prefetch -->
    <link rel="dns-prefetch" href="https://fonts.googleapis.com">
    <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
    <link rel="dns-prefetch" href="https://cdnjs.cloudflare.com">
    
    <!-- Performance Optimization: Preconnect -->
    <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    
    <!-- Fonts: Preload for Performance -->
    <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"></noscript>
    
    <!-- Icons: Load Async for Better Performance -->
    <link rel="preload" as="style" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" media="print" onload="this.media='all'">
    <noscript><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"></noscript>
    
    <!-- Toast Notification Library: Defer for Performance -->
    <script defer src="https://cdn.jsdelivr.net/npm/customizable-toast-notification@latest/dist/index.umd.js"></script>
    
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      :root {
        /* WCAG AA Compliant Colors with 4.5:1+ Contrast Ratio */
        --primary: #4f46e5;
        --primary-dark: #4338ca;
        --secondary: #7c3aed;
        --success: #059669;
        --warning: #d97706;
        --danger: #dc2626;
        --info: #2563eb;
        --dark: #111827;
        --light: #f9fafb;
        --border: #e5e7eb;
        --text-primary: #111827;
        --text-secondary: #4b5563;
        --bg-gradient-start: #667eea;
        --bg-gradient-end: #764ba2;
      }
      
      html {
        scroll-behavior: smooth;
      }
      
      body {
        margin: 0;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
        color: var(--text-primary);
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        line-height: 1.6;
      }
      
      .dashboard-container {
        width: 100%;
        max-width: 1200px;
        background: rgba(255,255,255,0.97);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-radius: 24px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        overflow: hidden;
        animation: fadeIn 0.5s ease-in-out;
      }
      
      @keyframes fadeIn {
        from { 
          opacity: 0; 
          transform: translateY(20px); 
        }
        to { 
          opacity: 1; 
          transform: translateY(0); 
        }
      }
      
      /* Semantic Header */
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
        line-height: 1.2;
      }
      
      .header p {
        opacity: 0.95;
        font-size: 1rem;
        color: rgba(255, 255, 255, 0.95);
      }
      
      /* Stats Grid Section */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 20px;
        padding: 32px;
        background: var(--light);
      }
      
      .stat-card {
        background: white;
        padding: 24px 20px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        transition: all 0.3s ease;
        cursor: pointer;
        border: 2px solid transparent;
      }
      
      .stat-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        border-color: var(--primary);
      }
      
      .stat-card:focus {
        outline: 3px solid var(--primary);
        outline-offset: 2px;
      }
      
      .stat-card .icon {
        width: 52px;
        height: 52px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        margin-bottom: 16px;
      }
      
      /* WCAG AA Compliant Icon Colors - 4.5:1 Contrast Ratio */
      .stat-card.primary .icon { 
        background: rgba(79, 70, 229, 0.15); 
        color: #3730a3; /* Dark indigo for better contrast */
      }
      .stat-card.success .icon { 
        background: rgba(5, 150, 105, 0.15); 
        color: #065f46; /* Dark green for better contrast */
      }
      .stat-card.warning .icon { 
        background: rgba(217, 119, 6, 0.15); 
        color: #92400e; /* Dark amber for better contrast */
      }
      .stat-card.info .icon { 
        background: rgba(37, 99, 235, 0.15); 
        color: #1e40af; /* Dark blue for better contrast */
      }
      
      .stat-card .value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--text-primary);
        margin-bottom: 6px;
        line-height: 1.2;
      }
      
      .stat-card .label {
        color: var(--text-secondary);
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      /* Actions Grid Section */
      .actions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 24px;
        padding: 0 32px 32px;
      }
      
      .action-card {
        background: white;
        padding: 28px 24px;
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        transition: all 0.3s ease;
        border: 2px solid transparent;
      }
      
      .action-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 28px rgba(0,0,0,0.15);
        border-color: var(--primary);
      }
      
      /* Semantic Heading Hierarchy Fix - h2 for sections, h3 for cards */
      .action-card h3 {
        font-size: 1.125rem;
        font-weight: 600;
        margin-bottom: 14px;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 10px;
        line-height: 1.3;
      }
      
      .action-card p {
        color: var(--text-secondary);
        font-size: 0.9rem;
        margin-bottom: 18px;
        line-height: 1.6;
      }
      
      /* Accessible Button Styles */
      .btn {
        width: 100%;
        padding: 14px 24px;
        border: none;
        border-radius: 10px;
        font-size: 0.9rem;
        font-weight: 600;
        color: white;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        position: relative;
        overflow: hidden;
      }
      
      .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(0,0,0,0.25);
      }
      
      .btn:active {
        transform: translateY(0);
      }
      
      .btn:focus {
        outline: 3px solid rgba(99, 102, 241, 0.5);
        outline-offset: 3px;
      }
      
      /* Button variants with WCAG AA compliant colors */
      .btn-primary { background: var(--primary); }
      .btn-primary:hover { background: var(--primary-dark); }
      
      .btn-success { background: var(--success); }
      .btn-success:hover { background: #047857; }
      
      .btn-warning { background: var(--warning); }
      .btn-warning:hover { background: #b45309; }
      
      .btn-danger { background: var(--danger); }
      .btn-danger:hover { background: #b91c1c; }
      
      .btn-info { background: var(--info); }
      .btn-info:hover { background: #1d4ed8; }
      
      .btn-secondary { background: var(--secondary); }
      .btn-secondary:hover { background: #6d28d9; }
      
      /* Footer Semantic */
      .footer {
        padding: 28px 32px;
        text-align: center;
        background: var(--light);
        color: var(--text-secondary);
        font-size: 0.9rem;
        border-top: 1px solid var(--border);
      }
      
      .footer a {
        color: var(--primary);
        text-decoration: none;
        font-weight: 600;
        transition: color 0.2s ease;
      }
      
      .footer a:hover {
        text-decoration: underline;
        color: var(--primary-dark);
      }
      
      .footer a:focus {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
      
      /* Responsive Design */
      @media (max-width: 768px) {
        body {
          padding: 10px;
        }
        
        .header h1 { 
          font-size: 1.5rem; 
          flex-direction: column;
          gap: 8px;
        }
        
        .stats-grid, .actions-grid {
          grid-template-columns: 1fr;
          padding: 20px;
        }
        
        .action-card {
          padding: 20px;
        }
        
        .stat-card .value {
          font-size: 1.75rem;
        }
      }
      
      /* Loading Animation */
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
      
      /* Accessibility: Skip to Content Link */
      .skip-link {
        position: absolute;
        top: -40px;
        left: 0;
        background: var(--primary);
        color: white;
        padding: 8px 16px;
        text-decoration: none;
        border-radius: 0 0 8px 0;
        z-index: 100;
      }
      
      .skip-link:focus {
        top: 0;
      }
      
      /* Print Styles */
      @media print {
        body {
          background: white;
        }
        
        .dashboard-container {
          box-shadow: none;
        }
        
        .btn {
          display: none;
        }
      }
    </style>
  </head>
  
  <body>
    <!-- Skip to Content Link for Accessibility -->
    <a href="#main-content" class="skip-link">Skip to main content</a>
    
    <div class="dashboard-container" role="main" id="main-content">
      <!-- Header Section -->
      <header class="header" role="banner">
        <h1>
          <i class="fas fa-envelope-open-text" aria-hidden="true"></i>
          <span>Morning Routine Sender</span>
        </h1>
        <p>Automated Email Scheduling & Management Dashboard</p>
      </header>
      
      <!-- Stats Grid Section -->
      <section class="stats-grid" aria-label="Dashboard Statistics">
        <article class="stat-card primary" onclick="getStats()" role="button" tabindex="0" aria-label="View total emails sent statistics">
          <div class="icon" aria-hidden="true"><i class="fas fa-paper-plane"></i></div>
          <div class="value" id="totalSent">--</div>
          <div class="label">Total Emails Sent</div>
        </article>
        
        <article class="stat-card success" onclick="getScheduledJobs()" role="button" tabindex="0" aria-label="View scheduled jobs">
          <div class="icon" aria-hidden="true"><i class="fas fa-clock"></i></div>
          <div class="value" id="scheduledJobs">--</div>
          <div class="label">Scheduled Jobs</div>
        </article>
        
        <article class="stat-card warning" onclick="getDatabaseStats()" role="button" tabindex="0" aria-label="View database records">
          <div class="icon" aria-hidden="true"><i class="fas fa-database"></i></div>
          <div class="value" id="dbRecords">--</div>
          <div class="label">Database Records</div>
        </article>
        
        <article class="stat-card info" onclick="healthCheck()" role="button" tabindex="0" aria-label="Check system health status">
          <div class="icon" aria-hidden="true"><i class="fas fa-heartbeat"></i></div>
          <div class="value" id="status">Online</div>
          <div class="label">System Status</div>
        </article>
      </section>
      
      <!-- Actions Grid Section -->
      <section class="actions-grid" aria-label="Dashboard Actions">
        <!-- Email Actions -->
        <article class="action-card">
          <h3><i class="fas fa-envelope" aria-hidden="true"></i> Email Management</h3>
          <p>Send test emails or trigger bulk email sending to all users</p>
          <button class="btn btn-primary" onclick="sendTestEmail()" aria-label="Send a test email">
            <i class="fas fa-paper-plane" aria-hidden="true"></i> <span>Send Test Email</span>
          </button>
          <button class="btn btn-success" onclick="sendBulkEmails()" style="margin-top: 12px;" aria-label="Send bulk emails to all users">
            <i class="fas fa-rocket" aria-hidden="true"></i> <span>Send Bulk Emails</span>
          </button>
        </article>
        
        <!-- Scheduling -->
        <article class="action-card">
          <h3><i class="fas fa-calendar-alt" aria-hidden="true"></i> Scheduling</h3>
          <p>View and manage scheduled email jobs and cron patterns</p>
          <button class="btn btn-info" onclick="viewScheduledJobs()" aria-label="View all scheduled email jobs">
            <i class="fas fa-list" aria-hidden="true"></i> <span>View Scheduled Jobs</span>
          </button>
          <button class="btn btn-secondary" onclick="rescheduleJobs()" style="margin-top: 12px;" aria-label="Reschedule all email jobs">
            <i class="fas fa-sync" aria-hidden="true"></i> <span>Reschedule Jobs</span>
          </button>
        </article>
        
        <!-- Database Management -->
        <article class="action-card">
          <h3><i class="fas fa-database" aria-hidden="true"></i> Database</h3>
          <p>Clean up old records and optimize database performance</p>
          <button class="btn btn-warning" onclick="cleanupDatabase()" aria-label="Clean up old database records">
            <i class="fas fa-broom" aria-hidden="true"></i> <span>Cleanup Database</span>
          </button>
          <button class="btn btn-info" onclick="viewDatabaseStats()" style="margin-top: 12px;" aria-label="View database statistics">
            <i class="fas fa-chart-bar" aria-hidden="true"></i> <span>View Statistics</span>
          </button>
        </article>
        
        <!-- System Management -->
        <article class="action-card">
          <h3><i class="fas fa-cog" aria-hidden="true"></i> System Management</h3>
          <p>Monitor system health, view logs, and check configuration</p>
          <button class="btn btn-success" onclick="systemHealth()" aria-label="Check system health">
            <i class="fas fa-heartbeat" aria-hidden="true"></i> <span>Health Check</span>
          </button>
          <button class="btn btn-danger" onclick="viewLogs()" style="margin-top: 12px;" aria-label="View system logs">
            <i class="fas fa-file-alt" aria-hidden="true"></i> <span>View Logs</span>
          </button>
        </article>
        
        <!-- Templates -->
        <article class="action-card">
          <h3><i class="fas fa-file-code" aria-hidden="true"></i> Email Templates</h3>
          <p>Manage, preview, and test available email templates</p>
          <button class="btn btn-primary" onclick="viewTemplates()" aria-label="View available email templates">
            <i class="fas fa-eye" aria-hidden="true"></i> <span>View Templates</span>
          </button>
          <button class="btn btn-secondary" onclick="testTemplate()" style="margin-top: 12px;" aria-label="Test an email template">
            <i class="fas fa-flask" aria-hidden="true"></i> <span>Test Template</span>
          </button>
        </article>
        
        <!-- External Links -->
        <article class="action-card">
          <h3><i class="fas fa-external-link-alt" aria-hidden="true"></i> Quick Links</h3>
          <p>Access external resources, documentation, and GitHub</p>
          <button class="btn btn-info" onclick="openWebsite()" aria-label="Open project website in new tab">
            <i class="fas fa-globe" aria-hidden="true"></i> <span>Open Website</span>
          </button>
          <button class="btn btn-primary" onclick="openDocs()" style="margin-top: 12px;" aria-label="Open documentation in new tab">
            <i class="fas fa-book" aria-hidden="true"></i> <span>Documentation</span>
          </button>
        </article>
      </section>
      
      <!-- Footer -->
      <footer class="footer" role="contentinfo">
        <p>
          Built with <span aria-label="love">❤️</span> by 
          <a href="https://priyanshu-eureka.netlify.app/" target="_blank" rel="noopener noreferrer" aria-label="Visit Priyanshu's portfolio website">Priyanshu</a>
          <span aria-hidden="true">|</span> Version 2.0.0 <span aria-hidden="true">|</span> 
          <a href="https://github.com/sammy-cool" target="_blank" rel="noopener noreferrer" aria-label="Visit GitHub profile">
            <i class="fab fa-github" aria-hidden="true"></i> GitHub
          </a>
        </p>
      </footer>
    </div>
    
    <script>
      const API_BASE = "${domain}";
      
      // Toast helper with full lib features including CTA
      function showToast(message, type = "success", duration = 5000, options = {}) {
        if (typeof customizableToast === 'undefined') {
          console.warn('Toast library not loaded yet');
          return;
        }
        
        const toastConfig = {
          duration,
          message,
          type,
          position: options.position || "top-right",
          textColor: "snow",
          animationDuration: options.animationDuration || 300,
          ...options
        };
        
        customizableToast.createToast(toastConfig);
      }
      
      // Show loading toast with CTA option
      function showLoadingToast(message, ctaConfig = null) {
        if (typeof customizableToast === 'undefined') {
          console.warn('Toast library not loaded yet');
          return { remove: () => {} };
        }
        
        const config = {
          duration: 30000,
          message: message + ' <span class="loading"></span>',
          type: "info",
          position: "top-right",
          animationDuration: 200
        };
        
        if (ctaConfig) {
          config.cta = ctaConfig;
        }
        
        return customizableToast.createToast(config);
      }
      
      // API call helper with better error handling
      async function apiCall(url, options = {}) {
        try {
          const response = await fetch(API_BASE + url, options);
          const contentType = response.headers.get("content-type");
          
          if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            return { success: response.ok, data, status: response.status };
          }
          
          const text = await response.text();
          return { 
            success: response.ok, 
            data: { message: text }, 
            status: response.status 
          };
        } catch (error) {
          console.error('API Error:', error);
          return { 
            success: false, 
            error: error.message,
            status: 0
          };
        }
      }
      
      // Get stats on page load
      window.addEventListener('DOMContentLoaded', async () => {
        await loadDashboardStats();
      });
      
      async function loadDashboardStats() {
        // Get scheduled jobs count
        const jobs = await apiCall('/scheduled-jobs');
        if (jobs.success && jobs.data) {
          document.getElementById('scheduledJobs').textContent = jobs.data.count || 0;
        }
        
        // Get database stats
        const dbStats = await apiCall('/admin/database-stats');
        if (dbStats.success && dbStats.data) {
          document.getElementById('dbRecords').textContent = dbStats.data.totalRecords || 0;
          document.getElementById('totalSent').textContent = dbStats.data.totalRecords || 0;
        }
      }
      
      // Send Test Email with CTA
      async function sendTestEmail() {
        const email = prompt("Enter email address:", "test@example.com");
        if (!email) return;
        
        const template = prompt("Enter template type (default, deep-work, career, learning, mindfulness, reflection):", "default");
        
        const loading = showLoadingToast('Sending test email...', {
          label: "Cancel",
          onClick: () => {
            loading.remove();
            showToast("Email sending cancelled", "warning");
          }
        });
        
        const result = await apiCall('/send-test-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, templateType: template })
        });
        
        loading.remove();
        
        if (result.success) {
          showToast(\`✅ Email sent successfully to \${email}\`, "success", 6000, {
            cta: {
              label: "View Logs",
              onClick: () => viewLogs()
            }
          });
        } else {
          showToast("❌ Failed to send email: " + (result.error || result.data?.error || 'Unknown error'), "error", 8000);
        }
      }
      
      // Send Bulk Emails with progress CTA
      async function sendBulkEmails() {
        const confirmed = confirm("Are you sure you want to send bulk emails to all users?");
        if (!confirmed) return;
        
        const loading = showLoadingToast('Sending bulk emails...', {
          label: "View Progress",
          onClick: () => {
            showToast("Check console for detailed progress", "info");
          }
        });
        
        const result = await apiCall('/send-bulk-now', { method: 'POST' });
        
        loading.remove();
        
        if (result.success) {
          showToast(
            \`✅ Bulk emails sent! Success: \${result.data.successCount}, Failed: \${result.data.failureCount}\`, 
            "success", 
            10000,
            {
              cta: {
                label: "Refresh Stats",
                onClick: async () => {
                  await loadDashboardStats();
                  showToast("Stats refreshed", "success");
                }
              }
            }
          );
          await loadDashboardStats();
        } else {
          showToast("❌ Bulk send failed: " + (result.error || 'Unknown error'), "error");
        }
      }
      
      // View Scheduled Jobs
      async function viewScheduledJobs() {
        const result = await apiCall('/scheduled-jobs');
        
        if (result.success && result.data) {
          const jobs = result.data.jobs || [];
          let message = \`📅 Scheduled Jobs (\${jobs.length}): \\n\\n\`;
          jobs.forEach(job => {
            message += \`• \${job.email} - \${job.cronPattern}\\n\`;
          });
          alert(message);
        } else {
          showToast("Failed to load scheduled jobs", "error");
        }
      }
      
      // Database Cleanup with confirmation CTA
      async function cleanupDatabase() {
        const days = prompt("Delete records older than how many days?", "30");
        if (!days) return;
        
        showToast(\`Delete all records older than \${days} days?\`, "warning", 10000, {
          cta: {
            label: "Confirm Delete",
            onClick: async () => {
              const loading = showLoadingToast('Cleaning up database...');
              
              const result = await apiCall('/admin/cleanup-database', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ days: parseInt(days) })
              });
              
              loading.remove();
              
              if (result.success) {
                showToast(\`✅ Cleanup completed! Deleted \${result.data.deleted} records\`, "success");
                await loadDashboardStats();
              } else {
                showToast("❌ Cleanup failed", "error");
              }
            }
          }
        });
      }
      
      // View Database Stats
      async function viewDatabaseStats() {
        const result = await apiCall('/admin/database-stats');
        
        if (result.success && result.data) {
          const stats = result.data;
          alert(\`📊 Database Statistics:\\n\\nTotal Records: \${stats.totalRecords}\\nOldest Record: \${stats.oldestRecord || 'N/A'}\\nNewest Record: \${stats.newestRecord || 'N/A'}\`);
        }
      }
      
      // System Health Check
      async function systemHealth() {
        const loading = showLoadingToast('Checking system health...');
        
        const result = await apiCall('/health');
        
        loading.remove();
        
        if (result.success && result.data) {
          showToast(\`✅ System is healthy! Status: \${result.data.status}\`, "success");
          document.getElementById('status').textContent = result.data.status || 'Online';
        } else {
          showToast("❌ System health check failed", "error");
          document.getElementById('status').textContent = "Offline";
        }
      }
      
      // View Logs
      function viewLogs() {
        showToast("📋 Log viewing feature - Check server logs/ directory", "info", 7000, {
          cta: {
            label: "Open Docs",
            onClick: () => openDocs()
          }
        });
      }
      
      // View Templates
      function viewTemplates() {
        const templates = ['default', 'deep-work', 'career', 'learning', 'mindfulness', 'reflection'];
        let message = "📧 Available Templates:\\n\\n";
        templates.forEach(t => message += \`• routine-\${t}\\n\`);
        alert(message);
      }
      
      // Test Template
      async function testTemplate() {
        await sendTestEmail();
      }
      
      // Open Website
      function openWebsite() {
        window.open("https://priyanshu-eureka.netlify.app/", '_blank', 'noopener,noreferrer');
        showToast("🌐 Opening website...", "info");
      }
      
      // Open Documentation
      function openDocs() {
        window.open("https://github.com/sammy-cool/morning-routine-sender", '_blank', 'noopener,noreferrer');
        showToast("📚 Opening documentation...", "info");
      }
      
      // Reschedule Jobs
      async function rescheduleJobs() {
        showToast("Reschedule all email jobs?", "warning", 8000, {
          cta: {
            label: "Confirm Reschedule",
            onClick: () => {
              showToast("🔄 Rescheduling jobs... (requires server restart)", "info");
            }
          }
        });
      }
      
      // Stats shortcuts
      function getStats() { viewDatabaseStats(); }
      function getScheduledJobs() { viewScheduledJobs(); }
      function getDatabaseStats() { viewDatabaseStats(); }
      function healthCheck() { systemHealth(); }
      
      // Keyboard accessibility for stat cards
      document.querySelectorAll('.stat-card').forEach(card => {
        card.addEventListener('keypress', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
          }
        });
      });
    </script>
    
    <!-- Schema.org Structured Data for SEO -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Morning Routine Sender",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web",
      "description": "Automated email scheduling and management dashboard for daily routine notifications",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "author": {
        "@type": "Person",
        "name": "Priyanshu",
        "url": "https://priyanshu-eureka.netlify.app/"
      }
    }
    </script>
  </body>
</html>
`);
});

// Database read endpoint
app.get("/read-db", async (req, res) => {
  try {
    const { readDb } = require("./helper/read-db");
    const result = await readDb();
    logger.info("Database reading successful");
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("Database reading failed", { error: error.message || error });
    res.status(500).json({ success: false, error: error.message || error });
  }
});

// Manual database cleanup endpoint (admin only)
app.post("/admin/cleanup-database", async (req, res) => {
  try {
    const DEFAULT_DAYS = 30;
    const envDays = Number(process.env.DB_RETENTION_DAYS);
    const bodyDays = Number(req?.body?.days);

    let days = DEFAULT_DAYS;

    if (Number.isFinite(bodyDays) && bodyDays > 0) {
      days = bodyDays;
    } else if (Number.isFinite(envDays) && envDays > 0) {
      days = envDays;
    }

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
  logger.info(
    `🔄 Mode: ${
      process.env.NODE_ENV || "development"
    } Auto-scheduling enabled with node-cron`
  );

  // Initialize automatic scheduling
  setTimeout(() => {
    logger.info("⏰ Initializing automatic email scheduling...");
    emailScheduler.scheduleAllJobs();
  }, 5000); // 8 second delay to ensure everything is ready

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
