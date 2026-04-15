import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, getFirestore, updateDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';
import { useAuth } from '../hooks/useAuth';

export default function EditProfileComp() {
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [zip, setZip] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      const fetchProfile = async () => {
        try {
          const db = getFirestore(app);
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setName(data.name || user.displayName || '');
            setEmail(data.email || user.email || '');
            setPhone(data.phone || '');
            setZip(data.zip || '');
            setPhotoUrl(data.profileimage || '');
          }
        } catch (e) {
          // fallback
          setName(user.displayName || '');
          setEmail(user.email || '');
        }
      };
      fetchProfile();
    }
  }, [user]);

  const handleSave = async () => {
    if (!user?.uid) return;
    try {
      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        phone,
        zip,
      });
      Alert.alert('Profile updated', 'Your phone and zip code have been updated.');
    } catch (e) {
      Alert.alert('Error', 'There was a problem updating your profile.');
    }
  };

  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need access to your photo library to upload a profile photo.');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
         allowsEditing: false,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadPhoto(result.assets[0].uri);
      }
    } catch (e) {
      console.error('Image picker error:', e);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadPhoto = async (uri: string) => {
    if (!user?.uid) return;
    
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const storage = getStorage(app);
      const photoRef = ref(storage, `profilePhotos/${user.uid}/photo`);
      
      console.log('Uploading photo to:', `profilePhotos/${user.uid}/photo`);
      await uploadBytes(photoRef, blob);
      const downloadUrl = await getDownloadURL(photoRef);
      
      console.log('Photo uploaded, URL:', downloadUrl);
      setPhotoUrl(downloadUrl);
      
      const db = getFirestore(app);
      const userRef = doc(db, 'users', user.uid);
      console.log('Updating user document with profileimage');
      await updateDoc(userRef, { profileimage: downloadUrl });
      
      Alert.alert('Success', 'Profile photo updated');
    } catch (e) {
      console.error('Upload error:', e);
      Alert.alert('Error', `Failed to upload photo: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    setUploading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.photoSection}>
        <TouchableOpacity 
          style={styles.photoContainer} 
          onPress={pickImage}
          disabled={uploading}
        >
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photoImage} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="person-circle" size={80} color="#bbb" />
            </View>
          )}
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
          <View style={styles.photoEditButton}>
            <Ionicons name="camera" size={20} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.photoHint}>Tap to change profile photo</Text>
      </View>
      <Text style={styles.label}>Name</Text>
      <Text style={styles.disabledInput}>{name}</Text>
      <Text style={styles.label}>Email</Text>
      <Text style={styles.disabledInput}>{email}</Text>
      <Text style={styles.label}>Phone</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="Enter phone number"
      />
      <Text style={styles.label}>Zip Code</Text>
      <TextInput
        style={styles.input}
        value={zip}
        onChangeText={setZip}
        keyboardType="number-pad"
        placeholder="Enter zip code"
      />
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save changes</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  label: {
    fontSize: 15,
    color: '#555',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
    width: '100%',
  },
  disabledInput: {
    fontSize: 16,
    color: '#888',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 6,
    width: '100%',
  },
  saveButton: {
    marginTop: 32,
    backgroundColor: '#2980b9',
    paddingVertical: 16,
    borderRadius: 5,
    alignItems: 'center',
    width: '100%',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  photoContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  photoEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2980b9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 60,
  },
  photoHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 8,
  },
});