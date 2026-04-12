import FormInput from '@/components/FormInput';
import { useAccountStatus } from '@/hooks/useAccountStatus';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { app } from '../../firebase';

const DEAL_CATEGORIES = ['Business Deal', 'Service Provider', 'Admin Deal'];

function parseDateInput(value: string): Date | null {
  const normalized = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDatePickerDate(value: string): Date {
  return parseDateInput(value) ?? new Date();
}

export default function CreateDealListingScreen() {
  const router = useRouter();
  const { user, profile, loading, isAdmin, isBusinessAccount, canPostListings, postingBlockedReason } = useAccountStatus();
  const waitingForProfile = !!user && !profile;
  const hasBusinessAccess = !!user && (isBusinessAccount || isAdmin);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dealCategory, setDealCategory] = useState('Business Deal');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeDatePicker, setActiveDatePicker] = useState<'startDate' | 'endDate' | null>(null);
  const [isFeatured, setIsFeatured] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [posted, setPosted] = useState(false);

  const allowedCategories = useMemo(() => {
    return isAdmin ? DEAL_CATEGORIES : DEAL_CATEGORIES.filter((item) => item !== 'Admin Deal');
  }, [isAdmin]);

  if (loading || waitingForProfile) {
    return null;
  }

  if (!hasBusinessAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.title}>Create A Deal</Text>
            <Text style={styles.subtitle}>Deal posting is available for business and admin accounts only.</Text>
          </View>
          <View style={styles.panel}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => router.replace('/(tabs)/index' as any)} activeOpacity={0.85}>
              <Text style={styles.cancelBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/post-promote' as any);
  };

  const handleDateChange = (field: 'startDate' | 'endDate') => (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed' || !selectedDate) {
      setActiveDatePicker(null);
      return;
    }

    const nextValue = formatDateValue(selectedDate);
    if (field === 'startDate') {
      setStartDate(nextValue);
    } else {
      setEndDate(nextValue);
    }
    setActiveDatePicker(null);
  };

  const handleSubmit = async () => {
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();
    const startAt = parseDateInput(startDate);
    const endAt = parseDateInput(endDate);

    if (!normalizedTitle || !normalizedDescription || !dealCategory || !startAt || !endAt) {
      Alert.alert('Missing Fields', 'Please complete all required deal fields. Dates must be in YYYY-MM-DD format.');
      return;
    }

    if (!allowedCategories.includes(dealCategory)) {
      Alert.alert('Invalid Category', 'You do not have access to post this type of deal.');
      return;
    }

    if (startAt.getTime() > endAt.getTime()) {
      Alert.alert('Invalid Dates', 'End date must be the same as or later than the start date.');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Error', 'You must be signed in to post a deal.');
      return;
    }
    if (!canPostListings) {
      Alert.alert('Account Action Required', postingBlockedReason || 'Your account is not eligible to post right now.');
      return;
    }

    try {
      setSubmitting(true);
      const db = getFirestore(app);

      await addDoc(collection(db, 'deals'), {
        userId: user.uid,
        businessId: user.uid,
        title: normalizedTitle,
        dealTitle: normalizedTitle,
        dealsTitle: normalizedTitle,
        description: normalizedDescription,
        dealDescription: normalizedDescription,
        dealsDescription: normalizedDescription,
        category: dealCategory,
        dealCategory,
        dealsCategory: dealCategory,
        status: 'pending',
        dealsStatus: 'pending',
        approvalStatus: 'pending',
        isApproved: false,
        startDate: startAt,
        endDate: endAt,
        dealsStartdate: startAt,
        dealsEnddate: endAt,
        isFeatured,
        dealsisFeatured: isFeatured,
        dealsClicks: 0,
        dealsViews: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setPosted(true);
    } catch {
      Alert.alert('Error', 'Could not post the deal. Please try again.');
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
            <Text style={styles.successTitle}>Deal Posted!</Text>
            <Text style={styles.successMessage}>
              Your deal was submitted for approval. It will appear once approved. What would you like to do next?
            </Text>
            <View style={styles.successActions}>
              <TouchableOpacity
                style={styles.successPrimary}
                onPress={() => router.replace('/(tabs)/businesshubbutton' as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.successPrimaryText}>Back to Business Hub</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.successSecondary}
                onPress={() => {
                  setPosted(false);
                  setTitle('');
                  setDescription('');
                  setDealCategory('Business Deal');
                  setStartDate('');
                  setEndDate('');
                  setIsFeatured(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.successSecondaryText}>Post Another Deal</Text>
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
          <Text style={styles.title}>Create A Deal</Text>
          <Text style={styles.subtitle}>
            Post deals for businesses and service providers. This form writes directly to your deals collection.
          </Text>
        </View>

        <View style={styles.panel}>
          {!canPostListings ? (
            <Text style={styles.notice}>{postingBlockedReason}</Text>
          ) : null}
          <FormInput
            label="Deal Title"
            value={title}
            onChangeText={setTitle}
            required
            placeholder="Weekend patio sale"
          />
          <FormInput
            label="Deal Description"
            value={description}
            onChangeText={setDescription}
            required
            multiline
            placeholder="Describe the offer, who it's for, and any important conditions."
          />
          <FormInput
            label="Deal Category"
            value={dealCategory}
            onChangeText={setDealCategory}
            required
            type="picker"
            options={allowedCategories}
            placeholder="Select a deal category"
            dropdownZIndex={2000}
          />
          <Text style={styles.dateLabel}>Start Date *</Text>
          {Platform.OS === 'web' ? (
            <FormInput
              label=""
              value={startDate}
              onChangeText={setStartDate}
              required
              placeholder="YYYY-MM-DD"
            />
          ) : (
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setActiveDatePicker('startDate')}
              activeOpacity={0.85}
            >
              <Text style={[styles.datePickerButtonText, !startDate ? styles.datePickerPlaceholder : null]}>
                {startDate || 'Select start date'}
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.dateLabel}>End Date *</Text>
          {Platform.OS === 'web' ? (
            <FormInput
              label=""
              value={endDate}
              onChangeText={setEndDate}
              required
              placeholder="YYYY-MM-DD"
            />
          ) : (
            <TouchableOpacity
              style={styles.datePickerButton}
              onPress={() => setActiveDatePicker('endDate')}
              activeOpacity={0.85}
            >
              <Text style={[styles.datePickerButtonText, !endDate ? styles.datePickerPlaceholder : null]}>
                {endDate || 'Select end date'}
              </Text>
            </TouchableOpacity>
          )}

          {Platform.OS !== 'web' && activeDatePicker ? (
            <DateTimePicker
              value={getDatePickerDate(activeDatePicker === 'startDate' ? startDate : endDate)}
              mode="date"
              display="default"
              onChange={handleDateChange(activeDatePicker)}
            />
          ) : null}

          {isAdmin ? (
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsFeatured((current) => !current)} activeOpacity={0.85}>
              <View style={[styles.checkbox, isFeatured ? styles.checkboxChecked : null]}>
                {isFeatured ? <Text style={styles.checkboxCheck}>✓</Text> : null}
              </View>
              <Text style={styles.checkboxLabel}>Mark as featured deal</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, (submitting || !canPostListings) ? styles.buttonDisabled : null]}
            onPress={handleSubmit}
            disabled={submitting || !canPostListings}
          >
            <Text style={styles.primaryBtnText}>{submitting ? 'Posting...' : 'Post Deal'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleBack} activeOpacity={0.85}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
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
    paddingBottom: 28,
    gap: 12,
  },
  hero: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f0d8b2',
    borderRadius: 14,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
  },
  panel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 16,
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
  dateLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  datePickerButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginBottom: 12,
  },
  datePickerButtonText: {
    fontSize: 15,
    color: '#111827',
  },
  datePickerPlaceholder: {
    color: '#9ca3af',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#d97706',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#d97706',
  },
  checkboxCheck: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  checkboxLabel: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#d97706',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  cancelBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#eef2f7',
  },
  cancelBtnText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '700',
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
    backgroundColor: '#d97706',
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
    backgroundColor: '#eef2f7',
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
