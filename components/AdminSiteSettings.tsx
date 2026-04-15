import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SiteSettings from './SiteSettings';

const AdminSiteSettings = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Site Settings</Text>
      <SiteSettings />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
});

export default AdminSiteSettings;
