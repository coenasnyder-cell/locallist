import { useRouter } from 'expo-router';
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import ContactUsComp from "../../components/contactuscomp";

export default function ContactUsScreen() {
  const router = useRouter();

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('./support-hub');
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Text style={styles.backButtonText}>Back to Support Hub</Text>
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
    alignSelf: 'center',
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
