import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { app } from '../../firebase';

const numColumns = 2;
const screenWidth = Dimensions.get('window').width;
const cardMargin = 10;
const cardWidth = (screenWidth - cardMargin * (numColumns * 2 + 2)) / numColumns;

export default function SearchListings() {
	const [listings, setListings] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const router = useRouter();
	const params = useLocalSearchParams();
	const search = typeof params.search === 'string' ? params.search : Array.isArray(params.search) ? params.search[0] ?? '' : '';

	useEffect(() => {
		const fetchListings = async () => {
			try {
				const db = getFirestore(app);
				const q = query(collection(db, 'listings'));
				const snapshot = await getDocs(q);
				const fetched = snapshot.docs
					.map(doc => {
						const data = doc.data() as any;
						return { id: doc.id, ...data };
					})
					.filter(listing => {
						const matchesSearch =
							search.trim() === '' ||
							(listing.title && listing.title.toLowerCase().includes(search.toLowerCase())) ||
							(listing.subtitle && listing.subtitle.toLowerCase().includes(search.toLowerCase()));
						return matchesSearch && Array.isArray(listing.images) && listing.images.length > 0;
					});
				setListings(fetched);
			} catch (error) {
				setListings([]);
			} finally {
				setLoading(false);
			}
		};
		fetchListings();
	}, [search]);

	const handlePress = (id: string) => {
		router.push({ pathname: '/listing', params: { id } });
	};

	return (
		<View style={{ flex: 1 }}>
			<ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
			<Text style={styles.header}>Search Results</Text>
			{loading ? (
				<Text style={styles.loading}>Loading...</Text>
			) : listings.length === 0 ? (
				<Text style={styles.loading}>No listings found.</Text>
			) : (
				<View style={styles.gridContainer}>
					{listings.map(listing => (
						<TouchableOpacity style={styles.card} key={listing.id} onPress={() => handlePress(listing.id)} activeOpacity={0.8}>
							<Image
								source={{ uri: listing.images[0] }}
								style={styles.image}
								contentFit="cover"
							/>
							<Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
							{listing.sellerName ? (
								<Text style={styles.sellerText}>👤 {listing.sellerName}</Text>
							) : null}
							<Text style={styles.priceZip}>
								{listing.price ? `$${listing.price}` : ''}
								{listing.zipCode ? `  |  ${listing.zipCode}` : ''}
							</Text>
						</TouchableOpacity>
					))}
				</View>
			)}
		</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
	},
	scrollContent: {
		padding: 10,
		flexGrow: 1,
	},
	header: {
		fontSize: 20,
		fontWeight: 'bold',
		textAlign: 'center',
		marginVertical: 16,
		color: '#222', // Changed from #475569 to a darker shade
	},
	loading: {
		textAlign: 'center',
		color: '#888',
		fontSize: 16,
		marginTop: 32,
	},
	gridContainer: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
	},
	card: {
		width: cardWidth,
		backgroundColor: '#f8f8f8',
		borderRadius: 12,
		marginBottom: cardMargin * 2,
		marginHorizontal: cardMargin,
		padding: 10,
		alignItems: 'center',
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 4,
	},
	image: {
		width: cardWidth - 20,
		height: cardWidth - 20,
		borderRadius: 8,
		marginBottom: 8,
		backgroundColor: '#ddd',
	},
	title: {
		fontSize: 16,
		fontWeight: 'bold',
		color: '#222',
		marginBottom: 4,
		textAlign: 'center',
	},
	priceZip: {
		fontSize: 14,
		color: '#475569',
		textAlign: 'center',
	},
	sellerText: {
		fontSize: 13,
		color: '#374151',
		marginBottom: 4,
		textAlign: 'center',
	},
});
