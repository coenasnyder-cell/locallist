import { Feather } from '@expo/vector-icons';
import { collection, deleteDoc, doc, getDocs, getFirestore, onSnapshot, query, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { app } from '../firebase';
import ImageUploader from './ImageUploader';

interface NewsItem {
  id: string;
  title: string;
  description?: string;
  story?: string;
  excerpt?: string;
  image?: string;
  date: string;
  category?: string;
  callToAction?: string;
  isSpotlight?: boolean;
}

interface CommunityDisplaySettings {
  showSpotlight: boolean;
  showNews: boolean;
  showEditorsPicks: boolean;
  showFeaturedListings: boolean;
}

const DEFAULT_DISPLAY_SETTINGS: CommunityDisplaySettings = {
  showSpotlight: true,
  showNews: false,
  showEditorsPicks: true,
  showFeaturedListings: true,
};

export default function AdminCommunityNews({ onBack }: { onBack?: () => void }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<NewsItem>>({
    title: '',
    story: '',
    image: '',
    callToAction: '',
    isSpotlight: false,
    date: new Date().toISOString().split('T')[0],
  });
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [displaySettings, setDisplaySettings] = useState<CommunityDisplaySettings>(DEFAULT_DISPLAY_SETTINGS);

  useEffect(() => {
    const db = getFirestore(app);
    const newsRef = collection(db, 'community_news');
    const settingsRef = doc(db, 'community_settings', 'display');
    
    const unsubscribe = onSnapshot(newsRef, (snapshot) => {
      const data: NewsItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<NewsItem, 'id'>),
      }));
      setNews(data);
      setLoading(false);
    });

    const unsubscribeSettings = onSnapshot(settingsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setDisplaySettings(DEFAULT_DISPLAY_SETTINGS);
        return;
      }
      const data = snapshot.data() as Partial<CommunityDisplaySettings>;
      setDisplaySettings({
        showSpotlight: data.showSpotlight ?? DEFAULT_DISPLAY_SETTINGS.showSpotlight,
        showNews: data.showNews ?? DEFAULT_DISPLAY_SETTINGS.showNews,
        showEditorsPicks: data.showEditorsPicks ?? DEFAULT_DISPLAY_SETTINGS.showEditorsPicks,
        showFeaturedListings: data.showFeaturedListings ?? DEFAULT_DISPLAY_SETTINGS.showFeaturedListings,
      });
    });

    return () => {
      unsubscribe();
      unsubscribeSettings();
    };
  }, []);

  const updateDisplaySetting = async (key: keyof CommunityDisplaySettings, value: boolean) => {
    try {
      const db = getFirestore(app);
      const settingsRef = doc(db, 'community_settings', 'display');
      await setDoc(settingsRef, { [key]: value }, { merge: true });
    } catch (error) {
      console.error('Error updating display setting:', error);
      Alert.alert('Error', 'Failed to update section visibility');
    }
  };

  const toDateInputValue = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value.toDate === 'function') {
      return value.toDate().toISOString().split('T')[0];
    }
    if (typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000).toISOString().split('T')[0];
    }
    return String(value);
  };

  const formatDisplayDate = (value: any) => {
    const dateString = toDateInputValue(value);
    if (!dateString) return '';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return dateString;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleSave = async () => {
    if (!formData.title || !formData.date) {
      Alert.alert('Error', 'Title and date are required');
      return;
    }

    if (formData.isSpotlight && !formData.story?.trim()) {
      Alert.alert('Error', 'Spotlight posts require a story.');
      return;
    }

    try {
      const db = getFirestore(app);
      const payload: Partial<NewsItem> = {
        title: formData.title?.trim(),
        date: formData.date?.trim(),
        isSpotlight: !!formData.isSpotlight,
      };
      const storyValue = formData.story?.trim();
      const ctaValue = formData.callToAction?.trim();
      if (storyValue) payload.story = storyValue;
      if (ctaValue) payload.callToAction = ctaValue;
      if (imageUris[0]) payload.image = imageUris[0];

      // Keep only one active spotlight article at a time.
      if (payload.isSpotlight) {
        const activeSpotlightQuery = query(
          collection(db, 'community_news'),
          where('isSpotlight', '==', true)
        );
        const activeSpotlights = await getDocs(activeSpotlightQuery);
        const batch = writeBatch(db);

        activeSpotlights.docs.forEach((spotlightDoc) => {
          if (spotlightDoc.id !== editingId) {
            batch.update(spotlightDoc.ref, { isSpotlight: false });
          }
        });

        if (editingId) {
          const docRef = doc(db, 'community_news', editingId);
          batch.update(docRef, payload);
          await batch.commit();
          Alert.alert('Success', 'Post updated');
        } else {
          const newId = doc(collection(db, 'community_news')).id;
          const docRef = doc(db, 'community_news', newId);
          batch.set(docRef, {
            ...payload,
            createdAt: new Date().toISOString(),
          });
          await batch.commit();
          Alert.alert('Success', 'Post created');
        }

        setShowModal(false);
        resetForm();
        return;
      }
      
      if (editingId) {
        // Update existing
        const docRef = doc(db, 'community_news', editingId);
        await updateDoc(docRef, payload);
        Alert.alert('Success', 'Post updated');
      } else {
        // Create new
        const newId = doc(collection(db, 'community_news')).id;
        const docRef = doc(db, 'community_news', newId);
        await setDoc(docRef, {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        Alert.alert('Success', 'Post created');
      }

      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving post:', error);
      Alert.alert('Error', 'Failed to save post');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            const db = getFirestore(app);
            const docRef = doc(db, 'community_news', id);
            await deleteDoc(docRef);
            Alert.alert('Success', 'Post deleted');
          } catch (error) {
            console.error('Error deleting post:', error);
            Alert.alert('Error', 'Failed to delete post');
          }
        },
      },
    ]);
  };

  const handleEdit = (item: NewsItem) => {
    setFormData({
      title: item.title || '',
      story: item.story || '',
      image: typeof item.image === 'string' ? item.image : '',
      callToAction: item.callToAction || '',
      isSpotlight: !!item.isSpotlight,
      date: toDateInputValue(item.date) || new Date().toISOString().split('T')[0],
    });
    setEditingId(item.id);
    setImageUris(item.image ? [item.image] : []);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      story: '',
      image: '',
      callToAction: '',
      isSpotlight: false,
      date: new Date().toISOString().split('T')[0],
    });
    setImageUris([]);
    setEditingId(null);
  };

  const renderNewsItem = ({ item }: { item: NewsItem }) => (
    <View style={styles.newsCard}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.newsTitle}>{item.title}</Text>
          <Text style={styles.newsDate}>{formatDisplayDate(item.date)}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => handleEdit(item)} style={styles.iconBtn}>
            <Feather name="edit" size={18} color="#475569" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}>
            <Feather name="trash-2" size={18} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.cardType}>
        {item.isSpotlight || item.story ? '⭐ Spotlight' : '📰 News'}
      </Text>
      {item.callToAction && <Text style={styles.cardCategory}>Has CTA</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#475569" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Community Posts</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            resetForm();
            setShowModal(true);
          }}
        >
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.sectionControls}>
        <Text style={styles.sectionControlsTitle}>Section Visibility</Text>
        <TouchableOpacity
          style={styles.sectionToggleRow}
          onPress={() => updateDisplaySetting('showSpotlight', !displaySettings.showSpotlight)}
          activeOpacity={0.8}
        >
          <Feather
            name={displaySettings.showSpotlight ? 'toggle-right' : 'toggle-left'}
            size={24}
            color={displaySettings.showSpotlight ? '#2E7D32' : '#999'}
          />
          <Text style={styles.sectionToggleText}>Show Community Spotlight</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sectionToggleRow}
          onPress={() => updateDisplaySetting('showNews', !displaySettings.showNews)}
          activeOpacity={0.8}
        >
          <Feather
            name={displaySettings.showNews ? 'toggle-right' : 'toggle-left'}
            size={24}
            color={displaySettings.showNews ? '#2E7D32' : '#999'}
          />
          <Text style={styles.sectionToggleText}>Show Community News</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sectionToggleRow}
          onPress={() => updateDisplaySetting('showEditorsPicks', !displaySettings.showEditorsPicks)}
          activeOpacity={0.8}
        >
          <Feather
            name={displaySettings.showEditorsPicks ? 'toggle-right' : 'toggle-left'}
            size={24}
            color={displaySettings.showEditorsPicks ? '#2E7D32' : '#999'}
          />
          <Text style={styles.sectionToggleText}>Show Editor's Picks</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sectionToggleRow}
          onPress={() => updateDisplaySetting('showFeaturedListings', !displaySettings.showFeaturedListings)}
          activeOpacity={0.8}
        >
          <Feather
            name={displaySettings.showFeaturedListings ? 'toggle-right' : 'toggle-left'}
            size={24}
            color={displaySettings.showFeaturedListings ? '#2E7D32' : '#999'}
          />
          <Text style={styles.sectionToggleText}>Show Featured Listings</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text>Loading...</Text>
        </View>
      ) : news.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="inbox" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>No posts yet</Text>
          <Text style={styles.emptyStateSubText}>Tap + to create your first post</Text>
        </View>
      ) : (
        <FlatList
          data={news}
          keyExtractor={(item) => item.id}
          renderItem={renderNewsItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Modal */}
      <Modal visible={showModal} animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowModal(false);
                resetForm();
              }}
            >
              <Feather name="x" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingId ? 'Edit Post' : 'Create Post'}
            </Text>
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.formGroup}>
              <Text style={styles.label}>Image</Text>
              <ImageUploader
                images={imageUris}
                onChange={(images) => setImageUris(images.slice(-1))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Community Spotlight: Cressie's Finds"
                value={formData.title ?? ''}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Date *</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={formData.date ?? ''}
                onChangeText={(text) => setFormData({ ...formData, date: text })}
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Post Type</Text>
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setFormData({ ...formData, isSpotlight: !formData.isSpotlight })}
                activeOpacity={0.8}
              >
                <Feather
                  name={formData.isSpotlight ? 'check-square' : 'square'}
                  size={18}
                  color={formData.isSpotlight ? '#475569' : '#999'}
                />
                <Text style={styles.toggleText}>Feature this as Community Spotlight</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Story</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Write the full story here"
                value={formData.story ?? ''}
                onChangeText={(text) => setFormData({ ...formData, story: text })}
                placeholderTextColor="#999"
                multiline
                numberOfLines={6}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Call to Action (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Want to nominate someone? Message us!"
                value={formData.callToAction ?? ''}
                onChangeText={(text) => setFormData({ ...formData, callToAction: text })}
                placeholderTextColor="#999"
              />
              <Text style={styles.helperText}>Only shows on spotlight posts</Text>
            </View>

            <View style={styles.saveFooter}>
              <TouchableOpacity onPress={handleSave} style={styles.saveFooterBtn}>
                <Text style={styles.saveFooterText}>Save Post</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 12,
    paddingBottom: 24,
  },
  sectionControls: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  sectionControlsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 10,
  },
  sectionToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  sectionToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  newsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  newsDate: {
    fontSize: 12,
    color: '#999',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    padding: 8,
  },
  cardType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
  },
  cardCategory: {
    fontSize: 11,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
  },
  emptyStateSubText: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  saveFooter: {
    marginTop: 8,
    marginBottom: 24,
  },
  saveFooterBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveFooterText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  modalContent: {
    paddingHorizontal: 16,
  },
  modalContentContainer: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#333',
  },
  textarea: {
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  helperText: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
});
