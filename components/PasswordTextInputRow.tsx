import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleProp, StyleSheet, TextInput, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  textContentType?: 'password' | 'newPassword' | 'oneTimeCode' | 'none';
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function PasswordTextInputRow({
  value,
  onChangeText,
  placeholder,
  editable = true,
  autoCapitalize = 'none',
  autoCorrect = false,
  textContentType = 'password',
  style,
  containerStyle,
}: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.row, containerStyle]}>
      <TextInput
        style={[styles.input, style]}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        textContentType={textContentType}
        secureTextEntry={!visible}
        editable={editable}
      />
      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => setVisible((prev) => !prev)}
        disabled={!editable}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <Feather name={visible ? 'eye-off' : 'eye'} size={18} color="#475569" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  iconButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});

