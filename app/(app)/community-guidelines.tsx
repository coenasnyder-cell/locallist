import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CommunityDisclosures from '../../components/CommunityDisclosures';

export default function CommunityGuidelinesScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(app)/support-hub')}>
        <Text style={styles.backButtonText}>Back to Support Hub</Text>
      </TouchableOpacity>
      <View style={styles.card}>
        <CommunityDisclosures />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
  },
  backButton: {
    alignSelf: 'center',
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
  },
});