import React, { useState } from "react";

// ─── Fertilizer Database ────────────────────────────────────────────────────
const FERTILIZER_DATA = {
  vanda: {
    commonName: "Vanda Orchid",
    emoji: "🌺",
    accentColor: "#c084fc", // orchid-400
    glowColor: "rgba(192,132,252,0.15)",
    borderColor: "rgba(192,132,252,0.25)",
    textColor: "#e9d5ff",
    dimText: "#a855f7",
    fertilizers: [
      {
        id: "v1",
        name: "High-Nitrogen Growth Booster",
        npk: "30-10-10",
        phase: "Vegetative / Growing Season",
        phaseIcon: "🌱",
        description:
          "Vandas are heavy feeders with extensive aerial root systems. A high-nitrogen formula promotes vigorous leaf and root growth during the active growing season (spring–summer).",
        frequency: "Weekly (weak solution) or every 2 weeks (full strength)",
        dosage: "½ tsp per gallon of water",
        howToUse: [
          "Dissolve fertilizer completely in room-temperature water.",
          "Water the plant first to avoid fertilizer burn on dry roots.",
          "Apply the solution by pouring or misting over the entire root system and leaves.",
          "Allow excess to drain freely — Vandas dislike standing water.",
          "Flush with plain water once a month to prevent salt buildup.",
        ],
        tips: 'Vandas thrive with "weakly, weekly" feeding. Never let roots sit in solution.',
        warning: null,
      },
      {
        id: "v2",
        name: "Bloom Booster",
        npk: "10-30-20",
        phase: "Flowering / Pre-bloom",
        phaseIcon: "🌸",
        description:
          "Switch to a high-phosphorus blend 6–8 weeks before expected blooming to encourage spike initiation and vibrant flowers.",
        frequency: "Every 2 weeks during pre-bloom",
        dosage: "¼ tsp per gallon of water",
        howToUse: [
          "Begin application when the plant shows signs of a new growth spike.",
          "Mix with lukewarm water and apply to roots and growing media.",
          "Reduce nitrogen sources during this period to avoid pushing foliage at the expense of blooms.",
          "Continue until buds are fully formed, then return to balanced feeding.",
        ],
        tips: "Pair with cooler night temperatures (15–18 °C) to trigger spiking.",
        warning: null,
      },
    ],
  },

  oncidium: {
    commonName: "Oncidium Orchid",
    emoji: "💛",
    accentColor: "#facc15", // yellow-400
    glowColor: "rgba(250,204,21,0.12)",
    borderColor: "rgba(250,204,21,0.22)",
    textColor: "#fef9c3",
    dimText: "#ca8a04",
    fertilizers: [
      {
        id: "o1",
        name: "Balanced All-Purpose Orchid Feed",
        npk: "20-20-20",
        phase: "Year-round / General Maintenance",
        phaseIcon: "🔄",
        description:
          "Oncidiums prefer a steady, balanced fertilizer throughout the year. Their pseudobulbs store nutrients, so consistent mild feeding outperforms infrequent heavy doses.",
        frequency: "Every 2 weeks",
        dosage: "¼ tsp per gallon of water",
        howToUse: [
          "Mix thoroughly in clean water.",
          "Water plant thoroughly first, then apply the diluted fertilizer.",
          "Drench the potting medium (bark/moss) until it runs out the drainage holes.",
          "Skip fertilizing when the plant is dormant (pseudobulbs wrinkled, no new growth).",
          "Rinse roots monthly with plain water to leach accumulated salts.",
        ],
        tips: "If growing in bark, slightly increase nitrogen as bark decomposition consumes nitrogen.",
        warning: null,
      },
      {
        id: "o2",
        name: "Low-Nitrogen Bloom Enhancer",
        npk: "10-30-20",
        phase: "Pre-bloom (6–8 weeks before spike)",
        phaseIcon: "🌼",
        description:
          "Boost phosphorus and potassium before expected flowering to increase spike count and extend bloom duration — Oncidiums can produce many branches of flowers.",
        frequency: "Weekly during spike development",
        dosage: "¼ tsp per gallon of water",
        howToUse: [
          "Identify early spike emergence from the base of a mature pseudobulb.",
          "Switch to this formula immediately upon spike detection.",
          "Apply to roots and media; avoid direct spray on developing buds.",
          "Return to balanced feed once flowers open fully.",
        ],
        tips: "Reduce watering slightly to stress-trigger blooming — keep pseudobulbs firm.",
        warning: null,
      },
    ],
  },

  phalaenopsis: {
    commonName: "Phalaenopsis (Moth Orchid)",
    emoji: "🦋",
    accentColor: "#86efac", // green-300
    glowColor: "rgba(134,239,172,0.12)",
    borderColor: "rgba(134,239,172,0.22)",
    textColor: "#dcfce7",
    dimText: "#4ade80",
    fertilizers: [
      {
        id: "p1",
        name: "Urea-Free Orchid Formula",
        npk: "20-20-20 (urea-free)",
        phase: "Active Growth (spring–summer)",
        phaseIcon: "🌿",
        description:
          "Phalaenopsis roots absorb nutrients best from urea-free formulas. Indoor light conditions limit photosynthesis, so a gentle balanced feed sustains healthy foliage without salt stress.",
        frequency: "Every 2–3 weeks",
        dosage: "¼ tsp per gallon of water",
        howToUse: [
          "Always water with plain water before fertilizing to protect roots.",
          "Pour diluted solution over the bark mix until it drains freely.",
          "Never fertilize a stressed, dehydrated, or recently repotted plant.",
          "Flush the pot with plain water once a month.",
          "Avoid getting fertilizer on leaves to prevent spotting.",
        ],
        tips: '"Feed weakly, weekly" is the golden rule for Phals — less is always more.',
        warning:
          "Do NOT fertilize when plant is in full bloom — it shortens flower life.",
      },
      {
        id: "p2",
        name: "Potassium-Rich Spike Trigger",
        npk: "10-10-30",
        phase: "Post-bloom Rest & Spike Induction",
        phaseIcon: "🎋",
        description:
          "After blooms drop, a high-potassium feed combined with cool nights (15–17 °C) triggers new spike formation from the nodes of the old spike.",
        frequency: "Monthly during rest period",
        dosage: "⅛ tsp per gallon of water (very dilute)",
        howToUse: [
          "Cut the old spike above the 2nd or 3rd node after flowers fall.",
          "Apply this diluted solution once a month for 2–3 months.",
          "Place plant near a window with a cooler night temperature differential.",
          "Once a new spike is visible, return to balanced urea-free feed.",
        ],
        tips: "Temperature drop of 8–10 °C between day and night is more effective than fertilizer alone.",
        warning: null,
      },
    ],
  },

  cattleya: {
    commonName: "Cattleya Orchid",
    emoji: "👑",
    accentColor: "#f9a8d4", // pink-300
    glowColor: "rgba(249,168,212,0.12)",
    borderColor: "rgba(249,168,212,0.22)",
    textColor: "#fce7f3",
    dimText: "#ec4899",
    fertilizers: [
      {
        id: "c1",
        name: "High-Nitrogen Spring Formula",
        npk: "30-10-10",
        phase: "New Growth Phase (spring)",
        phaseIcon: "🌱",
        description:
          "Cattleyas produce robust pseudobulbs that need a nitrogen push as new growths emerge in spring. This fuels strong pseudobulb development which directly supports future flowering.",
        frequency: "Every 10–14 days",
        dosage: "½ tsp per gallon of water",
        howToUse: [
          "Apply at the start of new growth emergence from the base of existing pseudobulbs.",
          "Water thoroughly before applying fertilizer.",
          "Drench the coarse bark or rock medium; Cattleyas prefer excellent drainage.",
          "Alternate with plain water every other watering.",
          "Stop high-nitrogen feeding once new pseudobulb reaches full size.",
        ],
        tips: "Strong pseudobulbs = larger, more fragrant blooms. Never skimp on spring feeding.",
        warning: null,
      },
      {
        id: "c2",
        name: "Balanced Summer Maintenance Feed",
        npk: "20-20-20",
        phase: "Mid-season (summer)",
        phaseIcon: "☀️",
        description:
          "Transition to a balanced formula mid-season as the pseudobulb matures. This supports the entire plant without overstimulating vegetative growth at the expense of bud formation.",
        frequency: "Every 2 weeks",
        dosage: "¼ tsp per gallon of water",
        howToUse: [
          "Continue until sheath (leaf-like covering around bud) becomes visible.",
          "Apply to roots and media; avoid the sheath to prevent rot.",
          "Reduce watering frequency slightly in August to harden pseudobulbs.",
        ],
        tips: "Good airflow around sheaths prevents bud blast — the #1 Cattleya frustration.",
        warning: null,
      },
      {
        id: "c3",
        name: "Bloom Booster",
        npk: "10-30-20",
        phase: "Pre-bloom / Sheath stage",
        phaseIcon: "🌺",
        description:
          "Shift to high phosphorus once buds are developing inside the sheath. This maximises petal count, size, and the legendary Cattleya fragrance.",
        frequency: "Every 2 weeks until flowers open",
        dosage: "¼ tsp per gallon of water",
        howToUse: [
          "Switch as soon as buds swell visibly inside the sheath.",
          "Apply carefully; keep fertilizer away from opening buds.",
          "Cease fertilizing once flowers are fully open.",
          "Resume balanced feeding for remaining pseudobulbs after blooming.",
        ],
        tips: "Cattleyas in bloom last 2–6 weeks — avoid drafts and excess humidity to extend display.",
        warning: null,
      },
    ],
  },

  dendrobium: {
    commonName: "Dendrobium Orchid",
    emoji: "🎍",
    accentColor: "#67e8f9", // cyan-300
    glowColor: "rgba(103,232,249,0.12)",
    borderColor: "rgba(103,232,249,0.22)",
    textColor: "#cffafe",
    dimText: "#22d3ee",
    fertilizers: [
      {
        id: "d1",
        name: "High-Nitrogen Cane Builder",
        npk: "30-10-10",
        phase: "Active Cane Growth (spring–summer)",
        phaseIcon: "🎋",
        description:
          "Dendrobiums form tall canes (pseudobulbs) that must fully mature before the plant can bloom. A nitrogen-rich feed from spring through summer drives vigorous cane development.",
        frequency: "Every 2 weeks",
        dosage: "½ tsp per gallon of water",
        howToUse: [
          "Begin feeding when new cane growth is 5–8 cm tall.",
          "Apply to the potting medium (fine bark or sphagnum), avoiding the growing tip.",
          "Ensure excellent drainage — Dendrobium roots are prone to rot.",
          "Continue until canes reach full height, usually by late summer.",
        ],
        tips: "Taller, thicker canes produce more and longer-lasting flower spikes.",
        warning: null,
      },
      {
        id: "d2",
        name: "Rest-Period Potassium Hardener",
        npk: "6-6-30",
        phase: "Autumn Rest / Cane Hardening",
        phaseIcon: "🍂",
        description:
          "Deciduous and semi-deciduous Dendrobiums need a dry, cool rest. A final high-potassium feed hardens canes and primes nodes for spring flowering. Stop feeding entirely after this.",
        frequency: "Once (single application) in early autumn",
        dosage: "½ tsp per gallon of water",
        howToUse: [
          "Apply this as the last fertilizer of the season when new growth has stopped.",
          "Reduce watering dramatically after application — nearly dry through winter.",
          "Move to a cooler location (10–15 °C nights) to simulate dry season.",
          "Resume watering and balanced feeding only when new buds break in spring.",
        ],
        tips: "Resist the urge to water or feed during winter dormancy — this is when bloom magic happens.",
        warning:
          "⚠️ Over-feeding in autumn prevents dormancy and eliminates flowering for the season.",
      },
      {
        id: "d3",
        name: "Spring Bloom Activator",
        npk: "10-30-20",
        phase: "Post-dormancy / Bud Break",
        phaseIcon: "🌸",
        description:
          "As dormancy ends and flower buds swell along the canes, resume feeding with a phosphorus-rich formula to fuel the spectacular cascading bloom display Dendrobiums are known for.",
        frequency: "Every 2 weeks once buds are visible",
        dosage: "¼ tsp per gallon of water",
        howToUse: [
          "Resume watering gradually as buds appear on old canes.",
          "Apply dilute solution; roots are sensitive after winter dry-out.",
          "Do not let water sit in crown or between canes.",
          "Continue until all flowers open, then switch back to growth formula for new canes.",
        ],
        tips: "Old leafless canes still flower — never cut them until they are completely shrivelled.",
        warning: null,
      },
    ],
  },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function NPKBadge({ npk, accentColor }) {
  const parts = npk.split("-").slice(0, 3);
  const labels = ["N", "P", "K"];
  const colors = ["#4ade80", "#60a5fa", "#f97316"];
  return (
    <div className="flex items-center gap-1.5">
      {parts.map((v, i) => (
        <div key={i} className="flex flex-col items-center">
          <span
            className="text-[10px] font-bold leading-none"
            style={{ color: colors[i] }}
          >
            {labels[i]}
          </span>
          <span
            className="font-mono text-sm font-semibold leading-tight"
            style={{ color: colors[i] }}
          >
            {v.replace(/[^0-9]/g, "")}
          </span>
        </div>
      ))}
      <span className="ml-1 text-[10px] font-mono opacity-50 self-end mb-0.5">
        {npk.includes("urea") ? "(urea-free)" : ""}
      </span>
    </div>
  );
}

function HowToUseModal({ fertilizer, orchid, onClose }) {
  const [step, setStep] = useState(0);
  const total = fertilizer.howToUse.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md p-6 rounded-3xl"
        style={{
          background: "#0d1117",
          border: `1px solid ${orchid.borderColor}`,
          boxShadow: `0 0 60px ${orchid.glowColor}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p
              className="text-[10px] tracking-widest uppercase"
              style={{ color: orchid.dimText }}
            >
              How To Use
            </p>
            <h3
              className="text-lg font-semibold mt-0.5"
              style={{ color: orchid.textColor }}
            >
              {fertilizer.name}
            </h3>
            <p
              className="text-xs mt-0.5 opacity-60"
              style={{ color: orchid.textColor }}
            >
              NPK {fertilizer.npk} · {fertilizer.phase}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 text-lg transition-opacity rounded-full opacity-50 hover:opacity-100"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            ✕
          </button>
        </div>

        {/* Step progress */}
        <div className="flex gap-1 mb-5">
          {fertilizer.howToUse.map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 transition-all duration-300 rounded-full cursor-pointer"
              style={{
                background:
                  i <= step ? orchid.accentColor : "rgba(255,255,255,0.1)",
                opacity: i === step ? 1 : i < step ? 0.6 : 0.3,
              }}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        {/* Current step */}
        <div
          className="rounded-2xl p-5 mb-4 min-h-[100px] flex flex-col justify-between"
          style={{
            background: `${orchid.glowColor}`,
            border: `1px solid ${orchid.borderColor}`,
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="flex items-center justify-center text-sm font-bold rounded-full w-7 h-7"
              style={{ background: orchid.accentColor, color: "#0d1117" }}
            >
              {step + 1}
            </div>
            <span
              className="text-xs opacity-50"
              style={{ color: orchid.textColor }}
            >
              Step {step + 1} of {total}
            </span>
          </div>
          <p
            className="text-sm leading-relaxed"
            style={{ color: orchid.textColor }}
          >
            {fertilizer.howToUse[step]}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-25"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: orchid.textColor,
              border: `1px solid ${orchid.borderColor}`,
            }}
          >
            ← Previous
          </button>
          {step < total - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
              style={{ background: orchid.accentColor, color: "#0d1117" }}
            >
              Next Step →
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200"
              style={{ background: orchid.accentColor, color: "#0d1117" }}
            >
              ✓ Done
            </button>
          )}
        </div>

        {/* Tips & Warning */}
        {fertilizer.tips && (
          <div
            className="p-3 mt-3 text-xs rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            <span
              className="font-semibold"
              style={{ color: orchid.accentColor }}
            >
              💡 Tip:{" "}
            </span>
            <span className="opacity-70" style={{ color: orchid.textColor }}>
              {fertilizer.tips}
            </span>
          </div>
        )}
        {fertilizer.warning && (
          <div
            className="p-3 mt-2 text-xs rounded-xl"
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <span className="text-red-400">{fertilizer.warning}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FertilizerCard({ fertilizer, orchid }) {
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div
        className="overflow-hidden transition-all duration-300 rounded-2xl"
        style={{
          background: expanded
            ? `${orchid.glowColor}`
            : "rgba(255,255,255,0.03)",
          border: `1px solid ${expanded ? orchid.borderColor : "rgba(255,255,255,0.08)"}`,
        }}
      >
        {/* Card header */}
        <button
          className="flex items-start w-full gap-3 p-4 text-left"
          onClick={() => setExpanded((e) => !e)}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
            style={{
              background: `${orchid.glowColor}`,
              border: `1px solid ${orchid.borderColor}`,
            }}
          >
            {fertilizer.phaseIcon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: orchid.textColor }}
              >
                {fertilizer.name}
              </p>
              <span
                className="flex-shrink-0 text-xs transition-transform duration-300 opacity-50"
                style={{
                  color: orchid.textColor,
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                ▾
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <NPKBadge npk={fertilizer.npk} accentColor={orchid.accentColor} />
              <span
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: `${orchid.glowColor}`,
                  color: orchid.accentColor,
                  border: `1px solid ${orchid.borderColor}`,
                }}
              >
                {fertilizer.phase}
              </span>
            </div>
          </div>
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="px-4 pb-4 space-y-3">
            <p
              className="text-xs leading-relaxed opacity-70"
              style={{ color: orchid.textColor }}
            >
              {fertilizer.description}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div
                className="p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <p
                  className="text-[10px] tracking-wider uppercase opacity-50 mb-1"
                  style={{ color: orchid.textColor }}
                >
                  Frequency
                </p>
                <p
                  className="text-xs font-medium"
                  style={{ color: orchid.textColor }}
                >
                  {fertilizer.frequency}
                </p>
              </div>
              <div
                className="p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                <p
                  className="text-[10px] tracking-wider uppercase opacity-50 mb-1"
                  style={{ color: orchid.textColor }}
                >
                  Dosage
                </p>
                <p
                  className="text-xs font-medium"
                  style={{ color: orchid.textColor }}
                >
                  {fertilizer.dosage}
                </p>
              </div>
            </div>

            {fertilizer.warning && (
              <div
                className="p-3 text-xs rounded-xl"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <span className="text-red-400">{fertilizer.warning}</span>
              </div>
            )}

            <button
              onClick={() => setShowModal(true)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
              style={{ background: orchid.accentColor, color: "#0d1117" }}
            >
              📋 How To Use — Step by Step
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <HowToUseModal
          fertilizer={fertilizer}
          orchid={orchid}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
// Props:
//   classificationLabel  – the raw label string from top_predictions[0].label
//                          e.g. "phalaenopsis", "Vanda", "cattleya_alliance"
//   confidence           – number 0-1 from top_predictions[0].confidence
//   onBack               – optional callback to go back to ResultPanel

export default function FertilizerPage({
  classificationLabel = "phalaenopsis",
  confidence,
  onBack,
}) {
  // Normalise label: lowercase + strip anything after underscore (e.g. "cattleya_alliance" → "cattleya")
  const normalised = classificationLabel.toLowerCase().split("_")[0];
  const orchid = FERTILIZER_DATA[normalised] ?? FERTILIZER_DATA["phalaenopsis"];

  return (
    <div
      className="w-full min-h-screen"
      style={{
        background: "#080c10",
        fontFamily: '"DM Sans", system-ui, sans-serif',
      }}
    >
      {/* Ambient top glow matching species color */}
      <div
        className="fixed top-0 left-0 right-0 z-0 h-56 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${orchid.glowColor} 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 max-w-lg px-4 pb-12 mx-auto">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 pt-6 pb-5">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center justify-center text-sm transition-all w-9 h-9 rounded-xl hover:opacity-80 active:scale-95"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#9ca3af",
              }}
            >
              ←
            </button>
          )}
          <div>
            <p
              className="text-[10px] tracking-widest uppercase font-semibold"
              style={{ color: orchid.dimText }}
            >
              Fertilizer Guide
            </p>
            <h1
              className="text-xl font-bold leading-tight"
              style={{ color: orchid.textColor }}
            >
              {orchid.emoji} {orchid.commonName}
            </h1>
          </div>
        </div>

        {/* ── Classification result banner ── */}
        <div
          className="flex items-center gap-4 p-4 mb-5 rounded-2xl"
          style={{
            background: orchid.glowColor,
            border: `1px solid ${orchid.borderColor}`,
          }}
        >
          <div
            className="flex items-center justify-center flex-shrink-0 w-12 h-12 text-2xl rounded-2xl"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: `1px solid ${orchid.borderColor}`,
            }}
          >
            {orchid.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] tracking-widest uppercase opacity-50"
              style={{ color: orchid.textColor }}
            >
              Identified Species
            </p>
            <p
              className="text-lg font-bold leading-tight capitalize"
              style={{ color: orchid.textColor }}
            >
              {orchid.commonName}
            </p>
            {confidence !== undefined && (
              <div className="flex items-center gap-2 mt-1.5">
                <div
                  className="flex-1 h-1 overflow-hidden rounded-full"
                  style={{ background: "rgba(255,255,255,0.1)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(confidence * 100)}%`,
                      background: `linear-gradient(to right, ${orchid.dimText}, ${orchid.accentColor})`,
                    }}
                  />
                </div>
                <span
                  className="text-xs font-semibold tabular-nums"
                  style={{ color: orchid.accentColor }}
                >
                  {Math.round(confidence * 100)}%
                </span>
              </div>
            )}
          </div>
          <div
            className="flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide"
            style={{ background: orchid.accentColor, color: "#0d1117" }}
          >
            {orchid.fertilizers.length} rec.
          </div>
        </div>

        {/* ── NPK legend ── */}
        <div
          className="rounded-xl px-4 py-2.5 mb-5 grid grid-cols-3 gap-2 text-center"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {[
            {
              letter: "N",
              label: "Nitrogen",
              sub: "Leaves & roots",
              color: "#4ade80",
            },
            {
              letter: "P",
              label: "Phosphorus",
              sub: "Blooms",
              color: "#60a5fa",
            },
            {
              letter: "K",
              label: "Potassium",
              sub: "Strength",
              color: "#f97316",
            },
          ].map(({ letter, label, sub, color }) => (
            <div key={letter}>
              <div className="text-base font-black" style={{ color }}>
                {letter}
              </div>
              <div className="text-[10px] font-semibold" style={{ color }}>
                {label}
              </div>
              <div className="text-[9px] opacity-50 text-white">{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Fertilizer cards ── */}
        <div className="space-y-3">
          <p className="text-[10px] tracking-widest uppercase opacity-40 text-white px-1">
            Recommended Fertilizers · {orchid.fertilizers.length} total
          </p>
          {orchid.fertilizers.map((f) => (
            <FertilizerCard key={f.id} fertilizer={f} orchid={orchid} />
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="mt-10 text-center">
          <p className="text-[10px] opacity-20 text-white">
            EfficientNetB0 · ONNX Runtime · Orchid Classifier v1
          </p>
        </div>
      </div>
    </div>
  );
}
