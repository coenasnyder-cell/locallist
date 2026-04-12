import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type ReviewPayload = {
  rating: number;
  reviewText: string;
};

type UserReviewModalProps = {
  visible: boolean;
  title: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: ReviewPayload) => Promise<void> | void;
};

export default function UserReviewModal({
  visible,
  title,
  submitting,
  onClose,
  onSubmit,
}: UserReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  useEffect(() => {
    if (!visible) {
      setRating(0);
      setReviewText('');
    }
  }, [visible]);

  const canSubmit = rating >= 1 && reviewText.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({ rating, reviewText: reviewText.trim() });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.helper}>Your review will be visible after admin approval.</Text>

          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} disabled={submitting}>
                <Text style={[styles.star, star <= rating ? styles.starActive : null]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            multiline
            numberOfLines={4}
            maxLength={500}
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="Write your review"
            placeholderTextColor="#94a3b8"
            editable={!submitting}
            textAlignVertical="top"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={onClose} disabled={submitting}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.primary, !canSubmit ? styles.disabled : null]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  helper: {
    marginTop: 6,
    fontSize: 13,
    color: '#475569',
  },
  starRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  star: {
    fontSize: 28,
    color: '#cbd5e1',
  },
  starActive: {
    color: '#f59e0b',
  },
  input: {
    marginTop: 14,
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: {
    backgroundColor: '#f1f5f9',
  },
  secondaryText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  primary: {
    backgroundColor: '#0f766e',
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.5,
  },
});
