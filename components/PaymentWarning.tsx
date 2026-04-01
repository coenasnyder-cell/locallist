import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function PaymentWarning() {
  return (
    <View style={styles.warningContainer}>
      <MaterialCommunityIcons name="alert-circle" size={16} color="#FF6B6B" style={styles.icon} />
      <Text style={styles.warningText}>
        Never send payments outside this app. Always use secure payment methods within the platform.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 4,
  },
  icon: {
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#C41E3A',
    fontWeight: '500',
    lineHeight: 18,
  },
});
