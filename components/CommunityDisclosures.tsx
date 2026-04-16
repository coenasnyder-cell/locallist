import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function CommunityDisclosures() {
  const disclosures = [
    {
      icon: 'book',
      title: 'Community Guidelines',
      description: 'Keep conversations respectful and safe. No harassment, discrimination, or illegal activities. All listings must comply with local laws and regulations.',
      color: '#E3F2FD',
      borderColor: '#2196F3',
    },
    {
      icon: 'calendar',
      title: 'Listing Expiration',
      description: 'Marketplace and pet listings automatically expire after 14 days. You can relist expired items from your profile to keep them visible.',
      color: '#FFF3E0',
      borderColor: '#FF9800',
    },
    {
      icon: 'alert-circle',
      title: 'Seller Responsibility',
      description: 'Local List is not responsible for transactions between buyers and sellers. We provide the platform; you agree to conduct transactions responsibly and safely.',
      color: '#FCE4EC',
      borderColor: '#E91E63',
    },
    {
      icon: 'shield',
      title: 'Safety Tips',
      description: '• Meet in public places\n• Never share personal financial information before completing the transaction\n• Use our secure messaging system\n• Trust your instincts - block users who make you uncomfortable\n• Report suspicious activity to our team',
      color: '#F3E5F5',
      borderColor: '#9C27B0',
    },
    {
      icon: 'lock',
      title: 'Local Service Area',
      description: 'This marketplace is designed for local, in-person transactions in Arkansas. All listings must be available for pickup or local delivery within the approved service area.',
      color: '#E8F5E9',
      borderColor: '#4CAF50',
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.mainTitle}>Community & Safety Guidelines</Text>
      <Text style={styles.subtitle}>
        Please review these important disclosures to understand how Local List works and how to stay safe.
      </Text>

      {disclosures.map((disclosure, index) => (
        <View
          key={index}
          style={[
            styles.disclosureCard,
            { backgroundColor: disclosure.color, borderLeftColor: disclosure.borderColor },
          ]}
        >
          <View style={styles.headerRow}>
            <Feather name={disclosure.icon as any} size={24} color={disclosure.borderColor} />
            <Text style={[styles.title, { color: disclosure.borderColor }]}>{disclosure.title}</Text>
          </View>
          <Text style={styles.description}>{disclosure.description}</Text>
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          By using Local List, you agree to follow these guidelines and accept our terms of service.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  disclosureCard: {
    borderLeftWidth: 5,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 12,
    flex: 1,
  },
  description: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
  },
  footer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});
