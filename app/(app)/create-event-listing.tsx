import FormInput from '@/components/FormInput';
import ImageUploader from '@/components/ImageUploader';
import { useAccountStatus } from '@/hooks/useAccountStatus';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app } from '../../firebase';

function parseDate(value: string): Date | null {
  const s = value.trim();
  // Accept YYYY-MM-DD, xx/xx/xx, and MM/DD/YYYY for easier mobile entry.
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

export default function CreateEventListingScreen() {
  const router = useRouter();
  const { user, profile, loading, canPostListings, postingBlockedReason } = useAccountStatus();
  const hasPostingAccess = !!user;

  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [ticketPrice, setTicketPrice] = useState('');
  const [eventStarttime, setEventStarttime] = useState('');
  const [eventEndtime, setEventEndtime] = useState('');
  const [activeDatePicker, setActiveDatePicker] = useState<'startDate' | 'endDate' | null>(null);
  const [activeTimePicker, setActiveTimePicker] = useState<'startTime' | 'endTime' | null>(null);
  const [eventAdress, setEventAdress] = useState('');
  const [eventCity, setEventCity] = useState('');
  const [eventState, setEventState] = useState('');
  const [eventZipcode, setEventZipcode] = useState('');
  const [eventWebsite, setEventWebsite] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState(false);

  if (loading) {
    return null;
  }

  if (!hasPostingAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>🎉 List an Event</Text>
            <Text style={styles.heroSubtitle}>Please sign in to create an event listing.</Text>
          </View>
          <View style={styles.panel}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/login' as any)} activeOpacity={0.85}>
              <Text style={styles.cancelText}>Go to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/browsebutton' as any);
  };

  const handleDateChange = (field: 'startDate' | 'endDate') => (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed' || !selectedDate) {
      setActiveDatePicker(null);
      return;
    }

    const nextValue = formatDateValue(selectedDate);
    if (field === 'startDate') {
      setEventDate(nextValue);
    } else {
      setEventEndDate(nextValue);
    }
    setActiveDatePicker(null);
  };

  const handleTimeChange = (field: 'startTime' | 'endTime') => (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed' || !selectedDate) {
      setActiveTimePicker(null);
      return;
    }

    const nextValue = formatTimeValue(selectedDate);
    if (field === 'startTime') {
      setEventStarttime(nextValue);
    } else {
      setEventEndtime(nextValue);
    }
    setActiveTimePicker(null);
  };

  const handleSubmit = async () => {
    const title = eventTitle.trim();
    const description = eventDescription.trim();
    const address = eventAdress.trim();
    const city = eventCity.trim();
    const state = eventState.trim().toUpperCase();
    const zip = eventZipcode.trim();
    const startTime = eventStarttime.trim();
    const endTime = eventEndtime.trim();
    const dateParsed = parseDate(eventDate);
    const endDateParsed = parseDate(eventEndDate);
    const startTimeParsed = parseTime(startTime);
    const endTimeParsed = parseTime(endTime);

    if (!title) {
      Alert.alert('Missing Field', 'Please enter an event title.');
      return;
    }
    if (!description) {
      Alert.alert('Missing Field', 'Please enter an event description.');
      return;
    }
    if (!dateParsed) {
      Alert.alert('Invalid Date', 'Event start date must be in xx/xx/xx, MM/DD/YYYY, or YYYY-MM-DD format.');
      return;
    }
    if (!endDateParsed) {
      Alert.alert('Invalid Date', 'Event end date must be in xx/xx/xx, MM/DD/YYYY, or YYYY-MM-DD format.');
      return;
    }
    if (endDateParsed < dateParsed) {
      Alert.alert('Invalid Date Range', 'Event end date must be on or after the start date.');
      return;
    }
    if (!startTime) {
      Alert.alert('Missing Field', 'Please enter a start time (e.g. 10:00).');
      return;
    }
    if (!endTime) {
      Alert.alert('Missing Field', 'Please enter an end time (e.g. 14:00).');
      return;
    }
    if (!startTimeParsed) {
      Alert.alert('Invalid Time', 'Start time must be in HH:MM format (e.g. 10:00).');
      return;
    }
    if (!endTimeParsed) {
      Alert.alert('Invalid Time', 'End time must be in HH:MM format (e.g. 14:00).');
      return;
    }
    if (!address || !city || !state || !zip) {
      Alert.alert('Missing Field', 'Please fill in the full event address (street, city, state, ZIP).');
      return;
    }
    if (images.length === 0) {
      Alert.alert('Missing Images', 'Please upload at least one photo for your event listing.');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'You must be signed in to list an event.');
      return;
    }
    if (!canPostListings) {
      Alert.alert('Account Action Required', postingBlockedReason || 'Your account is not eligible to post right now.');
      return;
    }

    try {
      setSubmitting(true);
      const db = getFirestore(app);
      const eventImage = images[0] ?? '';

      await addDoc(collection(db, 'events'), {
        eventTitle: title,
        eventDescription: description,
        eventDate: dateParsed,
        eventEndDate: endDateParsed,
        eventStarttime: startTimeParsed,
        eventEndtime: endTimeParsed,
        ticketPrice: ticketPrice.trim(),
        eventAdress: address,
        eventCity: city,
        eventState: state,
        eventZipcode: zip,
        eventWebsite: eventWebsite.trim(),
        eventImage,
        eventStatus: 'active',
        userName: profile?.displayName || user.displayName || user.email?.split('@')[0] || '',
        userId: user.uid,
        eventCreatedat: serverTimestamp(),
      });

      setPosted(true);
    } catch {
      Alert.alert('Error', 'Failed to submit event. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEventTitle('');
    setEventDescription('');
    setEventDate('');
    setEventEndDate('');
    setTicketPrice('');
    setEventStarttime('');
    setEventEndtime('');
    setEventAdress('');
    setEventCity('');
    setEventState('');
    setEventZipcode('');
    setEventWebsite('');
    setImages([]);
    setPosted(false);
  };

  if (posted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successWrapper}>
          <View style={styles.successCard}>
            <View style={styles.successCircle}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Event Listed!</Text>
            <Text style={styles.successMessage}>
              Your event is live and visible to the community. What would you like to do next?
            </Text>
            <View style={styles.successActions}>
              <TouchableOpacity
                style={styles.successPrimary}
                onPress={() => router.back()}
                activeOpacity={0.85}
              >
                <Text style={styles.successPrimaryText}>View Community</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.successSecondary}
                onPress={resetForm}
                activeOpacity={0.85}
              >
                <Text style={styles.successSecondaryText}>Post Another Event</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.successSecondary}
                onPress={handleBack}
                activeOpacity={0.85}
              >
                <Text style={styles.successSecondaryText}>Back to Events</Text>
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
          <Text style={styles.heroTitle}>🎉 List an Event</Text>
          <Text style={styles.heroSubtitle}>Share a local event with your community</Text>
        </View>

        <View style={styles.panel}>
          {!canPostListings ? (
            <Text style={styles.notice}>{postingBlockedReason}</Text>
          ) : null}
          <Text style={styles.sectionDivider}>EVENT DETAILS</Text>

          <FormInput
            label="Event Title"
            value={eventTitle}
            onChangeText={setEventTitle}
            required
            placeholder="e.g. Summer Festival 2026"
          />
          <FormInput
            label="Description"
            value={eventDescription}
            onChangeText={setEventDescription}
            required
            multiline
            placeholder="Tell people what this event is about..."
          />

          <Text style={styles.sectionDivider}>DATE &amp; TIME</Text>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.pickerLabel}>Event Start Date *</Text>
              {Platform.OS === 'web' ? (
                <FormInput
                  label=""
                  value={eventDate}
                  onChangeText={setEventDate}
                  required
                  placeholder="xx/xx/xx"
                />
              ) : (
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setActiveDatePicker('startDate')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.pickerButtonText, !eventDate ? styles.pickerPlaceholder : null]}>
                    {eventDate || 'Select start date'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.col}>
              <Text style={styles.pickerLabel}>Event End Date *</Text>
              {Platform.OS === 'web' ? (
                <FormInput
                  label=""
                  value={eventEndDate}
                  onChangeText={setEventEndDate}
                  required
                  placeholder="xx/xx/xx"
                />
              ) : (
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setActiveDatePicker('endDate')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.pickerButtonText, !eventEndDate ? styles.pickerPlaceholder : null]}>
                    {eventEndDate || 'Select end date'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {Platform.OS !== 'web' && activeDatePicker ? (
            <DateTimePicker
              value={getDatePickerDate(activeDatePicker === 'startDate' ? eventDate : eventEndDate)}
              mode="date"
              display="default"
              onChange={handleDateChange(activeDatePicker)}
            />
          ) : null}

          <View style={styles.row}>
            <View style={styles.col}>
              <FormInput
                label="Ticket Price"
                value={ticketPrice}
                onChangeText={setTicketPrice}
                placeholder="e.g. Free, $10, $5–$20"
              />
            </View>
            <View style={styles.col} />
          </View>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.pickerLabel}>Start Time *</Text>
              {Platform.OS === 'web' ? (
                <FormInput
                  label=""
                  value={eventStarttime}
                  onChangeText={setEventStarttime}
                  required
                  placeholder="10:00"
                />
              ) : (
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setActiveTimePicker('startTime')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.pickerButtonText, !eventStarttime ? styles.pickerPlaceholder : null]}>
                    {eventStarttime || 'Select start time'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.col}>
              <Text style={styles.pickerLabel}>End Time *</Text>
              {Platform.OS === 'web' ? (
                <FormInput
                  label=""
                  value={eventEndtime}
                  onChangeText={setEventEndtime}
                  required
                  placeholder="14:00"
                />
              ) : (
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setActiveTimePicker('endTime')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.pickerButtonText, !eventEndtime ? styles.pickerPlaceholder : null]}>
                    {eventEndtime || 'Select end time'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {Platform.OS !== 'web' && activeTimePicker ? (
            <DateTimePicker
              value={getTimePickerDate(activeTimePicker === 'startTime' ? eventStarttime : eventEndtime)}
              mode="time"
              is24Hour={true}
              display="default"
              onChange={handleTimeChange(activeTimePicker)}
            />
          ) : null}

          <Text style={styles.sectionDivider}>LOCATION</Text>

          <FormInput
            label="Street Address"
            value={eventAdress}
            onChangeText={setEventAdress}
            required
            placeholder="123 Main St"
          />

          <View style={styles.row}>
            <View style={styles.colFlex2}>
              <FormInput
                label="City"
                value={eventCity}
                onChangeText={setEventCity}
                required
                placeholder="Harrison"
              />
            </View>
            <View style={styles.colFixed70}>
              <FormInput
                label="State"
                value={eventState}
                onChangeText={(t) => setEventState(t.toUpperCase())}
                required
                placeholder="AR"
              />
            </View>
            <View style={styles.colFlex2}>
              <FormInput
                label="ZIP Code"
                value={eventZipcode}
                onChangeText={setEventZipcode}
                required
                placeholder="72601"
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={styles.sectionDivider}>ADDITIONAL INFO</Text>

          <FormInput
            label="Website / Link"
            value={eventWebsite}
            onChangeText={setEventWebsite}
            placeholder="https://... (optional)"
          />

          <Text style={styles.sectionDivider}>EVENT IMAGE *</Text>

          <ImageUploader images={images} onChange={setImages} />

          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !canPostListings) ? styles.submitDisabled : null]}
            onPress={handleSubmit}
            disabled={submitting || !canPostListings}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Event'}</Text>
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
  notice: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  sectionDivider: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7c3aed',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#ede9fe',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  colFlex2: {
    flex: 2,
  },
  colFixed70: {
    width: 70,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  pickerButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  pickerButtonText: {
    fontSize: 14,
    color: '#0f172a',
  },
  pickerPlaceholder: {
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
