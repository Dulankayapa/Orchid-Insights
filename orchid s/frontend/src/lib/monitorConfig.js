export const HISTORY_FILTERS = [
  { value: '24h', label: '24 Hours', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: '7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d', label: '30 Days', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: 'all', label: 'All Data', ms: null },
];

export const METRIC_DEFINITIONS = {
  temperature: {
    key: 'temperature',
    label: 'Temperature',
    unit: 'C',
    decimals: 1,
    aliases: ['temperature', 'temp', 't'],
    color: '#f97316',
    weight: 0.24,
  },
  humidity: {
    key: 'humidity',
    label: 'Humidity',
    unit: '%',
    decimals: 1,
    aliases: ['humidity', 'hum', 'h'],
    color: '#3b82f6',
    weight: 0.2,
  },
  light: {
    key: 'light',
    label: 'Light',
    unit: 'lx',
    decimals: 0,
    aliases: ['lux', 'light', 'lx'],
    color: '#f59e0b',
    weight: 0.16,
  },
  co2: {
    key: 'co2',
    label: 'CO2',
    unit: 'ppm',
    decimals: 0,
    aliases: ['co2', 'co_2', 'ppm', 'mq135', 'mq', 'gas'],
    color: '#10b981',
    weight: 0.16,
  },
  ph: {
    key: 'ph',
    label: 'pH',
    unit: 'pH',
    decimals: 2,
    aliases: ['ph', 'pH', 'ph_value', 'phValue'],
    color: '#a855f7',
    weight: 0.12,
  },
  soilMoisture: {
    key: 'soilMoisture',
    label: 'Soil Moisture',
    unit: '%',
    decimals: 1,
    aliases: ['soilMoisture', 'soil_moisture', 'moisture', 'soil'],
    color: '#14b8a6',
    weight: 0.12,
  },
};

export const COMPARISON_METRIC_KEYS = ['temperature', 'humidity', 'light', 'co2', 'ph'];

export const DEFAULT_THRESHOLDS = {
  staleSeconds: 90,
  offlineSeconds: 180,
  predictiveHorizonHours: 3,
  metrics: {
    temperature: { min: 18, max: 28 },
    humidity: { min: 45, max: 72 },
    light: { min: 1200, max: 26000 },
    co2: { min: 350, max: 1300 },
    ph: { min: 5.6, max: 6.8 },
    soilMoisture: { min: 35, max: 75 },
  },
  notifications: {
    emailEnabled: false,
    emailRecipients: '',
  },
};

export const GREENHOUSE_DEVICES = [
  { key: 'fan', label: 'Fan', description: 'Airflow and cooling', powerWatts: 45 },
  { key: 'pump', label: 'Pump', description: 'Nutrient circulation', powerWatts: 85 },
  { key: 'growLights', label: 'Grow Lights', description: 'Lighting support', powerWatts: 120 },
  { key: 'ventilation', label: 'Ventilation', description: 'Fresh air exchange', powerWatts: 60 },
];

export const DEFAULT_CONTROL_STATE = {
  mode: 'auto',
  devices: {
    fan: false,
    pump: false,
    growLights: false,
    ventilation: false,
  },
  autoRulesEnabled: true,
};

export const DEFAULT_MAINTENANCE_TASKS = [
  { key: 'sensor_calibration', label: 'Sensor calibration', intervalDays: 14 },
  { key: 'pump_check', label: 'Pump and tubing check', intervalDays: 7 },
  { key: 'fan_service', label: 'Fan and ventilation clean', intervalDays: 10 },
  { key: 'probe_cleaning', label: 'pH probe cleaning', intervalDays: 7 },
];

export const ROLE_CAPABILITIES = {
  admin: { canEditThresholds: true, canControlDevices: true, canExport: true, canManageUsers: true },
  researcher: { canEditThresholds: false, canControlDevices: false, canExport: true, canManageUsers: false },
  operator: { canEditThresholds: false, canControlDevices: true, canExport: false, canManageUsers: false },
  viewer: { canEditThresholds: false, canControlDevices: false, canExport: false, canManageUsers: false },
};

export const AI_TIPS = [
  'Keep a small day-night temperature gap to support stable flowering.',
  'Avoid humidity spikes above range for long periods to reduce fungal stress.',
  'When light and heat rise together, airflow is usually the first corrective action.',
  'Low pH drift can quickly reduce nutrient uptake consistency.',
  'Short pump cycles are safer than long flooding when root oxygen is limited.',
];

export const WEATHER_DEFAULT = {
  latitude: 6.9271,
  longitude: 79.8612,
  locationLabel: 'Colombo',
};