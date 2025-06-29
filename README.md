# 🌞 Morning Routine Sender

**Morning Routine Sender** is a lightweight Node.js app that automatically sends a daily motivational email using custom HTML templates and inspirational quotes.

## ✨ Features

- Sends personalized emails with motivational quotes.
- HTML-based email template.
- Scheduled with `node-cron` (can be customized).
- Avoids email threading using custom message headers.
- Built with Node.js, Express, and Nodemailer.
- Lightweight and deployable (supports platforms like Heroku).

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

| Endpoint        | Description                                     |
| --------------- | ----------------------------------------------- |
| `/`             | Homepage with links to send email, health check |
| `/send-email`   | Triggers the email sending manually             |
| `/health-check` | Returns basic health status                     |

---

## 📁 Project Structure

```
.
├── config/
│   └── email-config.js         # SMTP config
├── helper/
│   ├── shared-data.js          # Quote cache, utilities
│   └── util.js                 # Random message ID
├── email-html-template/
│   └── email-template.html     # Email layout
├── scheduled-jobs/
│   └── email-jobs.js           # Main email sending logic
├── index.js                    # Entry point (Express server)
├── .env.example                # Environment variable sample
├── Procfile                    # Heroku deployment file
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

## 📄 License

MIT © Priyanshu  
_“Eureka! Daily inspiration made simple.”_

---

## 🧠 Credits

Built with 💡 by [Priyanshu](https://priyanshu-eureka.netlify.app/)
