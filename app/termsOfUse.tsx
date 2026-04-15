import { useRouter } from 'expo-router';
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function SectionTitle({ children }: React.PropsWithChildren<{}>) {
  return (
    <Text style={styles.sectionTitle}>{children}</Text>
  );
}

export default function TermsOfUseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <Text style={styles.backButton} onPress={() => router.back()}>← Back</Text>
          <Text style={styles.mainTitle}>Terms & Conditions</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoRowText}>Updated: 02/07/2026</Text>
          </View>

          <View style={styles.contentBox}>
            <Text style={styles.introText}>
              Welcome to Local List. By creating an account or using this app, you agree to the following terms.
            </Text>

            <SectionTitle>Use of the Platform:</SectionTitle>
            <Text style={styles.bodyText}>
              Local List provides a platform for users to buy, sell, and connect locally. Local List does not own, inspect, or guarantee items listed by users. Users are responsible for the accuracy of their listings, communicating honestly, and following local, state, and federal laws.
            </Text>

            <SectionTitle>Eligibility:</SectionTitle>
            <Text style={styles.bodyText}>
              To use Local List, you must be at least 18 years old or have permission from a parent or guardian and provide accurate account information. We reserve the right to suspend or remove accounts that provide false information.
            </Text>

            <SectionTitle>Listings and User Content:</SectionTitle>
            <Text style={styles.bodyText}>
              Users are responsible for all content they post, including photos, descriptions, prices, and messages. You agree not to post illegal items, stolen goods, fraudulent or misleading listings, adult content, or anything that violates local, state, or federal laws. Local List reserves the right to remove listings or accounts that violate these rules.
            </Text>

            <SectionTitle>Transactions Between Users:</SectionTitle>
            <Text style={styles.bodyText}>
              Local List is a technology platform and is not a party to transactions between buyers and sellers. Local List does not guarantee payment, delivery, or the accuracy of listings. Users are responsible for meeting safely and verifying items before purchase.
            </Text>

            <SectionTitle>Payments and Featured Listings</SectionTitle>
            <Text style={styles.bodyText}>
              Local List may offer optional paid features such as Featured Listings to increase visibility. Payment is for promotional placement only and does not guarantee a sale.
            </Text>

            <SectionTitle>Refund Policy</SectionTitle>
            <Text style={styles.bodyText}>
              Refunds are issued only in cases of duplicate charges, technical errors that prevented delivery of a paid feature, or confirmed billing errors.
            </Text>
            <Text style={styles.bodyText}>
              Refund requests should include your account email, date of purchase, and a description of the issue.
            </Text>

            <SectionTitle>Account Suspension</SectionTitle>
            <Text style={styles.bodyText}>
              Local List reserves the right to remove listings, restrict accounts, or suspend users who violate policies, attempt fraud, or misuse the platform.
            </Text>

            <SectionTitle>Limitation of Liability</SectionTitle>
            <Text style={styles.bodyText}>
              Local List is provided as is without guarantees of availability or reliability. Local List is not responsible for disputes between users, losses related to transactions, or damages related to items purchased.
            </Text>

            <SectionTitle>Safety Reminder</SectionTitle>
            <Text style={styles.bodyText}>
              Always meet in public places and avoid sharing sensitive personal information.
            </Text>

            <SectionTitle>Changes to Terms</SectionTitle>
            <Text style={styles.bodyText}>
              We may update these Terms at any time. Continued use of the app means you accept the updated Terms.
            </Text>

            <SectionTitle>Contact</SectionTitle>
            <Text style={styles.bodyText}>
              If you have questions, contact support at support@locallist.biz or through the Contact Us page in the app.
            </Text>
          </View>

          <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
            <Text style={styles.footerText}>© 2026 Local List.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  scrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 28,
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
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  infoRow: {
    backgroundColor: "transparent",
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  infoRowText: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
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
    marginBottom: 26,
    fontWeight: "400",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 8,
    color: "#475569",
  },

  bodyText: {
    fontSize: 14,
    color: "#222",
    lineHeight: 21,
    marginBottom: 10,
    fontWeight: "400",
  },

  footer: {
    marginTop: 40,
    marginHorizontal: -20,
    alignSelf: "stretch",
    paddingTop: 18,
    paddingBottom: 16,
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
