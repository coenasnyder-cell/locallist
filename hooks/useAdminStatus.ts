import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { app } from '../firebase';
import { resolveAdminStatus } from '../utils/adminUtils';

export function useAdminStatus() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(app);
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (!isMounted) {
        return;
      }

      setUser(authUser);
      setLoading(true);

      try {
        const nextIsAdmin = await resolveAdminStatus(authUser);
        if (isMounted) {
          setIsAdmin(nextIsAdmin);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        if (isMounted) {
          setIsAdmin(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return { user, isAdmin, loading };
}
