import React, { useEffect, useMemo, useState } from 'react';
import { METRIC_DEFINITIONS } from '../../lib/monitorConfig';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const ThresholdSettingsPanel = ({
  thresholds,
  onSave,
  canEdit,
  emailSettings,
  onSaveEmail,
}) => {
  const [draft, setDraft] = useState(() => thresholds?.metrics ?? {});
  const [emailDraft, setEmailDraft] = useState(() => ({
    emailEnabled: Boolean(emailSettings?.emailEnabled),
    emailRecipients: emailSettings?.emailRecipients ?? '',
  }));

  const metricEntries = useMemo(
    () => Object.entries(METRIC_DEFINITIONS),
    []
  );

  useEffect(() => {
    setDraft(thresholds?.metrics ?? {});
  }, [thresholds]);

  useEffect(() => {
    setEmailDraft({
      emailEnabled: Boolean(emailSettings?.emailEnabled),
      emailRecipients: emailSettings?.emailRecipients ?? '',
    });
  }, [emailSettings]);

  const handleMetricChange = (key, field, value) => {
    setDraft((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? {}),
        [field]: value,
      },
    }));
  };

  const saveThresholds = async () => {
    const normalized = Object.fromEntries(
      metricEntries.map(([key]) => {
        const min = toNumber(draft?.[key]?.min);
        const max = toNumber(draft?.[key]?.max);
        return [key, {
          min: min ?? thresholds?.metrics?.[key]?.min ?? 0,
          max: max ?? thresholds?.metrics?.[key]?.max ?? 0,
        }];
      })
    );

    await onSave?.({ metrics: normalized });
  };

  const saveEmail = async () => {
    await onSaveEmail?.({
      emailEnabled: Boolean(emailDraft.emailEnabled),
      emailRecipients: emailDraft.emailRecipients,
    });
  };

  return (
    <section className="panel space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="module-title">Threshold & Alert Settings</h2>
        <span className="text-xs text-subtle">Stored in Firebase</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {metricEntries.map(([key, metric]) => (
          <div key={key} className="dashboard-card p-3">
            <p className="mb-2 text-sm font-semibold text-dark">{metric.label}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="space-y-1">
                <span className="text-subtle">Min</span>
                <input
                  className="input-shell rounded-xl px-2 py-1.5 text-xs"
                  value={draft?.[key]?.min ?? ''}
                  disabled={!canEdit}
                  onChange={(event) => handleMetricChange(key, 'min', event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-subtle">Max</span>
                <input
                  className="input-shell rounded-xl px-2 py-1.5 text-xs"
                  value={draft?.[key]?.max ?? ''}
                  disabled={!canEdit}
                  onChange={(event) => handleMetricChange(key, 'max', event.target.value)}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-card p-3">
        <h3 className="mb-2 text-sm font-semibold text-dark">Email Notifications</h3>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2 text-subtle">
            <input
              type="checkbox"
              checked={emailDraft.emailEnabled}
              disabled={!canEdit}
              onChange={(event) => setEmailDraft((prev) => ({ ...prev, emailEnabled: event.target.checked }))}
            />
            Enable email notifications for warning/critical alerts
          </label>
          <input
            className="input-shell rounded-xl px-3 py-2 text-sm"
            placeholder="alert1@example.com, alert2@example.com"
            disabled={!canEdit}
            value={emailDraft.emailRecipients}
            onChange={(event) => setEmailDraft((prev) => ({ ...prev, emailRecipients: event.target.value }))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" disabled={!canEdit} onClick={saveThresholds}>
          Save thresholds
        </button>
        <button type="button" className="btn-soft" disabled={!canEdit} onClick={saveEmail}>
          Save email settings
        </button>
        {!canEdit && <p className="text-xs text-subtle">Only Admin can change threshold settings.</p>}
      </div>
    </section>
  );
};

export default ThresholdSettingsPanel;
