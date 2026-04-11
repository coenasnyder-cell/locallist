import { Redirect } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAccountStatus } from '../hooks/useAccountStatus';
import PublicLanding from './publiclanding';

export default function AppEntry() {
  const { user, loading } = useAccountStatus();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#475569" />
      </View>
    );
  }

  if (user) {
    return <Redirect href={'/(tabs)/index' as any} />;
  }

  return <PublicLanding />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
