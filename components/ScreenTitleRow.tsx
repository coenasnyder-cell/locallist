import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type ScreenTitleRowProps = {
  title: string;
  showBack?: boolean;
  onBackPress?: () => void;
  iconColor?: string;
};

export default function ScreenTitleRow({
  title,
  showBack = true,
  onBackPress,
  iconColor = '#333',
}: ScreenTitleRowProps) {
  const router = useRouter();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }

    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <View style={styles.titleRow}>
      {showBack ? (
        <TouchableOpacity onPress={handleBackPress} style={styles.arrowButton} activeOpacity={0.8}>
          <Feather name="arrow-left" size={24} color={iconColor} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.titleCenterWrapper}>
        <Text style={styles.titleText}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    height: 34,
  },
  arrowButton: {
    position: 'absolute',
    left: 0,
    padding: 4,
    zIndex: 2,
  },
  titleCenterWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
    textAlign: 'center',
  },
});
