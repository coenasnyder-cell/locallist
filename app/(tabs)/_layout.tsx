import Header from '@/components/Header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useAccountStatus } from '../../hooks/useAccountStatus';

export default function Layout() {
  const { user, profile, loading, isBusinessAccount } = useAccountStatus();
  const waitingForProfile = !!user && !profile;
  if (!loading && !user) {
    console.log('User not logged in: hide List and Messages tabs');
  }
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
            title: 'List',
            tabBarLabel: user ? 'List' : '',
            tabBarIcon: ({ color }) =>
              user ? <IconSymbol size={28} name="list.bullet.rectangle.portrait.fill" color={color} /> : null,
            tabBarItemStyle: !user ? { display: 'none' } : {},
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
            tabBarIcon: ({ color }) =>
              user ? <IconSymbol size={28} name="envelope.fill" color={color} /> : null,
            tabBarLabel: user ? 'Messages' : '',
            tabBarItemStyle: !user ? { display: 'none' } : {},
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
            title: 'Business Hub',
            href: !user || waitingForProfile || !isBusinessAccount ? null : undefined,
            tabBarIcon: ({ color }) =>
              user ? <IconSymbol size={28} name="person.fill" color={color} /> : null,
            tabBarLabel: user && !waitingForProfile && isBusinessAccount ? 'Business Hub' : '',
            tabBarItemStyle: !user || waitingForProfile || !isBusinessAccount ? { display: 'none' } : {},
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