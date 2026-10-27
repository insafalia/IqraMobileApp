import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

type AuthValue = {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  notice: string;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notice, setNotice] = useState('');

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error || !data) {
      setNotice('This login is not ready. Ask the owner.');
      setProfile(null);
      await supabase.auth.signOut();
      return;
    }
    if (!data.active) {
      setNotice('This login is turned off. Ask the owner.');
      setProfile(null);
      await supabase.auth.signOut();
      return;
    }
    setNotice('');
    setProfile(data as Profile);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (!data.session) {
        setLoading(false);
        return;
      }
      loadProfile(data.session.user.id).finally(() => {
        if (alive) setLoading(false);
      });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setTimeout(() => {
        loadProfile(next.user.id).finally(() => {
          if (alive) setLoading(false);
        });
      }, 0);
    });

    return () => {
      alive = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [loadProfile, session]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({ loading, session, profile, notice, refreshProfile, signOut }),
    [loading, session, profile, notice, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
