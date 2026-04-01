import FormInput from '@/components/FormInput';
import ImageUploader from '@/components/ImageUploader';
import { useAccountStatus } from '@/hooks/useAccountStatus';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Redirect, useRouter } from 'expo-router';
import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app } from '../../firebase';

function parseDate(value: string): Date | null {
  const s = value.trim();
  // Accept YYYY-MM-DD, MM/DD/YY, and MM/DD/YYYY for easier mobile entry.
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const parsed = new Date(year, month - 1, day);
    if (
      parsed.getFullYear() === year
      && parsed.getMonth() === month - 1
      && parsed.getDate() === day
    ) {
      return parsed;
    }
    return null;
  }

  const usMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!usMatch) return null;

  const month = Number(usMatch[1]);
  const day = Number(usMatch[2]);
  const yearPart = usMatch[3];
  const year = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart);

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() === year
    && parsed.getMonth() === month - 1
    && parsed.getDate() === day
  ) {
    return parsed;
  }

  return null;
}

function parseTime(value: string): string | null {
  const s = value.trim();
  if (!/^\d{1,2}:\d{2}$/.test(s)) return null;
  return s;
}

function formatDateValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

function formatTimeValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getDatePickerDate(value: string): Date {
  return parseDate(value) ?? new Date();
}

function getTimePickerDate(value: string): Date {
  const base = new Date();
  const parsed = parseTime(value);
  if (!parsed) return base;

  const [hours, minutes] = parsed.split(':').map(Number);
  base.setHours(hours, minutes, 0, 0);
  return base;
}

export default function CreateYardSaleScreen() {
  const router = useRouter();
  const { user, profile, loading } = useAccountStatus();

  const [saleTitle, setSaleTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [saleEndDate, setSaleEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [activeDatePicker, setActiveDatePicker] = useState<'startDate' | 'endDate' | null>(null);
  const [activeTimePicker, setActiveTimePicker] = useState<'start' | 'end' | null>(null);
  const [locationAddress, setLocationAddress] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationZip, setLocationZip] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState(false);

  if (!loading && !user) {
    return <Redirect href="/login" />;
  }

  if (loading) {
    return null;
  }

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/listbutton' as any);
  };

  const handleDateChange = (field: 'startDate' | 'endDate') => (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed' || !selectedDate) {
      setActiveDatePicker(null);
      return;
    }

    const nextValue = formatDateValue(selectedDate);
    if (field === 'startDate') {
      setSaleDate(nextValue);
    } else {
      setSaleEndDate(nextValue);
    }
    setActiveDatePicker(null);
  };

  const handleTimeChange = (field: 'start' | 'end') => (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed' || !selectedDate) {
      setActiveTimePicker(null);
      return;
    }

    const nextValue = formatTimeValue(selectedDate);
    if (field === 'start') {
      setStartTime(nextValue);
    } else {
      setEndTime(nextValue);
    }
    setActiveTimePicker(null);
  };

  const handleSubmit = async () => {
    const title = saleTitle.trim();
    const descriptionText = description.trim();
    const addressText = locationAddress.trim();
    const cityText = locationCity.trim();
    const stateText = locationState.trim().toUpperCase();
    const zipText = locationZip.trim();
    const saleDateParsed = parseDate(saleDate);
    const saleEndParsed = parseDate(saleEndDate);
    const startTimeValue = startTime.trim();
    const endTimeValue = endTime.trim();
    const startTimeParsed = startTimeValue ? parseTime(startTimeValue) : '';
    const endTimeParsed = endTimeValue ? parseTime(endTimeValue) : '';

    if (!title) {
      Alert.alert('Missing Field', 'Please enter a sale title.');
      return;
    }
    if (!saleDateParsed) {
      Alert.alert('Invalid Date', 'Sale date must be in MM/DD/YY, MM/DD/YYYY, or YYYY-MM-DD format.');
      return;
    }
    if (!saleEndParsed) {
      Alert.alert('Invalid Date', 'Sale end date must be in MM/DD/YY, MM/DD/YYYY, or YYYY-MM-DD format.');
      return;
    }
    if (saleEndParsed < saleDateParsed) {
      Alert.alert('Invalid Date Range', 'Sale end date must be on or after the start date.');
      return;
    }
    if (startTimeValue && !startTimeParsed) {
      Alert.alert('Invalid Time', 'Start time must be in HH:MM format (e.g. 08:00).');
      return;
    }
    if (endTimeValue && !endTimeParsed) {
      Alert.alert('Invalid Time', 'End time must be in HH:MM format (e.g. 14:00).');
      return;
    }
    const hasFullLocationDetails = !!(addressText && cityText && stateText && zipText);
    const hasLocationInDescription = descriptionText.length > 0;
    if (!hasFullLocationDetails && !hasLocationInDescription) {
      Alert.alert('Missing Location', 'Please add location in the description or complete all location details below (address, city, state, ZIP).');
      return;
    }
    if (images.length === 0) {
      Alert.alert('Missing Images', 'Please upload at least one photo for your yard sale listing.');
      return;
    }
    if (!user?.uid) {
      Alert.alert('Error', 'You must be signed in to post a yard sale.');
      return;
    }

    try {
      setSubmitting(true);
      const db = getFirestore(app);
      const yardsaleImage = images[0] ?? '';

      await addDoc(collection(db, 'yardSales'), {
        yardsaleTitle: title,
        yardsaleDescription: descriptionText,
        yardsaleDate: saleDateParsed,
        yardsaleEndDate: saleEndParsed,
        yardsaleStart: startTimeParsed || '',
        yardsaleEndtime: endTimeParsed || '',
        yardsaleAddress: addressText || null,
        yardsaleCity: cityText || null,
        yardsaleState: stateText || null,
        yardsaleZipcode: zipText || null,
        yardsalelocation: hasFullLocationDetails ? `${addressText}, ${cityText}, ${stateText} ${zipText}` : '',
        yardsaleExpires: saleEndParsed,
        yardsaleImage,
        yardsalestatus: 'active',
        userName: profile?.displayName || user.displayName || user.email?.split('@')[0] || '',
        userId: user.uid,
        yardsaleCreatedat: serverTimestamp(),
      });

      setPosted(true);
    } catch {
      Alert.alert('Error', 'Could not post yard sale. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (posted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successWrapper}>
          <View style={styles.successCard}>
            <View style={styles.successCircle}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Yard Sale Posted!</Text>
            <Text style={styles.successMessage}>
              Your yard sale is live and visible to the community. What would you like to do next?
            </Text>
            <View style={styles.successActions}>
              <TouchableOpacity
                style={styles.successPrimary}
                onPress={() => router.replace('/(tabs)/communitybutton' as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.successPrimaryText}>View Community</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.successSecondary}
                onPress={() => {
                  setPosted(false);
                  setSaleTitle('');
                  setDescription('');
                  setSaleDate('');
                  setSaleEndDate('');
                  setStartTime('');
                  setEndTime('');
                  setLocationAddress('');
                  setLocationCity('');
                  setLocationState('');
                  setLocationZip('');
                  setImages([]);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.successSecondaryText}>Post Another Yard Sale</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.successSecondary}
                onPress={handleBack}
                activeOpacity={0.85}
              >
                <Text style={styles.successSecondaryText}>Back to List Hub</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>🏷️ Post a Yard Sale</Text>
          <Text style={styles.heroSubtitle}>Let your neighbors know about your upcoming sale</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionDivider}>SALE INFO</Text>

          <FormInput
            label="Sale Title"
            value={saleTitle}
            onChangeText={setSaleTitle}
            required
            placeholder="e.g. Multi-Family Yard Sale"
          />
          <FormInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="What kinds of items will be for sale? Include location here or below in Location Details."
          />
          <Text style={styles.helpText}>Please enter location in description or below in the location details.</Text>

          <Text style={styles.sectionDivider}>DATE &amp; TIME</Text>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.timeLabel}>Sale Start Date *</Text>
              {Platform.OS === 'web' ? (
                <FormInput
                  label=""
                  value={saleDate}
                  onChangeText={setSaleDate}
                  required
                  placeholder="MM/DD/YY"
                />
              ) : (
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setActiveDatePicker('startDate')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.timePickerButtonText, !saleDate ? styles.timePickerPlaceholder : null]}>
                    {saleDate || 'Select start date'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.col}>
              <Text style={styles.timeLabel}>Sale End Date *</Text>
              {Platform.OS === 'web' ? (
                <FormInput
                  label=""
                  value={saleEndDate}
                  onChangeText={setSaleEndDate}
                  required
                  placeholder="MM/DD/YY"
                />
              ) : (
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setActiveDatePicker('endDate')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.timePickerButtonText, !saleEndDate ? styles.timePickerPlaceholder : null]}>
                    {saleEndDate || 'Select end date'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <Text style={styles.helpText}>Use MM/DD/YY (or MM/DD/YYYY). For one-day sales, use the same date for start and end.</Text>

          {Platform.OS !== 'web' && activeDatePicker ? (
            <DateTimePicker
              value={getDatePickerDate(activeDatePicker === 'startDate' ? saleDate : saleEndDate)}
              mode="date"
              display="default"
              onChange={handleDateChange(activeDatePicker)}
            />
          ) : null}

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.timeLabel}>Start Time</Text>
              {Platform.OS === 'web' ? (
                <FormInput
                  label=""
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="08:00 (optional)"
                />
              ) : (
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setActiveTimePicker('start')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.timePickerButtonText, !startTime ? styles.timePickerPlaceholder : null]}>
                    {startTime || 'Select start time'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.col}>
              <Text style={styles.timeLabel}>End Time</Text>
              {Platform.OS === 'web' ? (
                <FormInput
                  label=""
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="14:00 (optional)"
                />
              ) : (
                <TouchableOpacity
                  style={styles.timePickerButton}
                  onPress={() => setActiveTimePicker('end')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.timePickerButtonText, !endTime ? styles.timePickerPlaceholder : null]}>
                    {endTime || 'Select end time'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {Platform.OS !== 'web' && activeTimePicker ? (
            <DateTimePicker
              value={getTimePickerDate(activeTimePicker === 'start' ? startTime : endTime)}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={handleTimeChange(activeTimePicker)}
            />
          ) : null}

          <Text style={styles.sectionDivider}>LOCATION</Text>

          <FormInput
            label="Address"
            value={locationAddress}
            onChangeText={setLocationAddress}
            placeholder="123 Main St"
          />
          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="City"
                value={locationCity}
                onChangeText={setLocationCity}
                placeholder="Harrison"
              />
            </View>
            <View style={styles.col}>
              <FormInput
                label="State"
                value={locationState}
                onChangeText={(text) => setLocationState(text.toUpperCase())}
                placeholder="AR"
              />
            </View>
          </View>
          <FormInput
            label="ZIP Code"
            value={locationZip}
            onChangeText={setLocationZip}
            keyboardType="numeric"
            placeholder="72601"
          />
          <Text style={styles.helpText}>Location details are optional only if location is included in description.</Text>

          <Text style={styles.sectionDivider}>PHOTO *</Text>

          <ImageUploader images={images} onChange={setImages} />

          <TouchableOpacity
            style={[styles.submitBtn, submitting ? styles.submitDisabled : null]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>{submitting ? 'Posting...' : 'Post Yard Sale'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleBack} activeOpacity={0.85}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f5f7',
  },
  content: {
    padding: 14,
    paddingBottom: 32,
    gap: 12,
  },
  hero: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  panel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  sectionDivider: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#fee2e2',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  helpText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
    marginTop: -2,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  timePickerButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  timePickerButtonText: {
    fontSize: 14,
    color: '#0f172a',
  },
  timePickerPlaceholder: {
    color: '#94a3b8',
  },
  submitBtn: {
    marginTop: 16,
    backgroundColor: '#475569',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  cancelText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  successWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  successCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d8e4f2',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
  },
  successCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#15803d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successCheck: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  successActions: {
    width: '100%',
    gap: 10,
  },
  successPrimary: {
    backgroundColor: '#475569',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  successPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  successSecondary: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  successSecondaryText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
  },
});
