// config/smtp-providers.js
/**
 * Pre-configured settings for popular SMTP providers
 * Use these as reference or override with env vars
 */
const SMTP_PROVIDERS = {
  gmail: {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    notes: "Use App Password, not regular password. Enable 2FA first.",
  },

  outlook: {
    host: "smtp-mail.outlook.com",
    port: 587,
    secure: false,
    requireTLS: true,
    notes: "Works with Outlook.com, Hotmail, Live.com",
  },

  office365: {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    requireTLS: true,
    notes: "Enterprise Office 365 accounts",
  },

  sendgrid: {
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: "apikey", // literal string 'apikey'
      // pass: '<your-sendgrid-api-key>'
    },
    notes: "Use API key as password",
  },

  mailgun: {
    host: "smtp.mailgun.org",
    port: 587,
    secure: false,
    requireTLS: true,
    notes: "Use SMTP credentials from Mailgun dashboard",
  },

  ses: {
    host: "email-smtp.us-east-1.amazonaws.com", // Change region
    port: 587,
    secure: false,
    requireTLS: true,
    notes: "Use SMTP credentials from AWS SES console",
  },

  zoho: {
    host: "smtp.zoho.com",
    port: 587,
    secure: false,
    requireTLS: true,
    notes: "Use App Password if 2FA is enabled",
  },
};

/**
 * Get provider config by name
 * @param {string} providerName - Provider name (gmail, outlook, etc)
 * @returns {object|null} Provider configuration or null
 */
function getProviderConfig(providerName) {
  return SMTP_PROVIDERS[providerName.toLowerCase()] || null;
}

module.exports = { SMTP_PROVIDERS, getProviderConfig };
