import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { app } from '../firebase';

import { useRouter } from 'expo-router';
import { useAccountStatus } from '../hooks/useAccountStatus';
import { isUserBlocked } from '../utils/blockService';
import { filterListingsWithExistingUsers } from '../utils/listingOwners';
import { isListingVisible } from '../utils/listingVisibility';
import FeaturedListings from './FeaturedListings';
import GridListingCard from './GridListingCard';

const CATEGORIES = [
	'All',
	'Home Goods',
	'Handmade Gifts',
	'Furniture',
	'Clothing',
	'Baby & Kids',
	'Outdoors',
	'Autos',
	'Electronics',
	'Tools',
	'Other',
];

type CommunityDisplaySettings = {
	showEditorsPicks: boolean;
	showFeaturedListings: boolean;
};

const DEFAULT_DISPLAY_SETTINGS: CommunityDisplaySettings = {
	showEditorsPicks: true,
	showFeaturedListings: true,
};

export default function BrowseComp() {
	const [listings, setListings] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState('');
	const [selectedCategory, setSelectedCategory] = useState('All');
	const [showDropdown, setShowDropdown] = useState(false);
	const [displaySettings, setDisplaySettings] = useState<CommunityDisplaySettings | null>(null);
	const router = useRouter();
	const { user, profile } = useAccountStatus();

	useEffect(() => {
		const fetchDisplaySettings = async () => {
			try {
				const db = getFirestore(app);
				const settingsRef = doc(db, 'community_settings', 'display');
				const settingsSnapshot = await getDoc(settingsRef);
				const settingsData = settingsSnapshot.exists()
					? (settingsSnapshot.data() as Partial<CommunityDisplaySettings>)
					: {};

				const newSettings = {
					showEditorsPicks: settingsData.showEditorsPicks ?? DEFAULT_DISPLAY_SETTINGS.showEditorsPicks,
					showFeaturedListings: settingsData.showFeaturedListings ?? DEFAULT_DISPLAY_SETTINGS.showFeaturedListings,
				};
				console.log('Display settings fetched (Browse):', newSettings);
				setDisplaySettings(newSettings);
			} catch (error) {
				console.error('Error fetching display settings (Browse):', error);
				// Silently use defaults if fetch fails (e.g., when not logged in)
				setDisplaySettings(DEFAULT_DISPLAY_SETTINGS);
			}
		};

		const fetchListings = async () => {
			setLoading(true);
			try {
				const db = getFirestore(app);
				const [querySnapshot, reportedSnapshot] = await Promise.all([
					getDocs(query(collection(db, 'listings'), where('status', '==', 'approved'))),
					getDocs(query(collection(db, 'reportedListings'), where('status', 'in', ['pending', 'reviewed', 'action_taken']))),
				]);

				const excludedListingIds = new Set(
					reportedSnapshot.docs
						.map((reportDoc) => String(reportDoc.data()?.listingId || '').trim())
						.filter(Boolean)
				);

				const nowMs = Date.now();
				const fetchedListings: any[] = [];
				querySnapshot.forEach((docSnap) => {
					const data = docSnap.data();
					if (!isListingVisible(data, docSnap.id, { nowMs, excludedListingIds })) {
						return;
					}
					fetchedListings.push({ id: docSnap.id, ...data });
				});
				const listingsWithExistingOwners = await filterListingsWithExistingUsers(db, fetchedListings);
				setListings(listingsWithExistingOwners);
			} catch (error) {
				console.error('Error fetching listings:', error);
			}
			setLoading(false);
		};
		fetchDisplaySettings();
		fetchListings();
	}, []);

	const filteredListings = listings.filter(item => {
		const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
		const matchesSearch =
			search.trim() === '' ||
			(item.title && item.title.toLowerCase().includes(search.toLowerCase())) ||
			(item.subtitle && item.subtitle.toLowerCase().includes(search.toLowerCase()));
		const notBlocked = !item.userId || !isUserBlocked(profile, item.userId);
		return matchesCategory && matchesSearch && notBlocked;
	});

	const editorsPicks = listings.filter(item => item.editorsPick === true && Array.isArray(item.images) && item.images.length > 0);
	const listingsSectionTitle = selectedCategory === 'All' ? 'All Listings' : `${selectedCategory} Listings`;

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={{ paddingBottom: 24 }}
			nestedScrollEnabled
		>
			<View style={styles.marketplaceTitleRow}>
				<Text style={styles.marketplaceTitleText}>Local List Marketplace</Text>
			</View>

			{displaySettings?.showEditorsPicks && (
				<>
					{/* Editor's Picks Section */}
					<FeaturedListings 
						tier="basic"
						title="Editor's Picks"
						subtitle="Hand-selected for you"
						onListingPress={(listingId) => router.push({ pathname: '/listing', params: { id: listingId } })}
					/>
					{editorsPicks.length > 0 && (
						<View style={styles.editorsPicksContainer}>
							<Text style={styles.editorsPicksHeader}>Editor's Picks</Text>
							<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.editorsPicksScroll}>
								{editorsPicks.map(listing => (
									<TouchableOpacity
										key={listing.id}
										onPress={() => router.push({ pathname: '/listing', params: { id: listing.id } })}
										activeOpacity={0.8}
										style={styles.editorsPicksCard}
									>
										<Image
											source={{ uri: listing.images[0] }}
											style={styles.editorsPicksImage}
											resizeMode="cover"
										/>
										<Text style={styles.editorsPicksTitle} numberOfLines={1}>{listing.title}</Text>
									</TouchableOpacity>
								))}
							</ScrollView>
						</View>
					)}
				</>
			)}

			<View style={styles.topControlsRow}>
				<View style={styles.leftControlGroup}>
					<Text style={styles.searchSubtitle}></Text>
					<View style={styles.searchBarContainer}>
						<TextInput
							style={styles.searchBar}
							placeholder="Search listings..."
							placeholderTextColor="#444"
							value={search}
							onChangeText={setSearch}
							returnKeyType="search"
						/>
					</View>
				</View>
			</View>

			<View style={styles.listHubHighlightCard}>
				<Image
					source={require('../assets/images/listhub.png')}
					style={styles.listHubHighlightImage}
					resizeMode="cover"
				/>
				<View style={styles.listHubHighlightTextWrap}>
					<TouchableOpacity
						style={styles.listHubHighlightButton}
						onPress={() => router.push('/create-listing' as any)}
					>
						<Text style={styles.listHubHighlightButtonText}>List Your Items</Text>
					</TouchableOpacity>
				</View>
			</View>

		{/* Premium Featured Listings Section */}
		{displaySettings?.showFeaturedListings && (
			<>
				<FeaturedListings 
					tier="premium"
					title="✨ Featured"
					subtitle="Top picks from our community"
					onListingPress={(listingId) => router.push({ pathname: '/listing', params: { id: listingId } })}
				/>
				<View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
					<TouchableOpacity
						style={{
							backgroundColor: '#475569',
							borderRadius: 8,
							paddingVertical: 10,
							paddingHorizontal: 16,
							alignSelf: 'center',
							minWidth: 220,
						}}
						onPress={() => router.push('/featured-listings' as any)}
					>
						<Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: 14 }}>
							View All Featured Listings
						</Text>
					</TouchableOpacity>
				</View>
			</>
		)}

			<View style={styles.categoryRow}>
				<Text style={styles.categorySubtitle}>Choose a category</Text>
				<View style={styles.dropdownContainer}>
					<TouchableOpacity
						style={styles.dropdownButton}
						onPress={() => setShowDropdown(!showDropdown)}
						activeOpacity={0.7}
					>
						<Text style={styles.dropdownButtonText}>{selectedCategory}</Text>
						<Ionicons
							name={showDropdown ? 'chevron-up' : 'chevron-down'}
							size={20}
							color="#475569"
						/>
					</TouchableOpacity>

					{showDropdown && (
						<View style={styles.dropdownMenu}>
							<ScrollView
								style={styles.dropdownMenuScroll}
								nestedScrollEnabled
								showsVerticalScrollIndicator
							>
								{CATEGORIES.map((category) => (
									<TouchableOpacity
										key={category}
										style={[
											styles.dropdownMenuItem,
											selectedCategory === category && styles.dropdownMenuItemActive,
										]}
										onPress={() => {
											setSelectedCategory(category);
											setShowDropdown(false);
										}}
										activeOpacity={0.7}
									>
										<Text
											style={[
												styles.dropdownMenuItemText,
												selectedCategory === category && styles.dropdownMenuItemTextActive,
											]}
										>
											{category}
										</Text>
									</TouchableOpacity>
								))}
							</ScrollView>
						</View>
					)}
				</View>
			</View>

			<Text style={styles.listingsSectionTitle}>{listingsSectionTitle}</Text>

			{/* Listings Grid */}
			{loading ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#475569" />
				</View>
			) : filteredListings.length > 0 ? (
				<View style={styles.listingsGridContainer}>
					<View style={styles.listingsGrid}>
						{filteredListings.map((listing) => {
							const createdAtMs = listing.createdAt
								? (listing.createdAt.toMillis ? listing.createdAt.toMillis() : new Date(listing.createdAt).getTime())
								: undefined;

							return (
								<View key={listing.id} style={styles.listingCard}>
									<GridListingCard
										title={listing.title || ''}
										price={String(listing.price ?? '')}
										category={listing.category}
										viewCount={typeof listing.viewCount === 'number' ? listing.viewCount : undefined}
										sellerName={listing.sellerName}
										createdAt={createdAtMs}
										city={listing.city}
										location={listing.location || listing.zipCode}
										isFeatured={Boolean(listing.isFeatured)}
										imageSource={Array.isArray(listing.images) && listing.images[0] ? { uri: listing.images[0] } : undefined}
										onPress={() => router.push({
											pathname: '/listing',
											params: { id: listing.id }
										})}
									/>
								</View>
							);
						})}
					</View>
				</View>
			) : (
				<View style={styles.noResultsContainer}>
					<Text style={styles.noResultsText}>No listings found in this category</Text>
				</View>
			)}
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f8f8f8',
		paddingTop: 16,
	},
	topControlsRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 12,
		paddingHorizontal: 16,
		marginBottom: 12,
		justifyContent: 'center',
	},
	leftControlGroup: {
		width: '100%',
		maxWidth: 330,
	},
	rightControlGroup: {
		flex: 1,
	},
	searchBarContainer: {
		marginBottom: 0,
		width: '100%',
	},
	categorySubtitle: {
		fontSize: 14,
		fontWeight: '600',
		color: '#475569',
		paddingHorizontal: 0,
		marginBottom: 6,
		textAlign: 'center',
	},
	searchSubtitle: {
		fontSize: 14,
		fontWeight: '600',
		color: '#475569',
		paddingHorizontal: 0,
		marginBottom: 6,
		textAlign: 'center',
	},
	searchBar: {
		backgroundColor: '#fff',
		borderRadius: 8,
		paddingVertical: 12,
		paddingHorizontal: 16,
		fontSize: 15,
		borderWidth: 1,
		borderColor: '#ddd',
	},
	categoryRow: {
		paddingHorizontal: 16,
		marginBottom: 12,
		alignItems: 'center',
	},
	marketplaceTitleRow: {
		marginHorizontal: 16,
		marginTop: 10,
		marginBottom: 4,
		alignItems: 'center',
	},
	marketplaceTitleText: {
		fontSize: 22,
		fontWeight: '800',
		color: '#475569',
		textAlign: 'center',
	},
	listHubHighlightCard: {
		marginHorizontal: 16,
		marginTop: 12,
		marginBottom: 14,
		backgroundColor: '#fff7ed',
		borderRadius: 14,
		borderWidth: 1,
		borderColor: '#fed7aa',
		overflow: 'hidden',
	},
	listHubHighlightImage: {
		width: '100%',
		height: 100,
	},
	listHubHighlightTextWrap: {
		padding: 14,
		alignItems: 'center',
	},
	listHubHighlightTitle: {
		fontSize: 20,
		fontWeight: '800',
		color: '#ffffff',
		marginBottom: 6,
		textAlign: 'center',
	},
	listHubHighlightBody: {
		fontSize: 13,
		lineHeight: 19,
		color: '#ffffff',
		marginBottom: 12,
		textAlign: 'center',
	},
	listHubHighlightButton: {
		alignSelf: 'center',
		backgroundColor: '#475569',
		borderRadius: 8,
		paddingVertical: 10,
		paddingHorizontal: 14,
	},
	listHubHighlightButtonText: {
		fontSize: 14,
		fontWeight: '700',
		color: '#fff',
	},
	editorsPicksContainer: {
		marginBottom: 16,
	},
	editorsPicksHeader: {
		fontSize: 18,
		fontWeight: 'bold',
		color: '#475569',
		marginBottom: 8,
		textAlign: 'center',
	},
	editorsPicksScroll: {
		paddingLeft: 12,
	},
	editorsPicksCard: {
		width: 140,
		backgroundColor: '#f8f8f8',
		borderRadius: 12,
		marginRight: 12,
		padding: 8,
		alignItems: 'center',
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 4,
	},
	editorsPicksImage: {
		width: 120,
		height: 120,
		borderRadius: 8,
		marginBottom: 8,
		backgroundColor: '#ddd',
	},
	editorsPicksTitle: {
		fontSize: 15,
		fontWeight: 'bold',
		color: '#222',
		textAlign: 'center',
	},
	shopLocalSection: {
		backgroundColor: '#FFFAF0',
		borderRadius: 12,
		padding: 16,
		marginHorizontal: 12,
		marginBottom: 16,
		borderWidth: 1,
		borderColor: '#FFE4B5',
	},
	shopLocalTitle: {
		fontSize: 24,
		fontWeight: '800',
		color: '#475569',
		marginBottom: 8,
		textAlign: 'center',
	},
	shopLocalDescription: {
		fontSize: 14,
		color: '#666',
		lineHeight: 20,
		marginBottom: 16,
	},
	shopLocalGrid: {
		marginBottom: 16,
	},
	shopLocalPlaceholder: {
		backgroundColor: '#f8f8f8',
		borderRadius: 8,
		padding: 20,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: '#e0e0e0',
		borderStyle: 'dashed',
	},
	shopLocalPlaceholderText: {
		fontSize: 14,
		color: '#999',
		fontStyle: 'italic',
	},
	shopLocalButton: {
		backgroundColor: '#475569',
		borderRadius: 8,
		paddingVertical: 12,
		paddingHorizontal: 24,
		alignItems: 'center',
	},
	shopLocalButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '700',
	},
	dropdownContainer: {
		paddingHorizontal: 0,
		marginBottom: 0,
		zIndex: 100,
		width: '100%',
		maxWidth: 330,
		alignSelf: 'center',
	},
	dropdownButton: {
		backgroundColor: '#fff',
		borderWidth: 1,
		borderColor: '#ddd',
		borderRadius: 8,
		paddingVertical: 12,
		paddingHorizontal: 16,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 4,
	},
	dropdownButtonText: {
		fontSize: 15,
		fontWeight: '600',
		color: '#333',
	},
	dropdownMenu: {
		backgroundColor: '#fff',
		borderRadius: 8,
		marginTop: 4,
		borderWidth: 1,
		borderColor: '#ddd',
		elevation: 3,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
		overflow: 'hidden',
	},
	dropdownMenuScroll: {
		maxHeight: 300,
	},
	dropdownMenuItem: {
		paddingVertical: 12,
		paddingHorizontal: 16,
		borderBottomWidth: 1,
		borderBottomColor: '#f0f0f0',
	},
	dropdownMenuItemActive: {
		backgroundColor: '#f5f5f5',
	},
	dropdownMenuItemText: {
		fontSize: 14,
		color: '#333',
	},
	dropdownMenuItemTextActive: {
		color: '#475569',
		fontWeight: '700',
	},
	listingsGridContainer: {
		paddingHorizontal: 16,
		marginBottom: 16,
	},
	listingsSectionTitle: {
		fontSize: 22,
		fontWeight: '800',
		color: '#475569',
		paddingHorizontal: 16,
		marginTop: 8,
		marginBottom: 10,
	},
	listingsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		gap: 12,
	},
	listingCard: {
		width: '48%',
		backgroundColor: '#fff',
		borderRadius: 12,
		overflow: 'hidden',
		borderWidth: 1,
		borderColor: '#eef2f7',
		elevation: 2,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.08,
		shadowRadius: 4,
		marginBottom: 12,
	},
	imageWrapper: {
		position: 'relative',
		overflow: 'hidden',
	},
	listingImage: {
		width: '100%',
		height: 140,
		backgroundColor: '#f2f4f7',
	},
	featuredBadge: {
		position: 'absolute',
		top: 6,
		left: 6,
		zIndex: 10,
		backgroundColor: '#475569',
		borderRadius: 4,
		paddingHorizontal: 6,
		paddingVertical: 3,
		opacity: 0.95,
	},
	featuredBadgeText: {
		color: '#fff',
		fontSize: 10,
		fontWeight: '700',
		letterSpacing: 0.3,
	},
	listingInfo: {
		padding: 10,
		backgroundColor: '#fff',
	},
	listingTitle: {
		fontSize: 15,
		fontWeight: '600',
		color: '#222',
		marginBottom: 4,
	},
	listingPrice: {
		fontSize: 16,
		fontWeight: 'bold',
		color: '#000',
		marginBottom: 4,
	},
	metaRow: {
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
		marginTop: 4,
		gap: 4,
		marginBottom: 4,
	},
	metaText: {
		fontSize: 12,
		color: '#555',
	},
	metaDot: {
		fontSize: 12,
		color: '#aaa',
	},
	viewCount: {
		fontSize: 12,
		color: '#555',
		marginBottom: 4,
	},
	footer: {
		marginTop: 4,
		gap: 2,
	},
	footerText: {
		fontSize: 12,
		color: '#444',
	},
	listingLocation: {
		fontSize: 12,
		color: '#888',
	},
	loadingContainer: {
		paddingVertical: 40,
		justifyContent: 'center',
		alignItems: 'center',
	},
	noResultsContainer: {
		paddingVertical: 40,
		justifyContent: 'center',
		alignItems: 'center',
	},
	noResultsText: {
		fontSize: 14,
		color: '#888',
		textAlign: 'center',
	},
});

