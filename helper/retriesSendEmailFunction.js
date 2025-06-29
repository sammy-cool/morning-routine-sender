// //not being used as of now

// //! Retries Inside sendEmail() (Self-contained)
// async function sendEmail(retries = 3, delayMs = 2000) {
//   for (let attempt = 1; attempt <= retries; attempt++) {
//     try {
//       console.log(`Attempt ${attempt} to send email...`);

//       await transporter.sendMail({
//         from: process.env.SMTP_USER,
//         to: 'user@example.com',
//         subject: 'Retrying Email',
//         text: 'This is a retry-capable email.',
//       });

//       console.log("Email sent successfully.");
//       break; // Exit if successful

//     } catch (err) {
//       console.error(`Attempt ${attempt} failed:`, err);

//       if (attempt < retries) {
//         // Wait before retrying
//         await new Promise(res => setTimeout(res, delayMs));
//       } else {
//         console.error("All attempts failed.");
//         // Optional: throw or log to monitoring system
//       }
//     }
//   }
// }

// //! Retries Outside sendEmail() (Caller-controlled)
// async function retry(fn, retries = 3, delayMs = 2000) {
//   for (let i = 1; i <= retries; i++) {
//     try {
//       await fn();
//       return; // Success
//     } catch (err) {
//       console.error(`Attempt ${i} failed:`, err);
//       if (i < retries) {
//         await new Promise(res => setTimeout(res, delayMs));
//       } else {
//         console.error("All retries failed.");
//         throw err; // Let the caller handle it if needed
//       }
//     }
//   }
// }
// // Usage:
// cron.schedule('0 7 * * *', async () => {
//   try {
//     await retry(sendEmail, 3, 2000); // 3 attempts, 2s delay
//   } catch (err) {
//     // Optional: alert admin, log to monitoring
//   }
// }, {
//   timezone: 'Asia/Kolkata'
// });
