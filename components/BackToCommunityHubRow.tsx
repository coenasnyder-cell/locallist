import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type BackToCommunityHubRowProps = {
  fallbackRoute?: string;
};

export default function BackToCommunityHubRow({ fallbackRoute }: BackToCommunityHubRowProps) {
  const router = useRouter();

  const handlePress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    if (fallbackRoute) {
      router.replace(fallbackRoute as any);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Text style={styles.backText}>{'< Back'}</Text>
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