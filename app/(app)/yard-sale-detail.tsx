import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ScreenTitleRow from '../../components/ScreenTitleRow';
import { app } from '../../firebase';

type YardSaleRecord = {
  id: string;
  yardsaleImage?: string;
  yardsaleImages?: string[];
  yardsaleTitle?: string;
  yardsaleDescription?: string;
  yardsaleDate?: unknown;
  yardsaleEndDate?: unknown;
  yardsaleExpires?: unknown;
  yardsaleStart?: string;
  yardsaleEndtime?: string;
  yardsaleAddress?: string;
  yardsaleCity?: string;
  yardsaleState?: string;
  yardsaleZipcode?: string;
  yardsalelocation?: string;
  yardsaleCreatedat?: unknown;
  yardsalestatus?: string;
  userName?: string;
};

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: unknown): string {
  const date = normalizeDate(value);
  if (!date) return 'TBD';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateRange(startValue: unknown, endValue: unknown): string {
  const startDate = normalizeDate(startValue);
  const endDate = normalizeDate(endValue);
  if (!startDate && !endDate) return 'Date TBD';
  if (startDate && !endDate) return formatDate(startDate);
  if (!startDate && endDate) return formatDate(endDate);
  const startText = formatDate(startDate as Date);
  const endText = formatDate(endDate as Date);
  if (startText === endText) return startText;
  return `${startText} – ${endText}`;
}

function getDisplayLocation(sale: YardSaleRecord): string {
  const address = String(sale.yardsaleAddress || '').trim();
  const city = String(sale.yardsaleCity || '').trim();
  const state = String(sale.yardsaleState || '').trim();
  const zip = String(sale.yardsaleZipcode || '').trim();
  const structured = [address, [city, state].filter(Boolean).join(', '), zip]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+,/g, ',');
  return structured || String(sale.yardsalelocation || '').trim() || 'Location TBD';
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const GALLERY_WIDTH = SCREEN_WIDTH - 28;

export default function YardSaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sale, setSale] = useState<YardSaleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    if (!id) return;
    const fetchSale = async () => {
      try {
        const db = getFirestore(app);
        const snap = await getDoc(doc(db, 'yardSales', id));
        if (snap.exists()) {
          setSale({ id: snap.id, ...(snap.data() as Omit<YardSaleRecord, 'id'>) });
        }
      } catch (e) {
        console.error('Error fetching yard sale:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSale();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#475569" />
      </View>
    );
  }

  if (!sale) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Yard sale not found.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allImages =
    sale.yardsaleImages && sale.yardsaleImages.length > 0
      ? sale.yardsaleImages
      : sale.yardsaleImage
        ? [sale.yardsaleImage]
        : [];

  const dateLabel = formatDateRange(sale.yardsaleDate, sale.yardsaleEndDate || sale.yardsaleExpires);
  const timeText = sale.yardsaleStart
    ? `${sale.yardsaleStart}${sale.yardsaleEndtime ? ` – ${sale.yardsaleEndtime}` : ''}`
    : 'Time TBD';
  const locationLabel = getDisplayLocation(sale);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.screenTitleRowWrap}>
        <ScreenTitleRow
          title="Yard Sale"
          onBackPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace('/(app)/yardsalelistings' as any);
          }}
        />
      </View>

      {/* Image Gallery */}
      {allImages.length > 0 ? (
        <View style={styles.galleryWrap}>
          <FlatList
            data={allImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / GALLERY_WIDTH);
              setActiveImageIndex(index);
            }}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.galleryImage} contentFit="cover" />
            )}
          />
          {allImages.length > 1 && (
            <View style={styles.dotRow}>
              {allImages.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === activeImageIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.noImagePlaceholder}>
          <Text style={styles.noImageText}>No Photos</Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.body}>
        <Text style={styles.title}>{sale.yardsaleTitle || 'Yard Sale'}</Text>

        {sale.userName ? (
          <Text style={styles.postedBy}>Posted by {sale.userName}</Text>
        ) : null}

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{dateLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{timeText}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={styles.detailValue}>{locationLabel}</Text>
          </View>
        </View>

        {sale.yardsaleDescription ? (
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionLabel}>Details</Text>
            <Text style={styles.descriptionText}>{sale.yardsaleDescription}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#475569',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  screenTitleRowWrap: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  galleryWrap: {
    marginHorizontal: 14,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
  },
  galleryImage: {
    width: GALLERY_WIDTH,
    height: 180,
    backgroundColor: '#e2e8f0',
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cbd5e1',
  },
  dotActive: {
    backgroundColor: '#475569',
  },
  noImagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  postedBy: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  detailValue: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  descriptionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 14,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
  footer: {
    height: 40,
  },
});
