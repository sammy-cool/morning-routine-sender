// scripts/test-smtp.js
/**
 * Test SMTP configuration before deploying
 * Usage: node scripts/test-smtp.js
 */
const { createTransporter } = require("../config/email-config");
require("dotenv").config();

async function testSMTP() {
  console.log("🔍 Testing SMTP configuration...\n");

  try {
    const transporter = createTransporter();

    // Test connection
    console.log("Testing connection...");
    await transporter.verify();
    console.log("✅ Connection successful!\n");

    // Send test email
    const testEmail = process.env.TEST_EMAIL || process.env.FROM_USER;
    console.log(`Sending test email to ${testEmail}...`);

    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME || "Test"}" <${process.env.FROM_USER}>`,
      to: testEmail,
      subject: "SMTP Configuration Test ✓",
      text: "If you receive this email, your SMTP configuration is working correctly!",
      html: `
        <h2>✅ SMTP Test Successful</h2>
        <p>Your SMTP configuration is working correctly.</p>
        <hr>
        <p><small>Test performed at: ${new Date().toISOString()}</small></p>
      `,
    });

    console.log("✅ Test email sent successfully!");
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}\n`);

    // Close transporter
    transporter.close();

    process.exit(0);
  } catch (error) {
    console.error("❌ SMTP Test Failed:\n");
    console.error(`   Error: ${error.message}`);

    if (error.code) {
      console.error(`   Code: ${error.code}`);
    }

    console.error("\n💡 Troubleshooting tips:");
    console.error("   1. Check TRANSPORTER_HOST is correct");
    console.error(
      "   2. Verify TRANSPORTER_PORT (587 for STARTTLS, 465 for SSL)"
    );
    console.error("   3. Ensure FROM_USER and PASSWORD are correct");
    console.error("   4. For Gmail: Use App Password, not regular password");
    console.error("   5. Check firewall/network allows outbound SMTP");

    process.exit(1);
  }
}

testSMTP();
