import { api } from "./api";

const COMPANION_BASE = "/companion";

export const getOrchids = async (userId = "default") => {
  const { data } = await api.get(`${COMPANION_BASE}/orchids`, { params: { user_id: userId } });
  return data;
};

export const getHealthScore = async (orchidId, temp, humidity, light) => {
  const { data } = await api.get(`${COMPANION_BASE}/health-score/${orchidId}`, {
    params: { temp, humidity, light },
  });
  return data;
};

export const getNextWatering = async (orchidId, temp, humidity, lightLevel) => {
  const { data } = await api.get(`${COMPANION_BASE}/next-watering/${orchidId}`, {
    params: { temp, humidity, light_level: lightLevel },
  });
  return data;
};

export const getReminders = async (orchidId) => {
  const { data } = await api.get(`${COMPANION_BASE}/reminders/${orchidId}`);
  return data;
};

export const updateReminderStatus = async (reminderId, status) => {
  const { data } = await api.put(`${COMPANION_BASE}/reminders/${reminderId}/status`, null, {
    params: { status },
  });
  return data;
};

export const getResources = async (species, growthStage) => {
  const { data } = await api.get(`${COMPANION_BASE}/resources`, {
    params: { species, growth_stage: growthStage },
  });
  return data;
};

export const getGrowthAdvice = async (growthStage) => {
  const { data } = await api.get(`${COMPANION_BASE}/growth-advice/${growthStage}`);
  return data;
};

export const postFeedback = async (feedback) => {
  const { data } = await api.post(`${COMPANION_BASE}/feedback`, feedback);
  return data;
};

export const sendChatMessage = async (message, temp, humidity, lux, mq135) => {
  const { data } = await api.post(`${COMPANION_BASE}/chat`, {
    message,
    temperature: temp,
    humidity,
    lux,
    mq135,
  });
  return data;
};
