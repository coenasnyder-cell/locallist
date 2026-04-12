import { useRouter } from 'expo-router';
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function PrivacyPolicy() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
          <Text style={styles.backButton} onPress={() => router.push('/(app)/support-hub')}>Back to Support Hub</Text>
          <Text style={styles.mainTitle}>Privacy Policy</Text>

          <Text style={styles.updatedDate}>Privacy Policy Updated: 02/08/2026</Text>

          <View style={styles.contentBox}>
            <Text style={styles.introText}>
              Local List respects your privacy and is committed to protecting your information. This Privacy Policy explains what information we collect, how we use it, and how we protect it.
            </Text>

            <Text style={styles.sectionTitle}>Information We Collect</Text>
            <Text style={styles.bodyText}>
              We may collect the following information when you use Local List:
            </Text>
            <Text style={styles.bodyText}>
              • Account Information (email address, zip code, etc).{'\n'}
              • Listings and Content (photos, titles, etc).{'\n'}
              • Messages sent between buyers and sellers.{'\n'}
              • Basic usage information (viewing/creating posts).
            </Text>

            <Text style={styles.sectionTitle}>How We Use Your Information</Text>
            <Text style={styles.bodyText}>
              We use collected information to operate the marketplace, allow users to create listings and communicate, improve app features, and prevent fraud, spam, or misuse.
            </Text>
            <Text style={styles.bodyText}>
              We do not sell your personal information.
            </Text>

            <Text style={styles.sectionTitle}>Payments</Text>
            <Text style={styles.bodyText}>
              If you purchase optional features such as Featured Listings, payments may be processed by a third-party payment provider. Local List does not store full payment card details.
            </Text>

            <Text style={styles.sectionTitle}>Sharing of Information</Text>
            <Text style={styles.bodyText}>
              We may share limited information when required by law, to prevent fraud or abuse, or with service providers that help operate the app such as hosting or payment services.
            </Text>
            <Text style={styles.bodyText}>
              We do not sell or rent personal information.
            </Text>

            <Text style={styles.sectionTitle}>Data Security</Text>
            <Text style={styles.bodyText}>
              We take reasonable steps to protect your information, but no system is completely secure. Users should also protect their passwords and account access.
            </Text>

            <Text style={styles.sectionTitle}>User Content</Text>
            <Text style={styles.bodyText}>
              Listings, usernames, and messages may be visible to other users as part of the normal operation of the marketplace.
            </Text>

            <Text style={styles.sectionTitle}>Children's Privacy</Text>
            <Text style={styles.bodyText}>
              Local List is not intended for children under 13, and we do not knowingly collect personal information from children under 13.
            </Text>

            <Text style={styles.sectionTitle}>Changes to This Policy</Text>
            <Text style={styles.bodyText}>
              We may update this Privacy Policy from time to time. Continued use of the app means you accept any updates.
            </Text>

            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.bodyText}>
              If you have questions about this Privacy Policy, contact support through the Contact Us page or by emailing us at support@locallist.com.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>© 2026 Local List. A local marketplace for Harrison.</Text>
          </View>
        </View>
      </ScrollView>
    );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    backgroundColor: "#f5f5f5",
  },

  container: {
    flex: 1,
  },

  mainTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 0.2,
  },
 backButton: {
    alignSelf: 'center',
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  updatedDate: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 20,
    textAlign: "center",
    paddingVertical: 8,
  },

  contentBox: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 28,
    marginBottom: 20,
    borderTopColor: "#475569",
    borderTopWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },

  introText: {
    fontSize: 16,
    color: "#222",
    lineHeight: 27,
    marginBottom: 24,
    fontWeight: "400",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#475569",
    marginTop: 24,
    marginBottom: 8,
  },

  bodyText: {
    fontSize: 14,
    fontWeight: "400",
    color: "#222",
    lineHeight: 21,
    marginBottom: 10,
  },

  footer: {
    marginTop: 40,
    paddingVertical: 20,
    backgroundColor: "#333",
    borderRadius: 0,
    alignItems: "center",
  },

  footerText: {
    fontSize: 14,
    fontWeight: "400",
    color: "white",
    textAlign: "center",
  },
});
