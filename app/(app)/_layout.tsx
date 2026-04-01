import { Stack, usePathname } from 'expo-router';
import { View } from 'react-native';
import Header from '../../components/Header';

export default function AppLayout() {
  const pathname = usePathname();
  const shouldShowHeader = !pathname.includes('/threadchat');

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {shouldShowHeader && <Header showTitle={false} />}
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* Content pages that have the header */}
        <Stack.Screen name="listing" />
        <Stack.Screen name="all-listings" />
        <Stack.Screen name="homedecorlist" />
        <Stack.Screen name="handmadelist" />
        <Stack.Screen name="furniturelist" />
        <Stack.Screen name="babykidslist" />
        <Stack.Screen name="outdoorslist" />
        <Stack.Screen name="autolistings" />
        <Stack.Screen name="electroniclistings" />
        <Stack.Screen name="toolslist" />
        <Stack.Screen name="shoplocallist" />
        <Stack.Screen name="businesslocal" />
        <Stack.Screen name="business-settings" />
        <Stack.Screen name="business-analytics" />
        <Stack.Screen name="business-reputation" />
        <Stack.Screen name="create-deal-listing" />
        <Stack.Screen name="create-yard-sale" />
        <Stack.Screen name="create-event-listing" />
          <Stack.Screen name="create-service-listing" />
        <Stack.Screen name="service-details" />
        <Stack.Screen name="post-promote" />
        <Stack.Screen name="eventslist" />
        <Stack.Screen name="searchlistings" />
        <Stack.Screen name="joblistings" />
        <Stack.Screen name="help" />
        <Stack.Screen name="support-hub" />
        <Stack.Screen name="community-guidelines" />
        <Stack.Screen name="termsOfUse" />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="contactus" />
        <Stack.Screen name="deals" />
        <Stack.Screen name="featured-listings" />
        <Stack.Screen name="yardsalelistings" />
        <Stack.Screen name="blocked-users" />
        <Stack.Screen name="threadchat" />
      </Stack>
    </View>
  );
}
