import { useRouter } from 'expo-router';
import React from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ContactUsComp from "../../components/contactuscomp";
import { useAccountStatus } from '../../hooks/useAccountStatus';

export default function ContactUsScreen() {
  const router = useRouter();
  const { user } = useAccountStatus();

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(user ? '/(app)/support-hub' : '/');
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Text style={styles.backButtonText}>{user ? 'Back to Support Hub' : 'Back to Home'}</Text>
        </TouchableOpacity>
      </View>
      <ContactUsComp />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#fff',
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});