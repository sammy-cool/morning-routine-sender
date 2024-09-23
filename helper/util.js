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

module.exports = { generateRandomMessageID };
