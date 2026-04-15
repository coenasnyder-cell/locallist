import { doc, getDoc, getFirestore, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { app } from '../firebase';

const SiteSettings = () => {
  const [quote, setQuote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const db = getFirestore(app);
        const settingsRef = doc(db, 'siteSettings', 'main');
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          setQuote(settingsSnap.data().quoteOfTheDay || '');
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to load site settings.');
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const db = getFirestore(app);
      const settingsRef = doc(db, 'siteSettings', 'main');
      await updateDoc(settingsRef, { quoteOfTheDay: quote });
      Alert.alert('Success', 'Quote of the Day updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to update quote.');
    }
    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Quote of the Day</Text>
      <TextInput
        style={styles.input}
        value={quote}
        onChangeText={setQuote}
        placeholder="Enter quote..."
        editable={!loading && !saving}
      />
      <Button title="Save" onPress={handleSave} disabled={loading || saving} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  label: { fontWeight: 'bold', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, marginBottom: 16 },
});

export default SiteSettings;
