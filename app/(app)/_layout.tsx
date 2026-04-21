import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { AppRegistry } from 'react-native';

// Register Stripe background task inside (app) layout to suppress native warnings
// as requested to keep it out of the root layout.
try {
  AppRegistry.registerHeadlessTask('StripeKeepJsAwakeTask', () => async () => {});
} catch (e) {
  // Task might already be registered
}

export default function AppLayout() {

  useEffect(() => {
    console.log('[AppLayout] mounted');
    return () => console.log('[AppLayout] unmounted');
  }, []);

  return (
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        >
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
          <Stack.Screen name="support-hub" />
          <Stack.Screen name="community-guidelines" />
          <Stack.Screen name="contactus" />
          <Stack.Screen name="deals" />
          <Stack.Screen name="featured-listings" />
          <Stack.Screen name="yardsalelistings" />
          <Stack.Screen name="yard-sale-detail" />
          <Stack.Screen name="blocked-users" />
          <Stack.Screen name="threadchat" />
          <Stack.Screen name="pet-details" />
          <Stack.Screen name="create-pet-post" />
          <Stack.Screen name="create-adoption-listing" />
          <Stack.Screen name="browse-pets" />
          <Stack.Screen name="businessprofile" />
          <Stack.Screen name="upgrade-business" />
          <Stack.Screen name="create-listing" />
          <Stack.Screen name="create-job-listing" />
          <Stack.Screen name="public-profile" />
          <Stack.Screen name="business-listings" />
          <Stack.Screen name="serviceslist" />
          <Stack.Screen name="premium-upgrade" />
          <Stack.Screen name="listing-posted" />
          <Stack.Screen name="pet-corner" />
          <Stack.Screen name="business-hub" />
          <Stack.Screen name="admin-panel" />
        </Stack>
  );
}