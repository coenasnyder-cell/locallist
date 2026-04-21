import { Redirect } from 'expo-router';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { app } from '../firebase';
import PublicLanding from './publiclanding';

export default function AppEntry() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const auth = getAuth(app);
    return onAuthStateChanged(auth, (u) => {
      setLoggedIn(!!u);
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    );
  }

  if (loggedIn) {
    return <Redirect href="./(tabs)/index" />;
  }

  return <PublicLanding />;
}
