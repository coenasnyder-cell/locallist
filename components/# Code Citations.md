# Code Citations

## License: unknown
https://github.com/Satyaranjan1234/PeopleBuilderHRMS/blob/ab70799403b10aee2a8789d62e6ca9c660cb2a12/src/screen/LeaveApproval.js

```
The changes aren't showing because the admin.tsx file needs to be updated to include the tab navigation. Let me fix that:

````tsx
// filepath: c:\Projects\myApp\app\admin.tsx
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import AdminPendingApprovals from '../components/AdminPendingApprovals';
import AdminAnalytics from '../components/AdminAnalytics';
import { Stack } from 'expo-router';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pending' | 'analytics'>('pending');

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Admin',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
```


## License: unknown
https://github.com/Satyaranjan1234/PeopleBuilderHRMS/blob/ab70799403b10aee2a8789d62e6ca9c660cb2a12/src/screen/LeaveApproval.js

```
The changes aren't showing because the admin.tsx file needs to be updated to include the tab navigation. Let me fix that:

````tsx
// filepath: c:\Projects\myApp\app\admin.tsx
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import AdminPendingApprovals from '../components/AdminPendingApprovals';
import AdminAnalytics from '../components/AdminAnalytics';
import { Stack } from 'expo-router';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pending' | 'analytics'>('pending');

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Admin',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
```


## License: unknown
https://github.com/Satyaranjan1234/PeopleBuilderHRMS/blob/ab70799403b10aee2a8789d62e6ca9c660cb2a12/src/screen/LeaveApproval.js

```
The changes aren't showing because the admin.tsx file needs to be updated to include the tab navigation. Let me fix that:

````tsx
// filepath: c:\Projects\myApp\app\admin.tsx
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import AdminPendingApprovals from '../components/AdminPendingApprovals';
import AdminAnalytics from '../components/AdminAnalytics';
import { Stack } from 'expo-router';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pending' | 'analytics'>('pending');

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Admin',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
```


## License: unknown
https://github.com/Satyaranjan1234/PeopleBuilderHRMS/blob/ab70799403b10aee2a8789d62e6ca9c660cb2a12/src/screen/LeaveApproval.js

```
The changes aren't showing because the admin.tsx file needs to be updated to include the tab navigation. Let me fix that:

````tsx
// filepath: c:\Projects\myApp\app\admin.tsx
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import AdminPendingApprovals from '../components/AdminPendingApprovals';
import AdminAnalytics from '../components/AdminAnalytics';
import { Stack } from 'expo-router';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pending' | 'analytics'>('pending');

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Admin',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
```


## License: unknown
https://github.com/Satyaranjan1234/PeopleBuilderHRMS/blob/ab70799403b10aee2a8789d62e6ca9c660cb2a12/src/screen/LeaveApproval.js

```
The changes aren't showing because the admin.tsx file needs to be updated to include the tab navigation. Let me fix that:

````tsx
// filepath: c:\Projects\myApp\app\admin.tsx
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import AdminPendingApprovals from '../components/AdminPendingApprovals';
import AdminAnalytics from '../components/AdminAnalytics';
import { Stack } from 'expo-router';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pending' | 'analytics'>('pending');

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Admin',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
```


## License: unknown
https://github.com/Satyaranjan1234/PeopleBuilderHRMS/blob/ab70799403b10aee2a8789d62e6ca9c660cb2a12/src/screen/LeaveApproval.js

```
The changes aren't showing because the admin.tsx file needs to be updated to include the tab navigation. Let me fix that:

````tsx
// filepath: c:\Projects\myApp\app\admin.tsx
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import AdminPendingApprovals from '../components/AdminPendingApprovals';
import AdminAnalytics from '../components/AdminAnalytics';
import { Stack } from 'expo-router';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pending' | 'analytics'>('pending');

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Admin',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
```


## License: unknown
https://github.com/Satyaranjan1234/PeopleBuilderHRMS/blob/ab70799403b10aee2a8789d62e6ca9c660cb2a12/src/screen/LeaveApproval.js

```
The changes aren't showing because the admin.tsx file needs to be updated to include the tab navigation. Let me fix that:

````tsx
// filepath: c:\Projects\myApp\app\admin.tsx
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import AdminPendingApprovals from '../components/AdminPendingApprovals';
import AdminAnalytics from '../components/AdminAnalytics';
import { Stack } from 'expo-router';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pending' | 'analytics'>('pending');

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Admin',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={styles.container}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
```

