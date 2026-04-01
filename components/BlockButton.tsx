import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useAccountStatus } from '../hooks/useAccountStatus';
import { blockUser, isUserBlocked, unblockUser } from '../utils/blockService';

interface BlockButtonProps {
  targetUserId: string;
  targetUserName?: string;
  onBlockStatusChange?: (blocked: boolean) => void;
  style?: any;
}

export default function BlockButton({ 
  targetUserId, 
  targetUserName = 'this user',
  onBlockStatusChange,
  style 
}: BlockButtonProps) {
  const { user, profile } = useAccountStatus();
  const [loading, setLoading] = useState(false);
  
  if (!user || !profile) return null;
  
  // Don't show block button for own profile
  if (user.uid === targetUserId) return null;
  
  const blocked = isUserBlocked(profile, targetUserId);

  const handleToggleBlock = async () => {
    if (loading) return;
    
    if (blocked) {
      // Unblock confirmation
      Alert.alert(
        'Unblock User',
        `Are you sure you want to unblock ${targetUserName}? They will be able to see your listings and contact you again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: async () => {
              setLoading(true);
              try {
                await unblockUser(user.uid, targetUserId);
                Alert.alert('Success', `${targetUserName} has been unblocked.`);
                onBlockStatusChange?.(false);
              } catch (error) {
                console.error('Error unblocking user:', error);
                Alert.alert('Error', 'Could not unblock user. Please try again.');
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    } else {
      // Block confirmation
      Alert.alert(
        'Block User',
        `Are you sure you want to block ${targetUserName}? You won't see their listings and they won't be able to contact you.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              try {
                await blockUser(user.uid, targetUserId);
                Alert.alert('Success', `${targetUserName} has been blocked.`);
                onBlockStatusChange?.(true);
              } catch (error) {
                console.error('Error blocking user:', error);
                Alert.alert('Error', 'Could not block user. Please try again.');
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        blocked ? styles.unblockButton : styles.blockButton,
        style,
        loading && styles.disabledButton
      ]}
      onPress={handleToggleBlock}
      disabled={loading}
    >
      <Text style={[styles.buttonText, blocked ? styles.unblockText : styles.blockText]}>
        {loading ? 'Processing...' : blocked ? 'Unblock User' : 'Block User'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  blockButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f44336',
  },
  unblockButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  blockText: {
    color: '#f44336',
  },
  unblockText: {
    color: '#4CAF50',
  },
});
