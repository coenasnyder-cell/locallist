import AdminReportedMessages from '@/components/AdminReportedMessages';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';

export default function ReportedMessagesScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header />
      <AdminReportedMessages />
    </SafeAreaView>
  );
}
