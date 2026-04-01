import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function BackToCommunityHubRow() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.push('/(tabs)/communitybutton' as any)}
        activeOpacity={0.8}
      >
        <Text style={styles.backText}>{'< Back To The Community Hub'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  backText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e3a5f',
  },
});