const express = require('express');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

const app = express();
const port = process.env.PORT || 3000;

// Twilio Configuration (optional)
const accountSid = 'your_twilio_account_sid';
const authToken = 'your_twilio_auth_token';
const client = twilio(accountSid, authToken);

// Email Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your_email@gmail.com',
        pass: 'your_email_password'
    }
});

// Your morning routine recommendation
const morningRoutine = `
Here's your personalized morning routine to increase productivity:

1. Gradual Wake-Up (9:00 AM - 9:10 AM)
2. Hydrate & Refresh (9:10 AM - 9:20 AM)
3. Energizing Yoga (9:20 AM - 9:40 AM)
4. Mindful Meditation (9:40 AM - 9:50 AM)
5. Light Breakfast (9:50 AM - 10:00 AM)
6. Set Daily Intentions (10:00 AM)
`;

// Endpoint to send an email
app.get('/send-email', (req, res) => {
    const mailOptions = {
        from: 'your_email@gmail.com',
        to: 'priyanshu.alt191@gmail.com', // Replace with your email
        subject: 'Your Morning Routine',
        text: morningRoutine
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).send('Error sending email: ' + error.toString());
        }
        res.send('Email sent: ' + info.response);
    });
});

// Endpoint to send an SMS (optional)
app.get('/send-sms', (req, res) => {
    client.messages.create({
        body: morningRoutine,
        from: '+12345678901', // Replace with your Twilio phone number
        to: '+9183xxxxxxx71'  // Replace with your phone number
    })
    .then(message => res.send('SMS sent: ' + message.sid))
    .catch(error => res.status(500).send('Error sending SMS: ' + error.toString()));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
