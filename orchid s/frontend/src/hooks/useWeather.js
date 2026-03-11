import { useEffect, useMemo, useState } from 'react';
import { WEATHER_DEFAULT } from '../lib/monitorConfig';

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const useWeather = ({ latitude, longitude, locationLabel } = {}) => {
  const lat = toNumber(latitude) ?? WEATHER_DEFAULT.latitude;
  const lon = toNumber(longitude) ?? WEATHER_DEFAULT.longitude;
  const label = locationLabel || WEATHER_DEFAULT.locationLabel;

  const [weather, setWeather] = useState(null);
  const [weatherError, setWeatherError] = useState('');

  useEffect(() => {
    let active = true;

    const fetchWeather = async () => {
      try {
        const params = new URLSearchParams({
          latitude: String(lat),
          longitude: String(lon),
          current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code',
          daily: 'precipitation_probability_max,temperature_2m_max,temperature_2m_min',
          timezone: 'auto',
          forecast_days: '2',
        });

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Weather API failed (${response.status})`);
        }

        const json = await response.json();
        if (!active) return;

        setWeather({
          location: label,
          fetchedAt: Date.now(),
          current: {
            temperature: toNumber(json?.current?.temperature_2m),
            humidity: toNumber(json?.current?.relative_humidity_2m),
            precipitation: toNumber(json?.current?.precipitation),
            code: json?.current?.weather_code,
          },
          forecast: {
            rainProbability: toNumber(json?.daily?.precipitation_probability_max?.[0]),
            maxTemp: toNumber(json?.daily?.temperature_2m_max?.[0]),
            minTemp: toNumber(json?.daily?.temperature_2m_min?.[0]),
          },
        });

        setWeatherError('');
      } catch (error) {
        if (!active) return;
        setWeatherError(error?.message || 'Unable to load weather data');
      }
    };

    fetchWeather();
    const timer = setInterval(fetchWeather, 15 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [lat, lon, label]);

  const weatherSummary = useMemo(() => {
    if (!weather) return null;
    const rain = weather.forecast?.rainProbability;
    const rainSignal = rain === null || rain === undefined
      ? 'No forecast'
      : rain > 60
        ? 'High rain chance'
        : rain > 30
          ? 'Moderate rain chance'
          : 'Low rain chance';

    return {
      ...weather,
      rainSignal,
    };
  }, [weather]);

  return {
    weather: weatherSummary,
    weatherError,
  };
};
