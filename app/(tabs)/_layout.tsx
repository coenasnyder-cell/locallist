import { IconSymbol } from '@/components/ui/icon-symbol';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';

export default function Layout() {

  useEffect(() => {
    console.log('[TabsLayout] mounted');
    return () => console.log('[TabsLayout] unmounted');
  }, []);
  return (
      <Tabs
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="browsebutton"
          options={{
            title: 'Browse',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="cart.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="communitybutton"
          options={{
            title: 'Community',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.2.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="messagesbutton"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="envelope.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profilebutton"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
          }}
        />
      </Tabs>
  );
}