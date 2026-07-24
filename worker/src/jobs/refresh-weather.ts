/**
 * Fetches current weather for key GB districts from Open-Meteo.
 * Runs every 6 hours. No API key required.
 */
import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import { createLogger } from '../logger.js';

const logger = createLogger('weather');

// Districts with approximate center coordinates
const DISTRICTS = [
  { name: 'Gilgit', lat: 35.9208, lon: 74.3082 },
  { name: 'Hunza', lat: 36.3167, lon: 74.65 },
  { name: 'Skardu', lat: 35.2965, lon: 75.6352 },
  { name: 'Diamer', lat: 35.1765, lon: 73.6571 },
  { name: 'Ghizer', lat: 36.0667, lon: 73.6167 },
  { name: 'Astore', lat: 35.3667, lon: 74.8667 },
];

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export async function refreshWeather() {
  logger.info('Starting weather refresh', { districts: DISTRICTS.length });

  // Prune snapshots older than 48 hours to keep the table bounded.
  try {
    await db.execute(
      sql`DELETE FROM weather_snapshots WHERE fetched_at < NOW() - INTERVAL '48 hours'`,
    );
  } catch (err) {
    logger.warn('Snapshot cleanup failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await Promise.all(
    DISTRICTS.map(async (district) => {
      try {
        const params = new URLSearchParams({
          latitude: String(district.lat),
          longitude: String(district.lon),
          // 'weather_code' is the correct field name in Open-Meteo API v1 (renamed from 'weathercode').
          current: 'temperature_2m,precipitation,windspeed_10m,weather_code',
          timezone: 'Asia/Karachi',
        });

        const res = await fetch(`${OPEN_METEO_URL}?${params}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const current = data.current ?? {};

        await db.execute(sql`
          INSERT INTO weather_snapshots
            (district, latitude, longitude, temperature_celsius, precipitation_mm, windspeed_kmh, weather_code, raw_json, fetched_at)
          VALUES
            (${district.name}, ${district.lat}, ${district.lon},
             ${current.temperature_2m ?? null},
             ${current.precipitation ?? null},
             ${current.windspeed_10m ?? null},
             ${current.weather_code ?? null},
             ${JSON.stringify(data)},
             NOW())
        `);

        logger.info(`${district.name} updated`, { tempC: current.temperature_2m });
      } catch (err) {
        logger.error(`${district.name} fetch failed`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );

  logger.info('Weather refresh complete');
}
