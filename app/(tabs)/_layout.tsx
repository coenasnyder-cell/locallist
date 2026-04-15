import Header from '@/components/Header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';

export default function Layout() {

  useEffect(() => {
    console.log('[TabsLayout] mounted');
    return () => console.log('[TabsLayout] unmounted');
  }, []);
  return (
    <>
      <Header />
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
          name="listbutton"
          options={{
            href: null,
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
          name="petbutton"
          options={{
            href: null,
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
            href: null,
          }}
        />
        <Tabs.Screen
          name="businesshubbutton"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="supporthubbutton"
          options={{
            title: 'Support',
            tabBarIcon: ({ color }) => <MaterialIcons size={28} name="help-outline" color={color} />,
          }}
        />
        <Tabs.Screen
          name="adminbutton"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}