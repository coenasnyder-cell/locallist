import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { app } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Force-refresh the auth token when the app returns to the foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        const auth = getAuth(app);
        if (auth.currentUser) {
          auth.currentUser.reload().catch(() => {
            // If reload fails (e.g. account deleted/disabled), sign out
            auth.signOut();
          });
        }
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  return { user, loading };
}
