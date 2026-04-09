import React, { useEffect, useState } from "react";
import { getResources } from "../../lib/companionApi";

export default function ResourceCarousel({ species, growthStage }) {
  const [resources, setResources] = useState([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!species || !growthStage) return;
    getResources(species, growthStage).then(setResources).catch((err) => console.error("resources", err));
  }, [species, growthStage]);

  if (!resources.length) return null;

  const current = resources[index];
  const next = () => setIndex((i) => (i + 1) % resources.length);
  const prev = () => setIndex((i) => (i - 1 + resources.length) % resources.length);

  return (
    <div className="companion-card">
      <h3 className="companion-title">Learning Resources</h3>
      <div className="border rounded p-3 bg-surface">
        <h4 className="font-semibold">{current.title}</h4>
        <p className="text-sm text-subtle mt-1">{current.description}</p>
        <a href={current.link} target="_blank" rel="noreferrer" className="text-primary text-sm mt-2 inline-block font-semibold">
          Read more ->
        </a>
      </div>
      {resources.length > 1 && (
        <div className="flex justify-between mt-3 text-sm">
          <button type="button" onClick={prev} className="btn-soft px-3 py-1 rounded">
            {"<- Prev"}
          </button>
          <button type="button" onClick={next} className="btn-soft px-3 py-1 rounded">
            {"Next ->"}
          </button>
        </div>
      )}
    </div>
  );
}
