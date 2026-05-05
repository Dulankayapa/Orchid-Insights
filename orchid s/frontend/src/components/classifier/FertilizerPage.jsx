import React, { useState } from "react";
import { useTheme } from "../../context/ThemeContext";

const FERTILIZER_DATA = {
  vanda: {
    commonName: "Vanda Orchid",
    emoji: "🌺",
    accentColor: "#c084fc",
    glowColor: "rgba(192,132,252,0.15)",
    borderColor: "rgba(192,132,252,0.25)",
    dimText: "#a855f7",
    fertilizers: [
      {
        id: "v1",
        name: "High-Nitrogen Growth Booster",
        npk: "30-10-10",
        phase: "Vegetative / Growing Season",
        phaseIcon: "🌱",
        description:
          "Vandas are heavy feeders with extensive aerial roots. A high-nitrogen formula supports vigorous leaf and root growth during the active growing season.",
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
          "Switch to a high-phosphorus blend 6 to 8 weeks before expected blooming to encourage spike initiation and vibrant flowers.",
        frequency: "Every 2 weeks during pre-bloom",
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Begin application when the plant shows signs of a new growth spike.",
          "Mix with lukewarm water and apply to roots and growing media.",
          "Reduce nitrogen sources during this period to avoid pushing foliage at the expense of blooms.",
          "Continue until buds are fully formed, then return to balanced feeding.",
        ],
        tips: "Pair with cooler night temperatures around 15 to 18 C to help trigger spiking.",
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
    dimText: "#ca8a04",
    fertilizers: [
      {
        id: "o1",
        name: "Balanced All-Purpose Orchid Feed",
        npk: "20-20-20",
        phase: "Year-round / General Maintenance",
        phaseIcon: "🔄",
        description:
          "Oncidiums prefer steady, balanced feeding throughout the year. Mild, regular feeding usually works better than infrequent heavy doses.",
        frequency: "Every 2 weeks",
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Mix thoroughly in clean water.",
          "Water the plant first, then apply the diluted fertilizer.",
          "Drench the potting medium until it runs out of the drainage holes.",
          "Skip fertilizing when the plant is dormant and no new growth is present.",
          "Rinse roots monthly with plain water to leach accumulated salts.",
        ],
        tips: "If growing in bark, slightly increase nitrogen because bark decomposition uses some available nitrogen.",
        warning: null,
      },
      {
        id: "o2",
        name: "Low-Nitrogen Bloom Enhancer",
        npk: "10-30-20",
        phase: "Pre-bloom",
        phaseIcon: "🌼",
        description:
          "Boost phosphorus and potassium before flowering to increase spike count and support longer-lasting blooms.",
        frequency: "Weekly during spike development",
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Identify early spike emergence from the base of a mature pseudobulb.",
          "Switch to this formula immediately upon spike detection.",
          "Apply to roots and media and avoid direct spray on developing buds.",
          "Return to balanced feed once flowers open fully.",
        ],
        tips: "Keep pseudobulbs firm and reduce watering slightly if you want to help nudge blooming.",
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
    dimText: "#4ade80",
    fertilizers: [
      {
        id: "p1",
        name: "Urea-Free Orchid Formula",
        npk: "20-20-20 (urea-free)",
        phase: "Active Growth (spring-summer)",
        phaseIcon: "🌿",
        description:
          "Phalaenopsis roots absorb nutrients best from urea-free formulas. A gentle balanced feed supports healthy foliage without building salts too quickly.",
        frequency: "Every 2 to 3 weeks",
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Always water with plain water before fertilizing to protect roots.",
          "Pour diluted solution over the bark mix until it drains freely.",
          "Never fertilize a stressed, dehydrated, or recently repotted plant.",
          "Flush the pot with plain water once a month.",
          "Avoid getting fertilizer on leaves to prevent spotting.",
        ],
        tips: '"Feed weakly, weekly" is a classic Phalaenopsis rule. Less is usually more.',
        warning: "Do not fertilize during full bloom if the plant reacts poorly, because it can shorten flower life.",
      },
      {
        id: "p2",
        name: "Potassium-Rich Spike Trigger",
        npk: "10-10-30",
        phase: "Post-bloom Rest & Spike Induction",
        phaseIcon: "🎀",
        description:
          "After flowers drop, a higher-potassium feed paired with cooler nights can support the next spike cycle.",
        frequency: "Monthly during rest period",
        dosage: "1/8 tsp per gallon of water",
        howToUse: [
          "Cut the old spike above the second or third node after flowers fall.",
          "Apply this diluted solution once a month for 2 to 3 months.",
          "Place the plant near a bright window with cooler nights.",
          "Once a new spike is visible, return to balanced urea-free feed.",
        ],
        tips: "A clear day-to-night temperature drop is often more effective than fertilizer alone.",
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
    dimText: "#ec4899",
    fertilizers: [
      {
        id: "c1",
        name: "High-Nitrogen Spring Formula",
        npk: "30-10-10",
        phase: "New Growth Phase",
        phaseIcon: "🌱",
        description:
          "Cattleyas benefit from a nitrogen push while new pseudobulbs are developing in spring.",
        frequency: "Every 10 to 14 days",
        dosage: "1/2 tsp per gallon of water",
        howToUse: [
          "Apply at the start of new growth emergence.",
          "Water thoroughly before applying fertilizer.",
          "Drench the coarse bark or rock medium because Cattleyas prefer excellent drainage.",
          "Alternate with plain water every other watering.",
          "Stop high-nitrogen feeding once the new pseudobulb reaches full size.",
        ],
        tips: "Strong pseudobulbs usually support stronger flowering later.",
        warning: null,
      },
      {
        id: "c2",
        name: "Balanced Summer Maintenance Feed",
        npk: "20-20-20",
        phase: "Mid-season",
        phaseIcon: "☀️",
        description:
          "Use a balanced feed as the pseudobulb matures to support the whole plant without overstimulating foliage.",
        frequency: "Every 2 weeks",
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Continue until the sheath becomes visible.",
          "Apply to roots and media and avoid soaking the sheath.",
          "Reduce watering slightly late in the season to harden pseudobulbs.",
        ],
        tips: "Good airflow around sheaths helps prevent bud issues.",
        warning: null,
      },
      {
        id: "c3",
        name: "Bloom Booster",
        npk: "10-30-20",
        phase: "Pre-bloom / Sheath stage",
        phaseIcon: "🌺",
        description:
          "Shift to high phosphorus once buds are developing inside the sheath to support bloom size and count.",
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
    dimText: "#22d3ee",
    fertilizers: [
      {
        id: "d1",
        name: "High-Nitrogen Cane Builder",
        npk: "30-10-10",
        phase: "Active Cane Growth",
        phaseIcon: "🎋",
        description:
          "A nitrogen-rich feed in spring and summer helps Dendrobiums build stronger canes before bloom time.",
        frequency: "Every 2 weeks",
        dosage: "1/2 tsp per gallon of water",
        howToUse: [
          "Begin feeding when new cane growth is 5 to 8 cm tall.",
          "Apply to the potting medium while avoiding the growing tip.",
          "Ensure excellent drainage because Dendrobium roots dislike staying wet.",
          "Continue until canes reach full height.",
        ],
        tips: "Thicker canes often support better flowering later.",
        warning: null,
      },
      {
        id: "d2",
        name: "Rest-Period Potassium Hardener",
        npk: "6-6-30",
        phase: "Autumn Rest / Cane Hardening",
        phaseIcon: "🍂",
        description:
          "A final potassium-heavy feed can help harden canes before a cooler, drier rest period.",
        frequency: "Once in early autumn",
        dosage: "1/2 tsp per gallon of water",
        howToUse: [
          "Apply this as the last fertilizer of the season when new growth has stopped.",
          "Reduce watering dramatically after application and keep the plant nearly dry through winter.",
          "Move to a cooler location to simulate a dry season rest.",
          "Resume watering and balanced feeding only when new buds break in spring.",
        ],
        tips: "Resisting the urge to keep feeding through dormancy is often what unlocks flowering.",
        warning: "Over-feeding in autumn can reduce or prevent flowering that season.",
      },
      {
        id: "d3",
        name: "Spring Bloom Activator",
        npk: "10-30-20",
        phase: "Post-dormancy / Bud Break",
        phaseIcon: "🌸",
        description:
          "Resume feeding with a phosphorus-rich formula when flower buds swell along the canes.",
        frequency: "Every 2 weeks once buds are visible",
        dosage: "1/4 tsp per gallon of water",
        howToUse: [
          "Resume watering gradually as buds appear on old canes.",
          "Apply a dilute solution because roots can be sensitive after winter dry-out.",
          "Do not let water sit in the crown or between canes.",
          "Continue until flowers open, then switch back to the growth formula for new canes.",
        ],
        tips: "Old leafless canes can still flower, so do not remove them too early.",
        warning: null,
      },
    ],
  },
};

function createGuideTone(orchid, isDark) {
  return {
    pageBackground: isDark ? "#08110c" : "#f6fbf4",
    panelBackground: isDark ? "#122018" : "#ffffff",
    panelBorder: isDark ? "rgba(129, 193, 150, 0.22)" : "rgba(159, 211, 174, 0.42)",
    panelShadow: isDark
      ? "0 24px 48px -32px rgba(0, 0, 0, 0.65)"
      : "0 18px 36px -28px rgba(106,151,118,0.28)",
    cardBackground: isDark ? "#16281d" : "#f8fcf8",
    softBackground: isDark ? "rgba(255,255,255,0.04)" : "rgba(235, 245, 237, 0.92)",
    softBorder: isDark ? "rgba(255,255,255,0.06)" : "rgba(159, 211, 174, 0.24)",
    iconBackground: isDark ? "#203228" : "#d9e8dc",
    heading: isDark ? "#effaf1" : "#173423",
    muted: isDark ? "#a3c6ad" : "#557767",
    softText: isDark ? "#89ae94" : "#6a8a76",
    track: isDark ? "rgba(255,255,255,0.1)" : "rgba(21,64,39,0.12)",
    chipText: isDark ? "#08110c" : "#143221",
    modalBackground: isDark ? "#0d1510" : "#fcfffc",
    modalSoft: isDark ? "#132117" : "#f2f8f3",
    modalCloseBackground: isDark ? "rgba(255,255,255,0.08)" : "rgba(23,52,35,0.08)",
    modalCloseText: isDark ? "#d0e8d6" : "#345342",
  };
}

function NPKBadge({ npk, tone }) {
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
      <span className="mb-0.5 ml-1 self-end font-mono text-[10px]" style={{ color: tone.softText }}>
        {npk.includes("urea") ? "(urea-free)" : ""}
      </span>
    </div>
  );
}

function HowToUseModal({ fertilizer, orchid, tone, onClose }) {
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
          background: tone.modalBackground,
          border: `1px solid ${tone.panelBorder}`,
          boxShadow: tone.panelShadow,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: orchid.dimText }}>
              How To Use
            </p>
            <h3 className="mt-0.5 text-lg font-semibold" style={{ color: tone.heading }}>
              {fertilizer.name}
            </h3>
            <p className="mt-0.5 text-xs" style={{ color: tone.muted }}>
              NPK {fertilizer.npk} - {fertilizer.phase}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-opacity hover:opacity-100"
            style={{ background: tone.modalCloseBackground, color: tone.modalCloseText }}
          >
            x
          </button>
        </div>

        <div className="mb-5 flex gap-1">
          {fertilizer.howToUse.map((_, index) => (
            <div
              key={index}
              className="h-1 flex-1 cursor-pointer rounded-full transition-all duration-300"
              style={{
                background: index <= step ? orchid.accentColor : tone.track,
                opacity: index === step ? 1 : index < step ? 0.6 : 0.3,
              }}
              onClick={() => setStep(index)}
            />
          ))}
        </div>

        <div
          className="mb-4 flex min-h-[100px] flex-col justify-between rounded-2xl p-5"
          style={{
            background: tone.modalSoft,
            border: `1px solid ${tone.softBorder}`,
          }}
        >
          <div className="mb-3 flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: orchid.accentColor, color: tone.chipText }}
            >
              {step + 1}
            </div>
            <span className="text-xs" style={{ color: tone.softText }}>
              Step {step + 1} of {total}
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: tone.heading }}>
            {fertilizer.howToUse[step]}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            disabled={step === 0}
            onClick={() => setStep((current) => current - 1)}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-25"
            style={{
              background: tone.modalSoft,
              color: tone.heading,
              border: `1px solid ${tone.softBorder}`,
            }}
          >
            Previous
          </button>
          {step < total - 1 ? (
            <button
              onClick={() => setStep((current) => current + 1)}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200"
              style={{ background: orchid.accentColor, color: tone.chipText }}
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200"
              style={{ background: orchid.accentColor, color: tone.chipText }}
            >
              Done
            </button>
          )}
        </div>

        {fertilizer.tips ? (
          <div className="mt-3 rounded-xl p-3 text-xs" style={{ background: tone.softBackground }}>
            <span className="font-semibold" style={{ color: orchid.accentColor }}>
              Tip:{" "}
            </span>
            <span style={{ color: tone.muted }}>
              {fertilizer.tips}
            </span>
          </div>
        ) : null}

        {fertilizer.warning ? (
          <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
            {fertilizer.warning}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FertilizerCard({ fertilizer, orchid, tone }) {
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div
        className="overflow-hidden rounded-2xl transition-all duration-300"
        style={{
          background: expanded ? tone.cardBackground : tone.softBackground,
          border: `1px solid ${expanded ? tone.panelBorder : tone.softBorder}`,
        }}
      >
        <button
          className="flex w-full items-start gap-3 p-4 text-left"
          onClick={() => setExpanded((value) => !value)}
        >
          <div
            className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg"
            style={{
              background: tone.iconBackground,
              border: `1px solid ${tone.softBorder}`,
            }}
          >
            {fertilizer.phaseIcon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold" style={{ color: tone.heading }}>
                {fertilizer.name}
              </p>
              <span
                className="flex-shrink-0 text-xs transition-transform duration-300"
                style={{
                  color: tone.softText,
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                v
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <NPKBadge npk={fertilizer.npk} tone={tone} />
              <span
                className="rounded-full px-2 py-0.5 text-[10px]"
                style={{
                  background: tone.softBackground,
                  color: orchid.accentColor,
                  border: `1px solid ${tone.softBorder}`,
                }}
              >
                {fertilizer.phase}
              </span>
            </div>
          </div>
        </button>

        {expanded ? (
          <div className="space-y-3 px-4 pb-4">
            <p className="text-xs leading-relaxed" style={{ color: tone.muted }}>
              {fertilizer.description}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl p-3" style={{ background: tone.softBackground }}>
                <p className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: tone.softText }}>
                  Frequency
                </p>
                <p className="text-xs font-medium" style={{ color: tone.heading }}>
                  {fertilizer.frequency}
                </p>
              </div>
              <div className="rounded-xl p-3" style={{ background: tone.softBackground }}>
                <p className="mb-1 text-[10px] uppercase tracking-wider" style={{ color: tone.softText }}>
                  Dosage
                </p>
                <p className="text-xs font-medium" style={{ color: tone.heading }}>
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
              style={{ background: orchid.accentColor, color: tone.chipText }}
            >
              Step-by-Step Usage Guide
            </button>
          </div>
        ) : null}
      </div>

      {showModal ? (
        <HowToUseModal
          fertilizer={fertilizer}
          orchid={orchid}
          tone={tone}
          onClose={() => setShowModal(false)}
        />
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
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const normalised = classificationLabel.toLowerCase().split("_")[0];
  const orchid = FERTILIZER_DATA[normalised] ?? FERTILIZER_DATA.phalaenopsis;
  const tone = createGuideTone(orchid, isDark);

  return (
    <div
      className={embedded ? "w-full" : "min-h-screen w-full"}
      style={{
        background: embedded ? "transparent" : tone.pageBackground,
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
              className="flex h-9 items-center justify-center rounded-xl px-3 text-sm transition-all hover:opacity-80 active:scale-95"
              style={{
                background: tone.softBackground,
                border: `1px solid ${tone.softBorder}`,
                color: tone.heading,
              }}
            >
              Back
            </button>
          ) : null}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: orchid.dimText }}>
              Fertilizer Guide
            </p>
            <h1 className="text-xl font-bold leading-tight" style={{ color: tone.heading }}>
              {orchid.emoji} {orchid.commonName}
            </h1>
          </div>
        </div>

        <div
          className="mb-5 flex items-center gap-4 rounded-2xl p-4"
          style={{
            background: tone.cardBackground,
            border: `1px solid ${tone.panelBorder}`,
            boxShadow: tone.panelShadow,
          }}
        >
          <div
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-2xl"
            style={{
              background: tone.iconBackground,
              border: `1px solid ${tone.softBorder}`,
            }}
          >
            {orchid.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-widest" style={{ color: tone.softText }}>
              Identified Species
            </p>
            <p className="text-lg font-bold capitalize leading-tight" style={{ color: tone.heading }}>
              {orchid.commonName}
            </p>
            {confidence !== undefined ? (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: tone.track }}>
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
            style={{ background: orchid.accentColor, color: tone.chipText }}
          >
            {orchid.fertilizers.length} rec.
          </div>
        </div>

        <div
          className="mb-5 grid grid-cols-3 gap-2 rounded-xl px-4 py-2.5 text-center"
          style={{
            background: tone.panelBackground,
            border: `1px solid ${tone.panelBorder}`,
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
              <div className="text-[9px]" style={{ color: tone.softText }}>
                {sub}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="px-1 text-[10px] uppercase tracking-widest" style={{ color: tone.softText }}>
            Recommended Fertilizers - {orchid.fertilizers.length} total
          </p>
          {orchid.fertilizers.map((fertilizer) => (
            <FertilizerCard key={fertilizer.id} fertilizer={fertilizer} orchid={orchid} tone={tone} />
          ))}
        </div>

        <div className={`${embedded ? "mt-8" : "mt-10"} text-center`}>
          <p className="text-[10px]" style={{ color: tone.softText }}>
            EfficientNetB0 - ONNX Runtime - Orchid Classifier v1
          </p>
        </div>
      </div>
    </div>
  );
}
