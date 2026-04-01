import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CommunityDisclosures from './CommunityDisclosures';

type TabType = 'disclosures' | 'settings' | 'help';

export default function ProfileDisclosuresTab() {
  const [activeTab, setActiveTab] = useState<TabType>('disclosures');

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'disclosures' && styles.activeTab]}
          onPress={() => setActiveTab('disclosures')}
        >
          <Feather name="info" size={18} color={activeTab === 'disclosures' ? '#007AFF' : '#999'} />
          <Text style={[styles.tabText, activeTab === 'disclosures' && styles.activeTabText]}>
            Guidelines
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}
        >
          <Feather name="settings" size={18} color={activeTab === 'settings' ? '#007AFF' : '#999'} />
          <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
            Settings
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'help' && styles.activeTab]}
          onPress={() => setActiveTab('help')}
        >
          <Feather name="help-circle" size={18} color={activeTab === 'help' ? '#007AFF' : '#999'} />
          <Text style={[styles.tabText, activeTab === 'help' && styles.activeTabText]}>
            Help
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'disclosures' && <CommunityDisclosures />}
      {activeTab === 'settings' && (
        <ScrollView style={styles.content}>
          <Text style={styles.placeholder}>Settings content goes here</Text>
        </ScrollView>
      )}
      {activeTab === 'help' && (
        <ScrollView style={styles.content}>
          <Text style={styles.placeholder}>Help content goes here</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  activeTabText: {
    color: '#007AFF',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  placeholder: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 24,
  },
});
