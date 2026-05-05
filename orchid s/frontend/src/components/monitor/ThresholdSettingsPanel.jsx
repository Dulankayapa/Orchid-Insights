import React, { useEffect, useMemo, useState } from 'react';
import { METRIC_DEFINITIONS } from '../../lib/monitorConfig';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const splitEmails = (value) => (
  String(value ?? '')
    .split(/[,\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
);

const normalizeEmails = (value) => {
  const unique = [];
  const seen = new Set();
  splitEmails(value).forEach((email) => {
    const key = email.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(email);
  });
  return unique;
};

const joinEmails = (emails) => emails.join(', ');

const ThresholdSettingsPanel = ({
  thresholds,
  onSave,
  canEdit,
  emailSettings,
  onSaveEmail,
  metricKeys,
  hideMetrics = false,
  title = 'Threshold & Alert Settings',
}) => {
  const [draft, setDraft] = useState(() => thresholds?.metrics ?? {});
  const [emailDraft, setEmailDraft] = useState(() => ({
    emailEnabled: Boolean(emailSettings?.emailEnabled),
    emailRecipients: emailSettings?.emailRecipients ?? '',
  }));
  const [emailInput, setEmailInput] = useState('');
  const [emailInputError, setEmailInputError] = useState('');

  const metricEntries = useMemo(() => {
    const keys = Array.isArray(metricKeys) && metricKeys.length
      ? metricKeys
      : Object.keys(METRIC_DEFINITIONS);

    return keys
      .map((key) => [key, METRIC_DEFINITIONS[key]])
      .filter(([, metric]) => Boolean(metric));
  }, [metricKeys]);

  useEffect(() => {
    setDraft(thresholds?.metrics ?? {});
  }, [thresholds]);

  useEffect(() => {
    setEmailDraft({
      emailEnabled: Boolean(emailSettings?.emailEnabled),
      emailRecipients: emailSettings?.emailRecipients ?? '',
    });
    setEmailInput('');
    setEmailInputError('');
  }, [emailSettings]);

  const recipientList = useMemo(
    () => normalizeEmails(emailDraft.emailRecipients),
    [emailDraft.emailRecipients]
  );

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
      emailRecipients: joinEmails(recipientList),
    });
  };

  const addRecipients = () => {
    const incoming = normalizeEmails(emailInput);
    if (!incoming.length) {
      setEmailInputError('Enter at least one email address.');
      return;
    }

    const merged = normalizeEmails([...recipientList, ...incoming].join(', '));
    setEmailDraft((prev) => ({
      ...prev,
      emailRecipients: joinEmails(merged),
    }));
    setEmailInput('');
    setEmailInputError('');
  };

  const removeRecipient = (targetEmail) => {
    const next = recipientList.filter((item) => item.toLowerCase() !== targetEmail.toLowerCase());
    setEmailDraft((prev) => ({
      ...prev,
      emailRecipients: joinEmails(next),
    }));
  };

  return (
    <section className="panel space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="module-title">{title}</h2>
        <span className="text-xs text-subtle">Stored in Firebase</span>
      </div>

      {!hideMetrics && (
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
      )}

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
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input-shell min-w-[240px] flex-1 rounded-xl px-3 py-2 text-sm"
              placeholder="Add one or many emails (comma separated)"
              disabled={!canEdit}
              value={emailInput}
              onChange={(event) => {
                setEmailInput(event.target.value);
                if (emailInputError) setEmailInputError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addRecipients();
                }
              }}
            />
            <button
              type="button"
              className="btn-soft"
              disabled={!canEdit}
              onClick={addRecipients}
            >
              Add email
            </button>
          </div>
          {emailInputError && (
            <p className="text-xs text-rose-600">{emailInputError}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {recipientList.length === 0 ? (
              <p className="text-xs text-subtle">No recipient emails added yet.</p>
            ) : recipientList.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-paper px-2 py-1 text-xs text-dark"
              >
                {email}
                {canEdit && (
                  <button
                    type="button"
                    className="text-subtle hover:text-rose-600"
                    onClick={() => removeRecipient(email)}
                    aria-label={`Remove ${email}`}
                  >
                    x
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!hideMetrics && (
          <button type="button" className="btn-primary" disabled={!canEdit} onClick={saveThresholds}>
            Save thresholds
          </button>
        )}
        <button type="button" className="btn-soft" disabled={!canEdit} onClick={saveEmail}>
          Save email settings
        </button>
        {!canEdit && <p className="text-xs text-subtle">Only Admin can change threshold settings.</p>}
      </div>
    </section>
  );
};

export default ThresholdSettingsPanel;
