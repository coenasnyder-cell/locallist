

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { addDoc, collection, getDocs, getFirestore, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { app } from '../firebase';
import { useAccountStatus } from '../hooks/useAccountStatus';
import { trackAppEvent } from '../utils/appAnalytics';
import { getCityFromZip } from '../utils/zipToCity';
import FormInput from './FormInput';
import ImageUploader from './ImageUploader';

WebBrowser.maybeCompleteAuthSession();

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function CreateListing() {
const DRAFT_STORAGE_KEY_BASE = 'create-listing-draft-v1';
const CATEGORIES = [
	'Home',
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
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

const styles = StyleSheet.create({
	scrollContainer: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 220 },
	backRow: { marginBottom: 10 },
	backText: { color: '#475569', fontSize: 16, fontWeight: '700' },
	formTitle: { fontSize: 24, fontWeight: '800', color: '#475569', marginBottom: 14, textAlign: 'center' },
	button: { backgroundColor: '#475569', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8, alignItems: 'center', marginTop: 16 },
	secondaryButton: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#475569', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8, alignItems: 'center', marginTop: 10 },
	secondaryButtonText: { color: '#475569', fontWeight: '700', fontSize: 16 },
	buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
	checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
	checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: '#475569', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
	checkboxChecked: { backgroundColor: '#475569' },
	checkboxCheck: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
	checkboxLabel: { color: '#333', fontSize: 16, fontWeight: '500' },
	cancelAtBottom: {
		marginTop: 10,
		paddingVertical: 12,
		alignItems: 'center',
		borderRadius: 8,
		backgroundColor: '#f1f5f9',
	},
	cancelAtBottomText: {
		color: '#64748b',
		fontSize: 15,
		fontWeight: '600',
	},
	featureSection: { 
		backgroundColor: '#f0f8fc', 
		borderLeftWidth: 4, 
		borderLeftColor: '#475569', 
		padding: 16, 
		borderRadius: 8, 
		marginVertical: 16 
	},
	featureHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
	featureTitle: { fontSize: 16, fontWeight: 'bold', color: '#475569' },
	featurePrice: { fontSize: 16, fontWeight: 'bold', color: '#d4a574' },
	featureDescription: { fontSize: 14, color: '#555', marginBottom: 12, lineHeight: 20 },
	featureNote: { fontSize: 12, color: '#666', marginTop: 12, fontStyle: 'italic' },
	draftHint: { color: '#64748b', fontSize: 12, textAlign: 'center', marginBottom: 10 },
	draftRestoredHint: { color: '#0f766e', fontSize: 12, textAlign: 'center', marginBottom: 10, fontWeight: '700' },
	clearDraftButton: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 10, marginBottom: 12 },
	clearDraftButtonText: { color: '#b91c1c', fontSize: 12, fontWeight: '700', textDecorationLine: 'underline' }
});

		const [images, setImages] = useState<string[]>([]);
		const [title, setTitle] = useState('');
		const [description, setDescription] = useState('');
		const [price, setPrice] = useState('');
		const params = useLocalSearchParams<{ category?: string; featureCanceled?: string | string[] }>();
		const initialCategory = typeof params.category === 'string' ? params.category : '';
		const featureCanceledParam = Array.isArray(params.featureCanceled) ? params.featureCanceled[0] : params.featureCanceled;
		const [category, setCategory] = useState(
			CATEGORIES.includes(initialCategory) ? initialCategory : ''
		);
		const [condition, setCondition] = useState('');
		const [zipCode, setZipCode] = useState('');
		const [submitting, setSubmitting] = useState(false);
		const [openingPayment, setOpeningPayment] = useState(false);
		const [showLogin, setShowLogin] = useState(false);
		const [draftRestored, setDraftRestored] = useState(false);
		const loginPromptShownRef = useRef(false);
		const paymentCancelNoticeShownRef = useRef(false);
		const draftHydratedRef = useRef(false);
		const formStartedTrackedRef = useRef(false);
		const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
		const [flaggedOutOfState, setFlaggedOutOfState] = useState(false);
		const [wantsFeatured, setWantsFeatured] = useState(false); // Feature listing option
		const router = useRouter();
		const { user, profile, loading, canPostListings, postingBlockedReason } = useAccountStatus();
		const draftStorageKey = `${DRAFT_STORAGE_KEY_BASE}:${user?.uid || 'anonymous'}`;
		const canEditListing = !!user && canPostListings;
		const accountStatusMessage = () => {
			return postingBlockedReason || 'Unable to post. Please contact support.';
		};
		// Keep auth gate in sync: prompt once when signed out, close once signed in.
		React.useEffect(() => {
			if (user) {
				loginPromptShownRef.current = false;
				if (showLogin) setShowLogin(false);
				return;
			}

			if (!loading && !showLogin && !loginPromptShownRef.current) {
				loginPromptShownRef.current = true;
				setShowLogin(true);
			}
		}, [loading, user, showLogin]);

		React.useEffect(() => {
			if (initialCategory && CATEGORIES.includes(initialCategory)) {
				setCategory(initialCategory);
			}
		}, [initialCategory]);

		React.useEffect(() => {
			if (featureCanceledParam === '1' && !paymentCancelNoticeShownRef.current) {
				paymentCancelNoticeShownRef.current = true;
				Alert.alert(
					'Payment Canceled',
					'Featured checkout was canceled. Your listing is still submitted and active without featured placement.'
				);
			}
		}, [featureCanceledParam]);

		React.useEffect(() => {
			let isMounted = true;

			const loadDraft = async () => {
				try {
					const stored = await AsyncStorage.getItem(draftStorageKey);
					if (!stored) {
						return;
					}

					const parsed = JSON.parse(stored) as {
						title?: string;
						description?: string;
						price?: string;
						category?: string;
						condition?: string;
						zipCode?: string;
						images?: string[];
						wantsFeatured?: boolean;
					};

					if (!parsed || typeof parsed !== 'object') {
						return;
					}

					if (isMounted) {
						setTitle(typeof parsed.title === 'string' ? parsed.title : '');
						setDescription(typeof parsed.description === 'string' ? parsed.description : '');
						setPrice(typeof parsed.price === 'string' ? parsed.price : '');
						const restoredCategory = typeof parsed.category === 'string' ? parsed.category : '';
						if (restoredCategory && CATEGORIES.includes(restoredCategory)) {
							setCategory(restoredCategory);
						}
						setCondition(typeof parsed.condition === 'string' ? parsed.condition : '');
						setZipCode(typeof parsed.zipCode === 'string' ? parsed.zipCode : '');
						setImages(
							Array.isArray(parsed.images)
								? parsed.images.filter(
									(image): image is string => typeof image === 'string' && (image.startsWith('http://') || image.startsWith('https://'))
								)
								: []
						);
						setWantsFeatured(Boolean(parsed.wantsFeatured));
						setDraftRestored(true);
						trackAppEvent('listing_draft_restored', {
							userId: user?.uid || null,
							source: 'create_listing',
						});
					}
				} catch (draftLoadError) {
					console.error('Could not load listing draft', draftLoadError);
				} finally {
					draftHydratedRef.current = true;
				}
			};

			loadDraft();

			return () => {
				isMounted = false;
			};
		}, [draftStorageKey]);

		const markListingFormStarted = () => {
			if (formStartedTrackedRef.current) {
				return;
			}

			formStartedTrackedRef.current = true;
			trackAppEvent('listing_form_started', {
				userId: user?.uid || null,
				source: 'create_listing',
			});
		};

		React.useEffect(() => {
			if (!draftHydratedRef.current) {
				return;
			}

			const saveTimer = setTimeout(async () => {
				try {
					if (!hasDraftContent) {
						await AsyncStorage.removeItem(draftStorageKey);
						return;
					}

					await AsyncStorage.setItem(
						draftStorageKey,
						JSON.stringify({
							title,
							description,
							price,
							category,
							condition,
							zipCode,
							images,
							wantsFeatured,
							updatedAt: Date.now(),
						})
					);
				} catch (draftSaveError) {
					console.error('Could not save listing draft', draftSaveError);
				}
			}, 500);

			return () => clearTimeout(saveTimer);
		}, [category, condition, description, draftStorageKey, images, price, title, wantsFeatured, zipCode]);

		const handleBack = () => {
			if (router.canGoBack()) {
				router.back();
				return;
			}
			router.replace('/(tabs)/listbutton' as any);
		};

		const goToLogin = () => {
			setShowLogin(false);
			router.push({
				pathname: '/signInOrSignUp',
				params: {
					returnTo: '/create-listing',
				},
			} as any);
		};

	const requiredFields = [title, description, price, zipCode, category, condition];
	const isValid = requiredFields.every(Boolean) && images.length > 0;
	const hasDraftContent = Boolean(
		title.trim() ||
		description.trim() ||
		price.trim() ||
		category.trim() ||
		condition.trim() ||
		zipCode.trim() ||
		images.length > 0 ||
		wantsFeatured
	);

	const clearDraft = async () => {
		setTitle('');
		setDescription('');
		setPrice('');
		setCategory('');
		setCondition('');
		setZipCode('');
		setImages([]);
		setWantsFeatured(false);
		setLocation(null);
		setFlaggedOutOfState(false);
		setDraftRestored(false);

		try {
			await AsyncStorage.removeItem(draftStorageKey);
		} catch (draftClearError) {
			console.error('Could not clear listing draft', draftClearError);
		}
	};

	const confirmClearDraft = () => {
		Alert.alert(
			'Clear Draft?',
			'This will remove your saved listing draft from this device.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Clear Draft', style: 'destructive', onPress: () => { clearDraft(); } },
			]
		);
	};

	const launchFeaturedCheckout = async (listingId: string, listingTitle: string) => {
		trackAppEvent('featured_checkout_started', {
			userId: user?.uid || null,
			listingId,
			source: 'create_listing',
		});

		const  functions = getFunctions(app);
		const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
		const result = await withTimeout(
			createCheckoutSession({
				itemType: 'listing',
				listingId,
				listingTitle,
				mobileApp: true,
			}),
			20000,
			'Timed out while creating Stripe checkout session.'
		);

		const data = result.data as { url?: string };
		if (!data?.url) {
			throw new Error('Missing Stripe checkout URL');
		}

		const nativeReturnUrl = Linking.createURL('/auth-action');
		const authResult = await withTimeout(
			WebBrowser.openAuthSessionAsync(data.url, nativeReturnUrl),
			180000,
			'Timed out waiting for checkout to return to the app.'
		);

		if (authResult.type === 'success' && authResult.url) {
			if (authResult.url.includes('checkout=featured')) {
				trackAppEvent('featured_checkout_success', {
					userId: user?.uid || null,
					listingId,
					source: 'create_listing',
				});

				router.replace({
					pathname: '/listing-posted' as any,
					params: {
						listingId,
						checkout: 'featured',
					},
				});
				return;
			}

			if (authResult.url.includes('featureCanceled=1')) {
				router.replace({
					pathname: '/create-listing' as any,
					params: {
						featureCanceled: '1',
					},
				});
				return;
			}
		}

		if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
			router.replace({
				pathname: '/create-listing' as any,
				params: {
					featureCanceled: '1',
				},
			});
		}
	};

	const isZipCodeApproved = async (zip: string): Promise<boolean> => {
		try {
			const db = getFirestore(app);
			const collectionsToCheck = ['zipCode', 'zipCodes', 'approved_zips'];
			for (const collectionName of collectionsToCheck) {
				const zipCodesRef = collection(db, collectionName);
				const snapshot = await getDocs(zipCodesRef);
				for (const zipDoc of snapshot.docs) {
					const data = zipDoc.data();
					if (data.zip === zip || data.zipCode === zip) {
						return true;
					}
				}
			}
			return false;
		} catch (fetchError) {
			console.error('Error checking zip code:', fetchError);
			return false;
		}
	};

	const containsContactInfo = (text: string): { found: boolean; type: string } => {
		// Check for email pattern
		const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
		if (emailRegex.test(text)) {
			return { found: true, type: 'email' };
		}

		// Check for phone number patterns (various formats)
		const phoneRegex = /(\+?1)?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}|(\+?[0-9]{1,3})[-.\s]?[0-9]{1,14}/g;
		if (phoneRegex.test(text)) {
			return { found: true, type: 'phone number' };
		}

		return { found: false, type: '' };
	};

	const containsPaymentLinks = (text: string): { found: boolean; type: string } => {
		// Check for URLs (http, https, www)
		const urlRegex = /(https?:\/\/|www\.)[^\s]+/gi;
		if (urlRegex.test(text)) {
			return { found: true, type: 'external link' };
		}

		// Check for common payment service keywords
		const paymentRegex = /(paypal|venmo|cashapp|square cash|stripe|bitcoin|crypto|ethereum|zelle)/gi;
		if (paymentRegex.test(text)) {
			return { found: true, type: 'payment service reference' };
		}

		return { found: false, type: '' };
	};

	const checkForDistantLocations = (text: string): { found: boolean; mentions: string[] } => {
		const textLower = text.toLowerCase();
		// All other US states except Arkansas
		const forbiddenLocations = [
			// US States (excluding Arkansas)
			'california|ca', 'texas|tx', 'florida|fl', 'new york|ny', 'pennsylvania|pa',
			'ohio|oh', 'georgia|ga', 'north carolina|nc', 'michigan|mi', 'illinois|il',
			'virginia|va', 'washington|wa', 'arizona|az', 'colorado|co', 'massachusetts|ma',
			'tennessee|tn', 'missouri|mo', 'maryland|md', 'minnesota|mn', 'louisiana|la',
			'new jersey|nj', 'indiana|in', 'wisconsin|wi', 'utah|ut', 'kansas|ks',
			'oklahoma|ok', 'oregon|or', 'iowa|ia', 'nevada|nv',
			'mississippi|ms', 'connecticut|ct', 'new mexico|nm', 'west virginia|wv',
			'idaho|id', 'hawaii|hi', 'maine|me', 'south dakota|sd', 'north dakota|nd',
			'montana|mt', 'vermont|vt', 'alaska|ak', 'delaware|de', 'south carolina|sc',
			'rhode island|ri', 'wyoming|wy', 'new hampshire|nh',
			// Major cities (outside Arkansas)
			'new york city|nyc', 'los angeles|lax', 'chicago', 'houston', 'phoenix',
			'philadelphia', 'san antonio', 'san diego', 'dallas', 'san jose', 'austin',
			'jacksonville', 'san francisco', 'seattle', 'denver', 'boston', 'atlanta',
			'baltimore', 'miami', 'detroit', 'minneapolis', 'las vegas', 'portland',
		];

		const mentions: string[] = [];
		forbiddenLocations.forEach(location => {
			const regex = new RegExp(`\\b(${location})\\b`, 'gi');
			if (regex.test(textLower)) {
				mentions.push(location.split('|')[0]);
			}
		});

		return { found: mentions.length > 0, mentions };
	};

	const requestLocationPermission = async () => {
		try {
			const { status } = await Location.requestForegroundPermissionsAsync();
			if (status === 'granted') {
				const loc = await Location.getCurrentPositionAsync({});
				setLocation({
					latitude: loc.coords.latitude,
					longitude: loc.coords.longitude,
				});
			}
		} catch (error) {
			console.error('Location permission error:', error);
			// Don't block listing creation if location fails
		}
	};

	async function handleSubmit(submitWithFeature: boolean = wantsFeatured) {
		if (!isValid) {
			if (images.length === 0) {
				Alert.alert('Missing Image', 'Please upload at least one image for your listing.');
				return;
			}
			Alert.alert('Missing Fields', 'Please fill in all required fields.');
			return;
		}

		if (images.some(img => img.startsWith('file://') || img.startsWith('content://'))) {
			Alert.alert('Invalid Image', 'Please re-upload your images. Local file paths are not supported.');
			return;
		}

		// Check for contact info in title and description
		const titleCheck = containsContactInfo(title);
		const descriptionCheck = containsContactInfo(description);

		if (titleCheck.found) {
			Alert.alert('Invalid Content', `Please do not include ${titleCheck.type}s in the listing title.`);
			return;
		}

		if (descriptionCheck.found) {
			Alert.alert('Invalid Content', `Please do not include ${descriptionCheck.type}s in the listing description.`);
			return;
		}

		// Check for payment links in title and description
		const titlePaymentCheck = containsPaymentLinks(title);
		const descriptionPaymentCheck = containsPaymentLinks(description);

		if (titlePaymentCheck.found) {
			Alert.alert('Invalid Content', `Please do not include ${titlePaymentCheck.type}s in the listing title.`);
			return;
		}

		if (descriptionPaymentCheck.found) {
			Alert.alert('Invalid Content', `Payment links and external payment services cannot be shared in listings. Communicate payment details safely through our messaging system.`);
			return;
		}

		// Check for distant cities or other states
		const titleLocationCheck = checkForDistantLocations(title);
		const descriptionLocationCheck = checkForDistantLocations(description);

		if (titleLocationCheck.found || descriptionLocationCheck.found) {
			const mentions = [...new Set([...titleLocationCheck.mentions, ...descriptionLocationCheck.mentions])].join(', ');
			// Flag for admin review but allow posting
			setFlaggedOutOfState(true);
			Alert.alert(
				'Location Warning',
				`Your listing mentions: ${mentions}. This listing will be flagged for admin review to verify the item is available in Arkansas. Continue posting?`,
				[
					{ text: 'Cancel', style: 'cancel' },
					{
						text: 'Continue',
						onPress: () => proceedWithListing(submitWithFeature),
					},
				]
			);
			return;
		}

		await proceedWithListing(submitWithFeature);
	};

	async function proceedWithListing(submitWithFeature: boolean) {
		const zipApproved = await isZipCodeApproved(zipCode.trim());
		if (!zipApproved) {
			Alert.alert('Invalid ZIP Code', 'This ZIP code is not approved for posting. Please use an approved location.');
			return;
		}

		if (!user?.email) {
			Alert.alert('Error', 'User email not found. Please check your account.');
			return;
		}
		if (!canPostListings) {
			Alert.alert('Account Action Required', accountStatusMessage());
			return;
		}
		
		// Request location permission (optional)
		await requestLocationPermission();
		
		// Auto-generate seller name from profile
		const sellerName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Anonymous';
		const pickupLocation = 'Contact seller for details';
		const sellerBusinessName = profile?.accountType === 'business' ? profile?.businessName || null : null;
		const sellerBusinessTier = profile?.accountType === 'business' ? profile?.businessTier || 'free' : null;
		const sellerAccountType = profile?.accountType || null;
		const businessId = profile?.accountType === 'business' ? user?.uid || null : null;
		
		setOpeningPayment(submitWithFeature);
		setSubmitting(true);
		try {
			const db = getFirestore(app);
			const city = await getCityFromZip(zipCode) ?? 'TBD';
			const listingDocRef = await addDoc(collection(db, 'listings'), {
				images,
				title,
				description,
				price: parseFloat(price),
				category,
				condition,
				zipCode,
				city,
				pickupLocation,
				createdAt: serverTimestamp(),
				status: 'approved',
				viewCount: 0,
				isActive: true,
				isFeatured: false,
				featureRequested: submitWithFeature,
				featureDurationDays: submitWithFeature ? 7 : null,
				featurePrice: submitWithFeature ? 5 : null,
				featurePaymentStatus: submitWithFeature ? 'pending' : 'not_requested',
				favoritesCount: 0,
				allowMessages: true,
				userId: user?.uid || null,
				userName: sellerName,
				businessId,
				sellerName: sellerName,
				sellerEmail: user.email,
				sellerBusinessName: sellerBusinessName,
				sellerBusinessTier: sellerBusinessTier,
				sellerAccountType: sellerAccountType,
				flaggedOutOfState: flaggedOutOfState,
				...(location && { 
					latitude: location.latitude, 
					longitude: location.longitude 
				}),
			});

			trackAppEvent('listing_submitted', {
				userId: user?.uid || null,
				listingId: listingDocRef.id,
				category,
				isFeaturedRequested: submitWithFeature,
				source: 'create_listing',
			});

			// If user wants featured listing, launch Stripe checkout flow
			if (submitWithFeature) {
				try {
					await launchFeaturedCheckout(listingDocRef.id, title.trim());
				} catch (checkoutError) {
					Alert.alert(
						'Checkout Not Started',
						'Your listing was created, but we could not open Stripe checkout right now. Please try again later.'
					);
				}
			} else {
				await clearDraft();
				router.replace({
					pathname: '/listing-posted' as any,
					params: {
						listingId: listingDocRef.id,
					},
				});
			}
		} catch (error: any) {
			Alert.alert('Error', error?.message ? `Could not create listing: ${error.message}` : 'Could not create listing. Please try again.');
		} finally {
			setOpeningPayment(false);
			setSubmitting(false);
		}
	}

	return (
		<KeyboardAvoidingView 
			behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
			style={{ flex: 1 }}
			keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 80}
		>
			<TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
				<View style={{ flex: 1 }}>
						<ScrollView 
							contentContainerStyle={styles.scrollContainer} 
							keyboardShouldPersistTaps="handled"
							keyboardDismissMode="on-drag"
							showsVerticalScrollIndicator={false}
							onScrollBeginDrag={Keyboard.dismiss}
						>
							<Text style={styles.formTitle}>Create Marketplace Listing</Text>
							<Text style={draftRestored ? styles.draftRestoredHint : styles.draftHint}>
								{draftRestored ? 'Draft restored from this device.' : 'Draft autosaves on this device while you type.'}
							</Text>
							{hasDraftContent && (
								<TouchableOpacity style={styles.clearDraftButton} onPress={confirmClearDraft}>
									<Text style={styles.clearDraftButtonText}>Clear Draft</Text>
								</TouchableOpacity>
							)}
								<FormInput label="Title" value={title} onChangeText={text => { if (!user) setShowLogin(true); else if (!canPostListings) Alert.alert('Account Action Required', accountStatusMessage()); else { markListingFormStarted(); setTitle(text); } }} required editable={canEditListing} />
								<FormInput label="Description" value={description} onChangeText={text => { if (!user) setShowLogin(true); else if (!canPostListings) Alert.alert('Account Action Required', accountStatusMessage()); else { markListingFormStarted(); setDescription(text); } }} required multiline editable={canEditListing} />
								<FormInput label="Price" value={price} onChangeText={text => { if (!user) setShowLogin(true); else if (!canPostListings) Alert.alert('Account Action Required', accountStatusMessage()); else { markListingFormStarted(); setPrice(text); } }} required keyboardType="numeric" editable={canEditListing} />
								<FormInput
									label="Category"
									value={category}
									onChangeText={text => { if (!user) setShowLogin(true); else if (!canPostListings) Alert.alert('Account Action Required', accountStatusMessage()); else { markListingFormStarted(); setCategory(text); } }}
									required
									type="picker"
									options={CATEGORIES}
									placeholder="Select a category"
									dropdownZIndex={3000}
									editable={canEditListing}
								/>
								<FormInput
									label="Condition"
									value={condition}
									onChangeText={text => { if (!user) setShowLogin(true); else if (!canPostListings) Alert.alert('Account Action Required', accountStatusMessage()); else { markListingFormStarted(); setCondition(text); } }}
									required
									type="picker"
									options={CONDITIONS}
									placeholder="Select condition"
									dropdownZIndex={2000}
									editable={canEditListing}
								/>
								<FormInput label="Zip Code" value={zipCode} onChangeText={text => { if (!user) setShowLogin(true); else if (!canPostListings) Alert.alert('Account Action Required', accountStatusMessage()); else { markListingFormStarted(); setZipCode(text); } }} required keyboardType="numeric" editable={canEditListing} />
								<ImageUploader
									images={images}
									onChange={imgs => {
										if (!user) setShowLogin(true);
										else if (!canPostListings) Alert.alert('Account Action Required', accountStatusMessage());
										else {
											markListingFormStarted();
											setImages(imgs);
										}
									}}
								/>

								{/* Featured Listing Option */}
								<View style={styles.featureSection}>
									<View style={styles.featureHeader}>
										<Text style={styles.featureTitle}>✨ Boost Your Listing</Text>
										<Text style={styles.featurePrice}>$5 for 7 days</Text>
									</View>
									<Text style={styles.featureDescription}>Featured listings appear at the top of search results and get more visibility.</Text>
									<TouchableOpacity 
										style={[styles.checkboxRow, { marginTop: 12 }]}
										onPress={() => {
											markListingFormStarted();
											setWantsFeatured(!wantsFeatured);
										}}
										disabled={!canEditListing}
									>
										<View style={[styles.checkbox, wantsFeatured && styles.checkboxChecked]}>
											{wantsFeatured && <Text style={styles.checkboxCheck}>✓</Text>}
										</View>
										<Text style={styles.checkboxLabel}>Feature this listing</Text>
									</TouchableOpacity>
									{wantsFeatured && (
										<Text style={styles.featureNote}>
											Choose Continue to Payment to finish Stripe checkout now, or List Without Feature to post normally.
										</Text>
									)}
								</View>

								<TouchableOpacity style={styles.button} onPress={() => { if (!user) setShowLogin(true); else if (!canPostListings) Alert.alert('Account Action Required', accountStatusMessage()); else handleSubmit(wantsFeatured); }} disabled={submitting || !canEditListing}>
									<Text style={styles.buttonText}>{submitting ? (openingPayment ? 'Opening Payment...' : 'Submitting...') : wantsFeatured ? 'Continue to Payment' : 'Submit Listing'}</Text>
								</TouchableOpacity>
								{wantsFeatured && (
									<TouchableOpacity style={styles.secondaryButton} onPress={() => { if (!user) setShowLogin(true); else if (!canPostListings) Alert.alert('Account Action Required', accountStatusMessage()); else handleSubmit(false); }} disabled={submitting || !canEditListing}>
										<Text style={styles.secondaryButtonText}>List Without Feature</Text>
									</TouchableOpacity>
								)}
								<TouchableOpacity onPress={handleBack} style={styles.cancelAtBottom}>
								<Text style={styles.cancelAtBottomText}>Cancel</Text>
								</TouchableOpacity>
							</ScrollView>
					{showLogin && (
						<View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
							<View style={{ width: '90%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 8 }}>
								<Text style={{ color: '#334155', fontWeight: '800', fontSize: 20, textAlign: 'center', marginBottom: 8 }}>Login Required</Text>
								<Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 18 }}>
									Please log in or create an account to post your listing.
								</Text>
								<TouchableOpacity style={[styles.button, { marginTop: 0 }]} onPress={goToLogin} activeOpacity={0.85}>
									<Text style={styles.buttonText}>Continue to Login / Sign Up</Text>
								</TouchableOpacity>
								<TouchableOpacity onPress={handleBack} style={{ marginTop: 12, alignSelf: 'center' }}>
									<Text style={{ color: '#475569', fontWeight: '700' }}>Back To List Hub</Text>
								</TouchableOpacity>
							</View>
						</View>
					)}
				</View>
			</TouchableWithoutFeedback>
		</KeyboardAvoidingView>
	);
}

export default CreateListing;




