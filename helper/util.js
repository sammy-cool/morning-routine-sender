const crypto = require("crypto");

function generateRandomMessageID() {
  const timestamp = Date.now().toString();
  const randomString = generateRandomString(10);
  const hash = crypto
    .createHash("sha256")
    .update(timestamp + randomString)
    .digest("hex");
  return hash.slice(0, 20);
}

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomString = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.charAt(randomIndex);
  }

  return randomString;
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  const maskedLocal =
    local[0] + "*".repeat(Math.max(local.length - 2, 1)) + local.slice(-1);
  return `${maskedLocal}@${domain}`;
}

module.exports = { generateRandomMessageID, maskEmail };
