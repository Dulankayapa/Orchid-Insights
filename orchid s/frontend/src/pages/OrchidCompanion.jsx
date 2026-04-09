import React, { useEffect, useMemo, useState } from "react";
import { getOrchids } from "../lib/companionApi";
import { useMonitorData } from "../hooks/useMonitorData";
import OrchidSelector from "../components/companion/OrchidSelector";
import MLHealthForecast from "../components/companion/MLHealthForecast";
import DynamicWateringAdvisor from "../components/companion/DynamicWateringAdvisor";
import SmartReminderList from "../components/companion/SmartReminderList";
import ResourceCarousel from "../components/companion/ResourceCarousel";
import GrowthTimeline from "../components/companion/GrowthTimeline";
import CompanionChat from "../components/companion/CompanionChat";
import "./OrchidCompanion.css";

const luxToLevel = (lux) => {
  if (lux === null || lux === undefined) return "medium";
  if (lux < 800) return "low";
  if (lux < 2500) return "medium";
  return "high";
};

export default function OrchidCompanion() {
  const { latest, connectionStatus } = useMonitorData();
  const [orchids, setOrchids] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const sensorData = useMemo(() => {
    if (!latest) return null;
    const temp = Number(latest.temperature ?? latest.temp ?? latest.temp_c ?? latest.t) || null;
    const humidity = Number(latest.humidity ?? latest.hum ?? latest.rh) || null;
    const lux = Number(latest.lux ?? latest.light ?? latest.light_lux) || null;
    const mq135 = Number(latest.mq135 ?? latest.air_quality) || null;
    return {
      temp,
      humidity,
      light: lux,
      lightLevel: luxToLevel(lux),
      mq135,
    };
  }, [latest]);

  useEffect(() => {
    let mounted = true;
    getOrchids()
      .then((list) => {
        if (!mounted) return;
        setOrchids(list || []);
        if (list?.length) setSelectedId(list[0].orchid_id);
      })
      .catch((err) => console.error("orchids", err));
    return () => {
      mounted = false;
    };
  }, []);

  const selectedOrchid = orchids.find((o) => o.orchid_id === selectedId);

  return (
    <div className="orchid-companion-page space-y-5">
      <section className="oc-hero">
        <div className="oc-hero-copy">
          <p className="kicker">Orchid Companion</p>
          <h1 className="oc-title">Adaptive care, reminders, and chat in one place.</h1>
          <p className="oc-subtitle">
            Live sensor context, ML health scoring, watering advice, and curated resources for each orchid.
          </p>
          <div className="oc-live-grid">
            <div className="oc-live-card">
              <span>Connection</span>
              <strong>{connectionStatus || "unknown"}</strong>
            </div>
            <div className="oc-live-card">
              <span>Temperature</span>
              <strong>{sensorData?.temp ?? "--"} °C</strong>
            </div>
            <div className="oc-live-card">
              <span>Humidity</span>
              <strong>{sensorData?.humidity ?? "--"} %</strong>
            </div>
            <div className="oc-live-card">
              <span>Light</span>
              <strong>{sensorData?.light ?? "--"} lx</strong>
            </div>
          </div>
        </div>
        <div className="companion-card">
          <h3 className="companion-title">Select Orchid</h3>
          <OrchidSelector orchids={orchids} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </section>

      {selectedId && sensorData ? (
        <>
          <section className="oc-grid oc-primary-grid">
            <div className="oc-card">
              <MLHealthForecast orchidId={selectedId} sensorData={sensorData} />
            </div>
            <div className="oc-card space-y-4">
              <DynamicWateringAdvisor orchidId={selectedId} sensorData={sensorData} />
              <SmartReminderList orchidId={selectedId} />
            </div>
          </section>

          <section className="oc-grid oc-secondary-grid">
            <ResourceCarousel species={selectedOrchid?.species} growthStage={selectedOrchid?.growth_stage} />
            <GrowthTimeline growthStage={selectedOrchid?.growth_stage} />
          </section>

          <section className="oc-card">
            <CompanionChat orchidId={selectedId} sensorData={sensorData} />
          </section>
        </>
      ) : (
        <div className="oc-card">
          <p className="text-sm text-subtle">Select an orchid to view personalized recommendations.</p>
        </div>
      )}
    </div>
  );
}
