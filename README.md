# 🌞 Morning Routine Sender

**Morning Routine Sender** is a lightweight Node.js app that automatically sends a daily motivational email using custom HTML templates and inspirational quotes.

## ✨ Features

- Modular email sending with `generateEmailOptions` and `sendEmail` functions for better maintainability.
- Sends personalized emails with motivational quotes.
- HTML-based email template.
- Scheduled with `node-cron` (can be customized).
- Avoids email threading using custom message headers.
- Built with Node.js, Express, and Nodemailer.
- Lightweight and deployable (supports platforms like Heroku).
- Unsubscribe option in emails with a `/unsubscribe` endpoint.

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/morning-routine-sender.git
cd morning-routine-sender
```

### 2. Install dependencies

```bash
npm install
```

### Dependencies

- API rate limiting with `express-rate-limit` for security.
- Structured logging with `winston` for debugging and monitoring.
  ## 📜 Logging
- Logs are saved to `error.log` (errors only) and `combined.log` (all logs) in the project root.
- In development, logs also appear in the console.
- Uses `winston` for structured, JSON-formatted logging.
- **Note**: Log files (`error.log`, `combined.log`) are excluded from version control via `.gitignore`.

### 3. Setup Environment Variables

Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
PORT=3000
FROM_USER=your@email.com
TO_USER=recipient@email.com
EMAIL_PASS=your-app-password
EMAIL_SERVICE=gmail
```

---

## 🛠 Available Scripts

### Start the app

```bash
node index.js
```

### Development with Nodemon

```bash
npm install -g nodemon
nodemon index.js
```

---

## 📨 Email System

The app uses `nodemailer` to send HTML-based emails that include a **random motivational quote**. Key aspects:

- Quotes are cached to avoid duplication.
- Headers like `Message-ID` and `If-Modified-Since` are dynamically set to prevent email threading.
- Email content is generated from `email-template.html`.

### Example Email Subject:

```
Your Morning Routine: "Be yourself; everyone else is already taken." - 9:15:03 AM
```

---

## 🌐 API Endpoints

| Endpoint        | Description                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------- |
| `/`             | Homepage with links to send email, health check                                                   |
| `/send-email`   | Triggers the email sending manually                                                               |
| `/health-check` | Returns basic health status                                                                       |
| `/unsubscribe`  | Handles unsubscribe requests with an email query parameter                                        |
| `/send-email`   | Triggers the email job and returns a JSON response with sent, skipped, failed, and invalid emails |

## 📩 Response Format

The `/send-email` endpoint returns a JSON response:

```json
{
  "message": "Email job completed",
  "results": {
    "sent": ["email1@example.com"],
    "skipped": ["email2@example.com"],
    "failed": [{ "email": "email3@example.com", "error": "Error message" }],
    "invalid": ["invalid@"]
  }
}

---

## 📁 Project Structure

.
├── config/
│ └── email-config.js # SMTP config
├── helper/
│ ├── shared-data.js # Quote cache, utilities
│ └── util.js # Random message ID
├── email-html-template/
│ └── email-template.html # Email layout
├── scheduled-jobs/
│ └── email-jobs.js # Main email sending logic
├── index.js # Entry point (Express server)
├── .env.example # Environment variable sample
├── Procfile # Heroku deployment file

```

---

## 🧪 Deployment

You can deploy this app easily to **Heroku**, **Render**, or **any Node.js-compatible platform**.

For Heroku:

```bash
heroku create
git push heroku main
heroku config:set FROM_USER=...
heroku config:set TO_USER=...
# ...other env variables
```

---

## Contributing

- Commit messages should follow the Conventional Commits format: `<type>(<scope>): <description>`.
- Example: `fix(api): return detailed JSON response for /send-email`.
- Include a longer description for complex changes.

## 📄 License

MIT © Priyanshu  
_“Eureka! Daily inspiration made simple.”_

---

## 🧠 Credits

Built with 💡 by [Priyanshu](https://priyanshu-eureka.netlify.app/)
