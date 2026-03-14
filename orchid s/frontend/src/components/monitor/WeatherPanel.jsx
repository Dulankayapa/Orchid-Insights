import React from 'react';

const valueOrDash = (value, suffix = '') => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `${num}${suffix}`;
};

const WeatherPanel = ({ weather, weatherError }) => (
  <section className="panel space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h2 className="module-title">Outside Weather</h2>
      <span className="text-xs text-subtle">External API</span>
    </div>

    {weatherError && <p className="text-sm text-rose-500">{weatherError}</p>}

    {!weather ? (
      <p className="text-sm text-subtle">Loading weather data...</p>
    ) : (
      <>
        <div className="dashboard-card p-3 text-sm">
          <p className="font-semibold text-dark">{weather.location}</p>
          <p className="text-xs text-subtle">
            Updated {new Date(weather.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="dashboard-card p-3 text-xs">
            <p className="text-subtle">Outside Temp</p>
            <p className="text-sm font-semibold text-dark">{valueOrDash(weather.current?.temperature, ' C')}</p>
          </div>
          <div className="dashboard-card p-3 text-xs">
            <p className="text-subtle">Outside Humidity</p>
            <p className="text-sm font-semibold text-dark">{valueOrDash(weather.current?.humidity, '%')}</p>
          </div>
          <div className="dashboard-card p-3 text-xs">
            <p className="text-subtle">Rain Forecast</p>
            <p className="text-sm font-semibold text-dark">{valueOrDash(weather.forecast?.rainProbability, '%')}</p>
            <p className="text-[11px] text-subtle">{weather.rainSignal}</p>
          </div>
        </div>
      </>
    )}
  </section>
);

export default WeatherPanel;
