// retryUtil.js
async function retry(fn, retries = 3, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < retries) {
        console.warn(`Retry ${i} failed. Retrying...`);
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        throw err;
      }
    }
  }
}
module.exports = { retry };
