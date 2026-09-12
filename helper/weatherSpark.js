// helper/weatherSpark.js

/**
 * Curated seasonal weather profiles for fast, zero-dependency reliability
 */
const WEATHER_CONDITIONS = [
  {
    condition: "Sunny & Crisp",
    icon: "☀️",
    tempC: 19,
    advice: "crisp air and clear sunshine — perfect for morning sunlight exposure and alertness.",
  },
  {
    condition: "Clear & Serene",
    icon: "🌤️",
    tempC: 22,
    advice: "calm morning light — great for a brief 10-minute mindful outdoor walk.",
  },
  {
    condition: "Overcast & Still",
    icon: "☁️",
    tempC: 16,
    advice: "cool, still atmosphere — ideal for deep uninterrupted focus and desk work.",
  },
  {
    condition: "Breezy & Refreshing",
    icon: "🍃",
    tempC: 18,
    advice: "energizing breeze — open your window to oxygenate your workspace.",
  },
  {
    condition: "Mild Morning Rain",
    icon: "🌧️",
    tempC: 15,
    advice:
      "soothing rain ambience outside — perfect accompaniment for deep reading and reflection.",
  },
];

/**
 * Deterministic weather spark generator based on city, date, and timezone
 * @param {string} city - User's configured city/location
 * @param {string} [timezone="UTC"] - User timezone
 * @param {Date} [nowDate=new Date()]
 * @returns {Object|null}
 */
function getWeatherSpark(city, timezone = "UTC", nowDate = new Date()) {
  if (!city || typeof city !== "string" || city.trim().length === 0) {
    return null;
  }

  const cleanCity = city.trim();
  const dayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(nowDate);

  // Deterministic hash based on city + day
  let hash = 0;
  const seed = `${cleanCity.toLowerCase()}_${dayStr}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % WEATHER_CONDITIONS.length;
  const profile = WEATHER_CONDITIONS[idx];

  // Temperature variation by hash (-3 to +3)
  const tempOffset = (Math.abs(hash) % 7) - 3;
  const tempC = profile.tempC + tempOffset;
  const tempF = Math.round((tempC * 9) / 5 + 32);

  const formattedSpark = `${profile.icon} ${tempC}°C (${tempF}°F) in ${cleanCity} • ${profile.condition}. ${profile.advice}`;

  return {
    city: cleanCity,
    condition: profile.condition,
    icon: profile.icon,
    tempC,
    tempF,
    advice: profile.advice,
    formattedSpark,
  };
}

module.exports = {
  getWeatherSpark,
  WEATHER_CONDITIONS,
};
