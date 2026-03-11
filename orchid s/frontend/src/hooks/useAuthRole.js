import { useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { onValue, ref } from 'firebase/database';
import { auth, db } from '../lib/firebase';
import { ROLE_CAPABILITIES } from '../lib/monitorConfig';

const normalizeRole = (value) => {
  const role = String(value ?? '').trim().toLowerCase();
  if (['admin', 'researcher', 'operator'].includes(role)) return role;
  return 'viewer';
};

export const useAuthRole = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('viewer');
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let unRole = null;

    const unAuth = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
      setAuthError('');

      if (unRole) {
        unRole();
        unRole = null;
      }

      if (!nextUser) {
        setRole('viewer');
        return;
      }

      const roleRef = ref(db, `users/${nextUser.uid}/role`);
      unRole = onValue(roleRef, (snapshot) => {
        setRole(normalizeRole(snapshot.val()));
      });
    });

    return () => {
      unAuth();
      if (unRole) unRole();
    };
  }, []);

  const capabilities = useMemo(
    () => ROLE_CAPABILITIES[role] ?? ROLE_CAPABILITIES.viewer,
    [role]
  );

  const login = async ({ email, password }) => {
    setAuthError('');
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    setAuthError('');
    await signOut(auth);
  };

  return {
    user,
    role,
    capabilities,
    authLoading,
    authError,
    setAuthError,
    login,
    logout,
  };
};
