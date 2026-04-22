import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PrivacyPolicy() {
  const router = useRouter();

  return (
<View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >

        {/* LOGO */}
        <View style={styles.logoSection}>
          <Image
  source={require('../assets/images/logo.png')}
  contentFit="contain"/>
        </View>
        {/* MAIN CONTENT */}
<View style={styles.titleRow}>
  <TouchableOpacity
    onPress={() => router.back()}
    style={styles.arrowButton}
    activeOpacity={0.8}
  >
    <Feather name="arrow-left" size={24} color="#333" />
  </TouchableOpacity>

  <View style={styles.titleCenterWrapper}>
    <Text style={styles.infoRowText}>Terms & Conditions Updated:02/07/2026</Text>
  </View>
</View> 
        <View style={styles.contentBox}>
          <Text style={styles.introText}>
            Local List respects your privacy and is committed to protecting your information. This Privacy Policy explains what information we collect, how we use it, and how we protect it.
          </Text>

          <Text style={styles.sectionTitle}>Information We Collect</Text>
          <Text style={styles.bodyText}>
            We may collect the following information when you use Local List:
          </Text>
          <Text style={styles.bodyText}>
            • Account Information (email address, zip code, etc).{"\n"}
            • Listings and Content (photos, titles, etc).{"\n"}
            • Messages sent between buyers and sellers.{"\n"}
            • Basic usage information (viewing/creating posts).
          </Text>

          <Text style={styles.sectionTitle}>Camera and Media Access</Text>
          <Text style={styles.bodyText}>
            Local List may request access to your device&apos;s camera and photo library to allow you to upload images for listings, services, or profiles. This access is only used for app functionality, and we do not access your camera or media without your permission.
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

          <Text style={styles.sectionTitle}>Children&apos;s Privacy</Text>
          <Text style={styles.bodyText}>
            Local List is not intended for children under 13, and we do not knowingly collect personal information from children under 13.
          </Text>

          <Text style={styles.sectionTitle}>Changes to This Policy</Text>
          <Text style={styles.bodyText}>
            We may update this Privacy Policy from time to time. Continued use of the app means you accept any updates.
          </Text>

          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.bodyText}>
            If you have questions about this Privacy Policy, contact support through the Contact Us page or by emailing us at support@locallist.biz.
          </Text>
        </View>

          <View style={styles.footer}>
         <Text style={styles.footerCopy}>© 2026 Local List. A local marketplace for Harrison.</Text>
         <View style={styles.footerLinksRow}>
         <TouchableOpacity onPress={() => router.push('/terms-conditions' as any)} activeOpacity={0.8}>
         <Text style={styles.footerLink}>Terms of Use</Text>
          </TouchableOpacity>
          <Text style={styles.footerDivider}>|</Text>
        <TouchableOpacity onPress={() => router.push('/policy-privacy' as any)} activeOpacity={0.8}>
          <Text style={styles.footerLink}>Privacy Policy</Text>
         </TouchableOpacity>
         </View>
        </View>
      </ScrollView>
    </View>
  );
}
  

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F6F8",
  },
  scrollContainer: {
  paddingHorizontal: 16,
  paddingTop: 20,
  paddingBottom: 40,
  },

  container: {
  paddingHorizontal: 16,
  marginTop: 10,
},
titleRow: {
    flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 10,
  },
  arrowButton: {
    position: 'absolute',
    left: 0,
    padding: 4,
    zIndex: 2,
  },
  titleCenterWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    marginBottom: 10,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
    textAlign: 'center',
  },

  logoSection: {
     paddingTop: 20,
  paddingBottom: 10,
  alignItems: 'center',
  },
  centeredLogo: {
    width: 140,
    height: 66,
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
  fontSize: 17,
  fontWeight: "700",
  color: "#333",
  textAlign: "center",
  },

  contentBox: {
  backgroundColor: "#fff",
  borderRadius: 18,
  padding: 18,
  marginBottom: 20,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
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
    marginTop: 24,
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerCopy: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
  },
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    paddingVertical: 4,
  },
  footerDivider: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
