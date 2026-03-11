import React, { useState } from 'react';

const roleBadge = {
  admin: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  researcher: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  operator: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  viewer: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
};

const AuthRolePanel = ({ user, role, authLoading, authError, onLogin, onLogout }) => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [pending, setPending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setPending(true);
    try {
      await onLogin?.(form);
      setForm((prev) => ({ ...prev, password: '' }));
    } finally {
      setPending(false);
    }
  };

  const logout = async () => {
    setPending(true);
    try {
      await onLogout?.();
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="panel space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="module-title">User Access</h2>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${roleBadge[role] || roleBadge.viewer}`}>
          {role}
        </span>
      </div>

      {authLoading ? (
        <p className="text-sm text-subtle">Checking authentication...</p>
      ) : user ? (
        <div className="dashboard-card p-3 text-sm">
          <p className="font-semibold text-dark">{user.email || user.uid}</p>
          <p className="text-xs text-subtle">Role: {role}</p>
          <button type="button" className="btn-soft mt-2 rounded-xl px-2 py-1 text-xs" disabled={pending} onClick={logout}>
            Sign out
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <input
            className="input-shell rounded-xl px-3 py-2 text-sm"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <input
            className="input-shell rounded-xl px-3 py-2 text-sm"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          />
          <button type="submit" className="btn-primary w-full" disabled={pending}>
            Sign in
          </button>
        </form>
      )}

      {authError && <p className="text-xs text-rose-500">{authError}</p>}
    </section>
  );
};

export default AuthRolePanel;
