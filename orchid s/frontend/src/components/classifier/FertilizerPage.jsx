import React, { useState } from "react";

const FERTILIZER_DATA = {
  vanda: {
    commonName: "Vanda Orchid",
    emoji: "🌺",
    accentColor: "#c084fc",
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
          "Vandas are heavy feeders with extensive aerial root systems. A high-nitrogen formula promotes vigorous leaf and root growth during the active growing season (spring-summer).",
        frequency: "Weekly (weak solution) or every 2 weeks (full strength)",
        dosage: "1/2 tsp per gallon of water",
        howToUse: [
          "Dissolve fertilizer completely in room-temperature water.",
          "Water the plant first to avoid fertilizer burn on dry roots.",
          "Apply the solution by pouring or misting over the entire root system and leaves.",
          "Allow excess to drain freely because Vandas dislike standing water.",
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
          "Switch to a high-phosphorus blend 6-8 weeks before expected blooming to encourage spike initiation and vibrant flowers.",
        frequency: "Every 2 weeks during pre-bloom",
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Begin application when the plant shows signs of a new growth spike.",
          "Mix with lukewarm water and apply to roots and growing media.",
          "Reduce nitrogen sources during this period to avoid pushing foliage at the expense of blooms.",
          "Continue until buds are fully formed, then return to balanced feeding.",
        ],
        tips: "Pair with cooler night temperatures (15-18 C) to trigger spiking.",
        warning: null,
      },
    ],
  },

  oncidium: {
    commonName: "Oncidium Orchid",
    emoji: "💛",
    accentColor: "#facc15",
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
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Mix thoroughly in clean water.",
          "Water plant thoroughly first, then apply the diluted fertilizer.",
          "Drench the potting medium (bark or moss) until it runs out the drainage holes.",
          "Skip fertilizing when the plant is dormant and no new growth is present.",
          "Rinse roots monthly with plain water to leach accumulated salts.",
        ],
        tips: "If growing in bark, slightly increase nitrogen as bark decomposition consumes nitrogen.",
        warning: null,
      },
      {
        id: "o2",
        name: "Low-Nitrogen Bloom Enhancer",
        npk: "10-30-20",
        phase: "Pre-bloom (6-8 weeks before spike)",
        phaseIcon: "🌼",
        description:
          "Boost phosphorus and potassium before expected flowering to increase spike count and extend bloom duration. Oncidiums can produce many branches of flowers.",
        frequency: "Weekly during spike development",
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Identify early spike emergence from the base of a mature pseudobulb.",
          "Switch to this formula immediately upon spike detection.",
          "Apply to roots and media; avoid direct spray on developing buds.",
          "Return to balanced feed once flowers open fully.",
        ],
        tips: "Reduce watering slightly to stress-trigger blooming and keep pseudobulbs firm.",
        warning: null,
      },
    ],
  },

  phalaenopsis: {
    commonName: "Phalaenopsis (Moth Orchid)",
    emoji: "🦋",
    accentColor: "#86efac",
    glowColor: "rgba(134,239,172,0.12)",
    borderColor: "rgba(134,239,172,0.22)",
    textColor: "#dcfce7",
    dimText: "#4ade80",
    fertilizers: [
      {
        id: "p1",
        name: "Urea-Free Orchid Formula",
        npk: "20-20-20 (urea-free)",
        phase: "Active Growth (spring-summer)",
        phaseIcon: "🌿",
        description:
          "Phalaenopsis roots absorb nutrients best from urea-free formulas. Indoor light conditions limit photosynthesis, so a gentle balanced feed sustains healthy foliage without salt stress.",
        frequency: "Every 2-3 weeks",
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Always water with plain water before fertilizing to protect roots.",
          "Pour diluted solution over the bark mix until it drains freely.",
          "Never fertilize a stressed, dehydrated, or recently repotted plant.",
          "Flush the pot with plain water once a month.",
          "Avoid getting fertilizer on leaves to prevent spotting.",
        ],
        tips: '"Feed weakly, weekly" is the golden rule for Phals. Less is always more.',
        warning: "Do not fertilize when the plant is in full bloom because it can shorten flower life.",
      },
      {
        id: "p2",
        name: "Potassium-Rich Spike Trigger",
        npk: "10-10-30",
        phase: "Post-bloom Rest & Spike Induction",
        phaseIcon: "🎋",
        description:
          "After blooms drop, a high-potassium feed combined with cool nights (15-17 C) helps trigger new spike formation from the nodes of the old spike.",
        frequency: "Monthly during rest period",
        dosage: "1/8 tsp per gallon of water (very dilute)",
        howToUse: [
          "Cut the old spike above the 2nd or 3rd node after flowers fall.",
          "Apply this diluted solution once a month for 2-3 months.",
          "Place plant near a window with a cooler night temperature differential.",
          "Once a new spike is visible, return to balanced urea-free feed.",
        ],
        tips: "A temperature drop of 8-10 C between day and night is often more effective than fertilizer alone.",
        warning: null,
      },
    ],
  },

  cattleya: {
    commonName: "Cattleya Orchid",
    emoji: "👑",
    accentColor: "#f9a8d4",
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
        frequency: "Every 10-14 days",
        dosage: "1/2 tsp per gallon of water",
        howToUse: [
          "Apply at the start of new growth emergence from the base of existing pseudobulbs.",
          "Water thoroughly before applying fertilizer.",
          "Drench the coarse bark or rock medium because Cattleyas prefer excellent drainage.",
          "Alternate with plain water every other watering.",
          "Stop high-nitrogen feeding once the new pseudobulb reaches full size.",
        ],
        tips: "Strong pseudobulbs usually lead to larger, more fragrant blooms.",
        warning: null,
      },
      {
        id: "c2",
        name: "Balanced Summer Maintenance Feed",
        npk: "20-20-20",
        phase: "Mid-season (summer)",
        phaseIcon: "☀️",
        description:
          "Transition to a balanced formula mid-season as the pseudobulb matures. This supports the whole plant without overstimulating foliage at the expense of bud formation.",
        frequency: "Every 2 weeks",
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Continue until the sheath becomes visible.",
          "Apply to roots and media; avoid the sheath to reduce rot risk.",
          "Reduce watering frequency slightly in August to harden pseudobulbs.",
        ],
        tips: "Good airflow around sheaths helps prevent bud blast.",
        warning: null,
      },
      {
        id: "c3",
        name: "Bloom Booster",
        npk: "10-30-20",
        phase: "Pre-bloom / Sheath stage",
        phaseIcon: "🌺",
        description:
          "Shift to high phosphorus once buds are developing inside the sheath to maximise petal count, size, and fragrance.",
        frequency: "Every 2 weeks until flowers open",
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Switch as soon as buds swell visibly inside the sheath.",
          "Apply carefully and keep fertilizer away from opening buds.",
          "Stop fertilizing once flowers are fully open.",
          "Resume balanced feeding for remaining pseudobulbs after blooming.",
        ],
        tips: "Avoid drafts and excess humidity to extend the bloom display.",
        warning: null,
      },
    ],
  },

  dendrobium: {
    commonName: "Dendrobium Orchid",
    emoji: "🎍",
    accentColor: "#67e8f9",
    glowColor: "rgba(103,232,249,0.12)",
    borderColor: "rgba(103,232,249,0.22)",
    textColor: "#cffafe",
    dimText: "#22d3ee",
    fertilizers: [
      {
        id: "d1",
        name: "High-Nitrogen Cane Builder",
        npk: "30-10-10",
        phase: "Active Cane Growth (spring-summer)",
        phaseIcon: "🎋",
        description:
          "Dendrobiums form tall canes that must fully mature before the plant can bloom. A nitrogen-rich feed in spring and summer drives vigorous cane development.",
        frequency: "Every 2 weeks",
        dosage: "1/2 tsp per gallon of water",
        howToUse: [
          "Begin feeding when new cane growth is 5-8 cm tall.",
          "Apply to the potting medium, avoiding the growing tip.",
          "Ensure excellent drainage because Dendrobium roots are prone to rot.",
          "Continue until canes reach full height, usually by late summer.",
        ],
        tips: "Taller, thicker canes often produce more and longer-lasting flower spikes.",
        warning: null,
      },
      {
        id: "d2",
        name: "Rest-Period Potassium Hardener",
        npk: "6-6-30",
        phase: "Autumn Rest / Cane Hardening",
        phaseIcon: "🍂",
        description:
          "Deciduous and semi-deciduous Dendrobiums need a dry, cool rest. A final high-potassium feed hardens canes and primes nodes for spring flowering.",
        frequency: "Once (single application) in early autumn",
        dosage: "1/2 tsp per gallon of water",
        howToUse: [
          "Apply this as the last fertilizer of the season when new growth has stopped.",
          "Reduce watering dramatically after application and keep the plant nearly dry through winter.",
          "Move to a cooler location (10-15 C nights) to simulate the dry season.",
          "Resume watering and balanced feeding only when new buds break in spring.",
        ],
        tips: "Resisting the urge to water or feed during dormancy is often what unlocks flowering.",
        warning: "Over-feeding in autumn can prevent dormancy and reduce or eliminate flowering that season.",
      },
      {
        id: "d3",
        name: "Spring Bloom Activator",
        npk: "10-30-20",
        phase: "Post-dormancy / Bud Break",
        phaseIcon: "🌸",
        description:
          "As dormancy ends and flower buds swell along the canes, resume feeding with a phosphorus-rich formula to support the bloom display.",
        frequency: "Every 2 weeks once buds are visible",
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Resume watering gradually as buds appear on old canes.",
          "Apply dilute solution because roots are sensitive after winter dry-out.",
          "Do not let water sit in the crown or between canes.",
          "Continue until all flowers open, then switch back to growth formula for new canes.",
        ],
        tips: "Old leafless canes can still flower, so do not remove them too early.",
        warning: null,
      },
    ],
  },
};

function NPKBadge({ npk }) {
  const parts = npk.split("-").slice(0, 3);
  const labels = ["N", "P", "K"];
  const colors = ["#4ade80", "#60a5fa", "#f97316"];

  return (
    <div className="flex items-center gap-1.5">
      {parts.map((value, index) => (
        <div key={index} className="flex flex-col items-center">
          <span className="text-[10px] font-bold leading-none" style={{ color: colors[index] }}>
            {labels[index]}
          </span>
          <span className="font-mono text-sm font-semibold leading-tight" style={{ color: colors[index] }}>
            {value.replace(/[^0-9]/g, "")}
          </span>
        </div>
      ))}
      <span className="mb-0.5 ml-1 self-end font-mono text-[10px] opacity-50">
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
        className="relative w-full max-w-md rounded-3xl p-6"
        style={{
          background: "#0d1117",
          border: `1px solid ${orchid.borderColor}`,
          boxShadow: `0 0 60px ${orchid.glowColor}`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: orchid.dimText }}>
              How To Use
            </p>
            <h3 className="mt-0.5 text-lg font-semibold" style={{ color: orchid.textColor }}>
              {fertilizer.name}
            </h3>
            <p className="mt-0.5 text-xs opacity-60" style={{ color: orchid.textColor }}>
              NPK {fertilizer.npk} · {fertilizer.phase}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-lg opacity-50 transition-opacity hover:opacity-100"
          >
            ×
          </button>
        </div>

        <div className="mb-5 flex gap-1">
          {fertilizer.howToUse.map((_, index) => (
            <div
              key={index}
              className="h-1 flex-1 cursor-pointer rounded-full transition-all duration-300"
              style={{
                background: index <= step ? orchid.accentColor : "rgba(255,255,255,0.1)",
                opacity: index === step ? 1 : index < step ? 0.6 : 0.3,
              }}
              onClick={() => setStep(index)}
            />
          ))}
        </div>

        <div
          className="mb-4 flex min-h-[100px] flex-col justify-between rounded-2xl p-5"
          style={{
            background: orchid.glowColor,
            border: `1px solid ${orchid.borderColor}`,
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: orchid.accentColor, color: "#0d1117" }}
            >
              {step + 1}
            </div>
            <span className="text-xs opacity-50" style={{ color: orchid.textColor }}>
              Step {step + 1} of {total}
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: orchid.textColor }}>
            {fertilizer.howToUse[step]}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            disabled={step === 0}
            onClick={() => setStep((current) => current - 1)}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-25"
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
              onClick={() => setStep((current) => current + 1)}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200"
              style={{ background: orchid.accentColor, color: "#0d1117" }}
            >
              Next Step →
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200"
              style={{ background: orchid.accentColor, color: "#0d1117" }}
            >
              ✓ Done
            </button>
          )}
        </div>

        {fertilizer.tips ? (
          <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs">
            <span className="font-semibold" style={{ color: orchid.accentColor }}>
              Tip:{" "}
            </span>
            <span className="opacity-70" style={{ color: orchid.textColor }}>
              {fertilizer.tips}
            </span>
          </div>
        ) : null}

        {fertilizer.warning ? (
          <div
            className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400"
          >
            {fertilizer.warning}
          </div>
        ) : null}
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
        className="overflow-hidden rounded-2xl transition-all duration-300"
        style={{
          background: expanded ? orchid.glowColor : "rgba(255,255,255,0.03)",
          border: `1px solid ${expanded ? orchid.borderColor : "rgba(255,255,255,0.08)"}`,
        }}
      >
        <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setExpanded((value) => !value)}>
          <div
            className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg"
            style={{
              background: orchid.glowColor,
              border: `1px solid ${orchid.borderColor}`,
            }}
          >
            {fertilizer.phaseIcon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold" style={{ color: orchid.textColor }}>
                {fertilizer.name}
              </p>
              <span
                className="flex-shrink-0 text-xs opacity-50 transition-transform duration-300"
                style={{
                  color: orchid.textColor,
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                ▾
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <NPKBadge npk={fertilizer.npk} />
              <span
                className="rounded-full px-2 py-0.5 text-[10px]"
                style={{
                  background: orchid.glowColor,
                  color: orchid.accentColor,
                  border: `1px solid ${orchid.borderColor}`,
                }}
              >
                {fertilizer.phase}
              </span>
            </div>
          </div>
        </button>

        {expanded ? (
          <div className="space-y-3 px-4 pb-4">
            <p className="text-xs leading-relaxed opacity-70" style={{ color: orchid.textColor }}>
              {fertilizer.description}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-wider opacity-50" style={{ color: orchid.textColor }}>
                  Frequency
                </p>
                <p className="text-xs font-medium" style={{ color: orchid.textColor }}>
                  {fertilizer.frequency}
                </p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="mb-1 text-[10px] uppercase tracking-wider opacity-50" style={{ color: orchid.textColor }}>
                  Dosage
                </p>
                <p className="text-xs font-medium" style={{ color: orchid.textColor }}>
                  {fertilizer.dosage}
                </p>
              </div>
            </div>

            {fertilizer.warning ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
                {fertilizer.warning}
              </div>
            ) : null}

            <button
              onClick={() => setShowModal(true)}
              className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-95"
              style={{ background: orchid.accentColor, color: "#0d1117" }}
            >
              Step-by-Step Usage Guide
            </button>
          </div>
        ) : null}
      </div>

      {showModal ? (
        <HowToUseModal fertilizer={fertilizer} orchid={orchid} onClose={() => setShowModal(false)} />
      ) : null}
    </>
  );
}

export default function FertilizerPage({
  classificationLabel = "phalaenopsis",
  confidence,
  onBack,
  embedded = false,
}) {
  const normalised = classificationLabel.toLowerCase().split("_")[0];
  const orchid = FERTILIZER_DATA[normalised] ?? FERTILIZER_DATA.phalaenopsis;

  return (
    <div
      className={embedded ? "w-full" : "min-h-screen w-full"}
      style={{
        background: embedded ? "transparent" : "#080c10",
        fontFamily: '"DM Sans", system-ui, sans-serif',
      }}
    >
      {!embedded ? (
        <div
          className="pointer-events-none fixed left-0 right-0 top-0 z-0 h-56"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${orchid.glowColor} 0%, transparent 70%)`,
          }}
        />
      ) : null}

      <div className={`relative z-10 mx-auto max-w-lg ${embedded ? "px-0 pb-0 pt-0" : "px-4 pb-12"}`}>
        <div className={`flex items-center gap-3 ${embedded ? "pb-5" : "pb-5 pt-6"}`}>
          {onBack ? (
            <button
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm transition-all hover:opacity-80 active:scale-95"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#9ca3af",
              }}
            >
              ←
            </button>
          ) : null}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: orchid.dimText }}>
              Fertilizer Guide
            </p>
            <h1 className="text-xl font-bold leading-tight" style={{ color: orchid.textColor }}>
              {orchid.emoji} {orchid.commonName}
            </h1>
          </div>
        </div>

        <div
          className="mb-5 flex items-center gap-4 rounded-2xl p-4"
          style={{
            background: orchid.glowColor,
            border: `1px solid ${orchid.borderColor}`,
          }}
        >
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{
              background: "rgba(0,0,0,0.3)",
              border: `1px solid ${orchid.borderColor}`,
            }}
          >
            {orchid.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest opacity-50" style={{ color: orchid.textColor }}>
              Identified Species
            </p>
            <p className="text-lg font-bold capitalize leading-tight" style={{ color: orchid.textColor }}>
              {orchid.commonName}
            </p>
            {confidence !== undefined ? (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round(confidence * 100)}%`,
                      background: `linear-gradient(to right, ${orchid.dimText}, ${orchid.accentColor})`,
                    }}
                  />
                </div>
                <span className="tabular-nums text-xs font-semibold" style={{ color: orchid.accentColor }}>
                  {Math.round(confidence * 100)}%
                </span>
              </div>
            ) : null}
          </div>
          <div
            className="flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide"
            style={{ background: orchid.accentColor, color: "#0d1117" }}
          >
            {orchid.fertilizers.length} rec.
          </div>
        </div>

        <div
          className="mb-5 grid grid-cols-3 gap-2 rounded-xl px-4 py-2.5 text-center"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {[
            { letter: "N", label: "Nitrogen", sub: "Leaves & roots", color: "#4ade80" },
            { letter: "P", label: "Phosphorus", sub: "Blooms", color: "#60a5fa" },
            { letter: "K", label: "Potassium", sub: "Strength", color: "#f97316" },
          ].map(({ letter, label, sub, color }) => (
            <div key={letter}>
              <div className="text-base font-black" style={{ color }}>
                {letter}
              </div>
              <div className="text-[10px] font-semibold" style={{ color }}>
                {label}
              </div>
              <div className="text-[9px] text-white opacity-50">{sub}</div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="px-1 text-[10px] uppercase tracking-widest text-white opacity-40">
            Recommended Fertilizers · {orchid.fertilizers.length} total
          </p>
          {orchid.fertilizers.map((fertilizer) => (
            <FertilizerCard key={fertilizer.id} fertilizer={fertilizer} orchid={orchid} />
          ))}
        </div>

        <div className={`${embedded ? "mt-8" : "mt-10"} text-center`}>
          <p className="text-[10px] text-white opacity-20">EfficientNetB0 · ONNX Runtime · Orchid Classifier v1</p>
        </div>
      </div>
    </div>
  );
}
