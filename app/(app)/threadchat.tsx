import { useAccountStatus } from '@/hooks/useAccountStatus';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import {
    arrayRemove,
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ThreadChat from '../../components/ThreadChat';
import { app } from '../../firebase';

type LeadType = 'all' | 'business_profile' | 'marketplace' | 'job' | 'service';
type ReadFilter = 'all' | 'unread' | 'read';

type LeadThread = {
	id: string;
	buyerEmail?: string;
	buyerId?: string;
	buyerName?: string;
	createdAt?: unknown;
	lastMessage?: string;
	lastTimestamp?: unknown;
	leadType?: string;
	listingId?: string;
	listingTitle?: string;
	sellerId?: string;
	unreadBy?: string[];
};

type ResponseMetrics = {
	avgResponseLabel: string;
	responseRateLabel: string;
	responseRateSubtext: string;
};

function toDate(value: unknown): Date | null {
	if (!value) return null;
	if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
		return (value as { toDate: () => Date }).toDate();
	}
	const parsed = new Date(value as string | number | Date);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value: unknown): string {
	const date = toDate(value);
	return date ? date.toLocaleString() : 'No activity yet';
}

function formatShortDate(value: unknown): string {
	const date = toDate(value);
	return date ? date.toLocaleString() : 'all conversation history';
}

function formatDurationMinutes(minutes: number): string {
	if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
	if (minutes < 60) return `${Math.round(minutes)}m`;

	const hours = Math.floor(minutes / 60);
	const remainingMinutes = Math.round(minutes % 60);
	if (hours < 24) {
		return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
	}

	const days = Math.floor(hours / 24);
	const remainingHours = hours % 24;
	return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function getLeadTypeLabel(type: string | undefined): string {
	switch (String(type || '').toLowerCase()) {
		case 'marketplace':
			return 'Marketplace';
		case 'job':
			return 'Jobs';
		case 'service':
			return 'Services';
		case 'business_profile':
			return 'Business Profile';
		default:
			return 'Business Profile';
	}
}

function isUnreadThread(thread: LeadThread, userId: string): boolean {
	return Array.isArray(thread.unreadBy) && thread.unreadBy.includes(userId);
}

async function classifyLeadType(db: ReturnType<typeof getFirestore>, thread: LeadThread): Promise<Exclude<LeadType, 'all'>> {
	const existingType = String(thread.leadType || '').trim().toLowerCase();
	if (existingType === 'business_profile' || existingType === 'marketplace' || existingType === 'job' || existingType === 'service') {
		return existingType;
	}

	const listingId = String(thread.listingId || '').trim();
	if (!listingId) return 'business_profile';

	try {
		const listingDoc = await getDoc(doc(db, 'listings', listingId));
		if (listingDoc.exists()) return 'marketplace';
	} catch {}

	try {
		const serviceDoc = await getDoc(doc(db, 'services', listingId));
		if (serviceDoc.exists()) return 'service';
	} catch {}

	try {
		const jobDoc = await getDoc(doc(db, 'jobBoard', listingId));
		if (jobDoc.exists()) return 'job';
	} catch {}

	return 'business_profile';
}

function BusinessLeadsScreen() {
	const router = useRouter();
	const { user, profile, loading, isBusinessAccount, isAdmin } = useAccountStatus();
	const waitingForProfile = !!user && !profile;
	const [threads, setThreads] = useState<LeadThread[]>([]);
	const [readFilter, setReadFilter] = useState<ReadFilter>('all');
	const [typeFilter, setTypeFilter] = useState<LeadType>('all');
	const [screenLoading, setScreenLoading] = useState(true);
	const [responseLoading, setResponseLoading] = useState(true);
	const [resetting, setResetting] = useState(false);
	const [statusMessage, setStatusMessage] = useState('Checking account access and loading leads...');
	const [responseBaselineAt, setResponseBaselineAt] = useState<Date | null>(null);
	const [responseMetrics, setResponseMetrics] = useState<ResponseMetrics>({
		avgResponseLabel: '-',
		responseRateLabel: '-',
		responseRateSubtext: 'No buyer-started threads to measure yet',
	});

	const isBusiness = isBusinessAccount;

	useEffect(() => {
		console.log('[BusinessLeadsScreen] mounted');
		return () => console.log('[BusinessLeadsScreen] unmounted');
	}, []);

	useEffect(() => {
		let cancelled = false;

		const loadUserSettings = async () => {
			if (!user?.uid) return;

			try {
				const db = getFirestore(app);
				const userSnap = await getDoc(doc(db, 'users', user.uid));
				const userData = userSnap.exists() ? userSnap.data() || {} : {};
				if (!cancelled) {
					setResponseBaselineAt(toDate(userData.leadsMetricsResetAt));
				}
			} catch {
				if (!cancelled) {
					setResponseBaselineAt(null);
				}
			}
		};

		loadUserSettings();

		return () => {
			cancelled = true;
		};
	}, [user?.uid]);

	useEffect(() => {
		if (!user?.uid || (!isBusiness && !isAdmin)) {
			setThreads([]);
			setScreenLoading(false);
			return undefined;
		}

		const db = getFirestore(app);
		const threadsQuery = query(collection(db, 'threads'), where('sellerId', '==', user.uid));
		let cancelled = false;

		const unsubscribe = onSnapshot(
			threadsQuery,
			async (snapshot) => {
				try {
					const typeCache = new Map<string, Exclude<LeadType, 'all'>>();
					const rows = snapshot.docs.map((threadDoc) => ({
						id: threadDoc.id,
						...(threadDoc.data() as Omit<LeadThread, 'id'>),
					}));

					const enrichedRows = await Promise.all(
						rows.map(async (row) => {
							const listingId = String(row.listingId || '').trim();
							if (listingId && typeCache.has(listingId)) {
								return { ...row, leadType: typeCache.get(listingId) };
							}

							const leadType = await classifyLeadType(db, row);
							if (listingId) {
								typeCache.set(listingId, leadType);
							}
							return { ...row, leadType };
						})
					);

					enrichedRows.sort((a, b) => {
						const aTime = toDate(a.lastTimestamp || a.createdAt)?.getTime() || 0;
						const bTime = toDate(b.lastTimestamp || b.createdAt)?.getTime() || 0;
						return bTime - aTime;
					});

					if (!cancelled) {
						setThreads(enrichedRows);
						setScreenLoading(false);
						setStatusMessage(isBusiness ? 'Leads and inbox loaded.' : 'Admin preview mode: leads tools loaded.');
					}
				} catch {
					if (!cancelled) {
						setThreads([]);
						setScreenLoading(false);
						setStatusMessage('Could not load leads right now. Please try again.');
					}
				}
			},
			() => {
				if (!cancelled) {
					setThreads([]);
					setScreenLoading(false);
					setStatusMessage('Could not load leads right now. Please try again.');
				}
			}
		);

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [isAdmin, isBusiness, user?.uid]);

	useEffect(() => {
		let cancelled = false;

		const loadResponseMetrics = async () => {
			if (!user?.uid || (!isBusiness && !isAdmin)) {
				if (!cancelled) {
					setResponseLoading(false);
					setResponseMetrics({
						avgResponseLabel: '-',
						responseRateLabel: '-',
						responseRateSubtext: 'No buyer-started threads to measure yet',
					});
				}
				return;
			}

			setResponseLoading(true);

			try {
				const db = getFirestore(app);
				const measuredThreads = threads.slice(0, 40);
				let repliedCount = 0;
				let measuredCount = 0;
				let totalResponseMinutes = 0;

				for (const thread of measuredThreads) {
					const buyerId = String(thread.buyerId || '').trim();
					if (!buyerId) continue;

					try {
						const messagesSnap = await getDocs(
							query(collection(db, 'threads', thread.id, 'messages'), orderBy('createdAt', 'asc'))
						);

						if (messagesSnap.empty) continue;

						let firstBuyerMessageAt: Date | null = null;
						let firstSellerReplyAt: Date | null = null;

						messagesSnap.forEach((messageDoc) => {
							const message = messageDoc.data() || {};
							const senderId = String(message.senderId || '').trim();
							const createdAt = toDate(message.createdAt);
							if (!createdAt) return;
							if (responseBaselineAt && createdAt < responseBaselineAt) return;

							if (!firstBuyerMessageAt && senderId === buyerId) {
								firstBuyerMessageAt = createdAt;
								return;
							}

							if (firstBuyerMessageAt && !firstSellerReplyAt && senderId === user.uid && createdAt >= firstBuyerMessageAt) {
								firstSellerReplyAt = createdAt;
							}
						});

						if (firstBuyerMessageAt) measuredCount += 1;
						if (firstBuyerMessageAt && firstSellerReplyAt) {
							const buyerMessageAt = firstBuyerMessageAt as Date;
							const sellerReplyAt = firstSellerReplyAt as Date;
							repliedCount += 1;
							const diffMinutes = (sellerReplyAt.getTime() - buyerMessageAt.getTime()) / 60000;
							if (Number.isFinite(diffMinutes) && diffMinutes >= 0) {
								totalResponseMinutes += diffMinutes;
							}
						}
					} catch {}
				}

				if (!cancelled) {
					setResponseMetrics({
						avgResponseLabel: repliedCount > 0 ? formatDurationMinutes(totalResponseMinutes / repliedCount) : '-',
						responseRateLabel: measuredCount > 0 ? `${Math.round((repliedCount / measuredCount) * 100)}%` : '-',
						responseRateSubtext:
							measuredCount > 0
								? `${repliedCount} of ${measuredCount} measured threads replied`
								: 'No buyer-started threads to measure yet',
					});
					setResponseLoading(false);
				}
			} catch {
				if (!cancelled) {
					setResponseMetrics({
						avgResponseLabel: '-',
						responseRateLabel: '-',
						responseRateSubtext: 'No buyer-started threads to measure yet',
					});
					setResponseLoading(false);
				}
			}
		};

		loadResponseMetrics();

		return () => {
			cancelled = true;
		};
	}, [isAdmin, isBusiness, responseBaselineAt, threads, user?.uid]);

	const filteredThreads = useMemo(() => {
		return threads.filter((thread) => {
			if (readFilter === 'unread' && !isUnreadThread(thread, user?.uid || '')) return false;
			if (readFilter === 'read' && isUnreadThread(thread, user?.uid || '')) return false;
			if (typeFilter !== 'all' && thread.leadType !== typeFilter) return false;
			return true;
		});
	}, [readFilter, threads, typeFilter, user?.uid]);

	const summaryMetrics = useMemo(() => {
		const now = new Date();
		const start7 = new Date(now);
		start7.setDate(start7.getDate() - 6);
		start7.setHours(0, 0, 0, 0);

		let unreadThreads = 0;
		let recentActivity = 0;
		const buyers = new Set<string>();

		threads.forEach((thread) => {
			if (isUnreadThread(thread, user?.uid || '')) {
				unreadThreads += 1;
			}

			const buyerId = String(thread.buyerId || '').trim();
			if (buyerId) {
				buyers.add(buyerId);
			}

			const lastActivity = toDate(thread.lastTimestamp || thread.createdAt);
			if (lastActivity && lastActivity >= start7) {
				recentActivity += 1;
			}
		});

		return {
			totalLeads: threads.length,
			unreadThreads,
			uniqueBuyers: buyers.size,
			recentActivity,
		};
	}, [threads, user?.uid]);

	const responseBaselineLabel = useMemo(() => {
		return responseBaselineAt
			? `Response baseline: ${formatShortDate(responseBaselineAt)} (older messages excluded)`
			: 'Response baseline: all conversation history';
	}, [responseBaselineAt]);

	const openThread = async (threadId: string) => {
		if (!user?.uid) return;

		try {
			await updateDoc(doc(getFirestore(app), 'threads', threadId), {
				unreadBy: arrayRemove(user.uid),
			});
		} catch {}

		router.push({ pathname: '/threadchat', params: { threadId } });
	};

	const confirmResetResponseMetrics = () => {
		Alert.alert(
			'Reset Response Metrics',
			'Reset response-time metrics starting now? Older messages will no longer count toward the average.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Reset',
					style: 'destructive',
					onPress: async () => {
						if (!user?.uid || resetting) return;

						try {
							setResetting(true);
							await updateDoc(doc(getFirestore(app), 'users', user.uid), {
								leadsMetricsResetAt: serverTimestamp(),
							});
							setResponseBaselineAt(new Date());
							setStatusMessage('Leads and inbox loaded. Response metrics baseline reset successfully.');
						} catch {
							Alert.alert('Error', 'Could not reset response metrics right now. Please try again.');
						} finally {
							setResetting(false);
						}
					},
				},
			]
		);
	};

	if (!loading && !user) {
		return <Redirect href="/login" />;
	}

	if (loading || waitingForProfile) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.centerState}>
					<ActivityIndicator size="large" color="#0f766e" />
					<Text style={styles.loadingText}>Loading leads and inbox...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (!isBusiness && !isAdmin) {
		return (
			<SafeAreaView style={styles.container}>
				<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
					<View style={styles.panel}>
						<Text style={styles.panelTitle}>Business Account Required</Text>
						<Text style={styles.panelSubtitle}>Only business accounts can access leads and inbox tools.</Text>
						<View style={styles.heroButtonsRow}>
							<TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(tabs)/profilebutton')}>
								<Text style={styles.primaryButtonText}>Go to Profile</Text>
							</TouchableOpacity>
							<TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/(tabs)/browsebutton')}>
								<Text style={styles.secondaryButtonText}>Back to Marketplace</Text>
							</TouchableOpacity>
						</View>
					</View>
				</ScrollView>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container}>
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.hero}>
					<Text style={styles.heroTitle}>Leads & Inbox</Text>
					<Text style={styles.heroSubtitle}>Monitor incoming conversations, unread messages, and buyer activity.</Text>
					<View style={styles.heroButtonsRow}>
						<TouchableOpacity style={styles.heroBackButton} onPress={() => router.push('/(tabs)/businesshubbutton')}>
							<Text style={styles.heroBackButtonText}>Back to Business Hub</Text>
						</TouchableOpacity>
						<TouchableOpacity style={styles.heroOpenButton} onPress={() => router.push('/(tabs)/messagesbutton')}>
							<Text style={styles.heroOpenButtonText}>Open Full Inbox</Text>
						</TouchableOpacity>
					</View>
				</View>

				<View style={styles.statusBanner}>
					<Text style={styles.statusBannerText}>{statusMessage}</Text>
				</View>

				<View style={styles.panel}>
					<View style={styles.panelHeaderRow}>
						<View style={styles.panelHeaderCopy}>
							<Text style={styles.panelTitle}>Lead Performance</Text>
							<Text style={styles.panelSubtitle}>Inbox health and response metrics for your business.</Text>
							<Text style={styles.tinyNote}>{responseBaselineLabel}</Text>
						</View>
						<TouchableOpacity
							style={[styles.heroOpenButton, resetting ? styles.buttonDisabled : null]}
							onPress={confirmResetResponseMetrics}
							disabled={resetting}
						>
							<Text style={styles.heroOpenButtonText}>{resetting ? 'Resetting...' : 'Reset Response Metrics'}</Text>
						</TouchableOpacity>
					</View>

					<View style={styles.metricsGrid}>
						<View style={styles.metricCard}>
							<Text style={styles.metricLabel}>Total Leads</Text>
							<Text style={styles.metricValue}>{summaryMetrics.totalLeads}</Text>
							<Text style={styles.metricSubtext}>Conversation threads</Text>
						</View>
						<View style={styles.metricCard}>
							<Text style={styles.metricLabel}>Unread Threads</Text>
							<Text style={styles.metricValue}>{summaryMetrics.unreadThreads}</Text>
							<Text style={styles.metricSubtext}>Need response</Text>
						</View>
						<View style={styles.metricCard}>
							<Text style={styles.metricLabel}>Unique Buyers</Text>
							<Text style={styles.metricValue}>{summaryMetrics.uniqueBuyers}</Text>
							<Text style={styles.metricSubtext}>Distinct contacts</Text>
						</View>
						<View style={styles.metricCard}>
							<Text style={styles.metricLabel}>Recent Activity (7D)</Text>
							<Text style={styles.metricValue}>{summaryMetrics.recentActivity}</Text>
							<Text style={styles.metricSubtext}>Threads with recent messages</Text>
						</View>
						<View style={styles.metricCard}>
							<Text style={styles.metricLabel}>Avg First Response</Text>
							<Text style={styles.metricValue}>{responseLoading ? '...' : responseMetrics.avgResponseLabel}</Text>
							<Text style={styles.metricSubtext}>Time from first buyer message to first seller reply</Text>
						</View>
						<View style={styles.metricCard}>
							<Text style={styles.metricLabel}>Response Rate</Text>
							<Text style={styles.metricValue}>{responseLoading ? '...' : responseMetrics.responseRateLabel}</Text>
							<Text style={styles.metricSubtext}>{responseLoading ? 'Calculating response rate...' : responseMetrics.responseRateSubtext}</Text>
						</View>
					</View>
				</View>

				<View style={styles.panel}>
					<Text style={styles.panelTitle}>Recent Leads</Text>
					<Text style={styles.panelSubtitle}>Your most recent conversations as the seller.</Text>

					<View style={styles.filterRow}>
						<Text style={styles.filterLabel}>Read Status:</Text>
						<View style={styles.filterChipsRow}>
							{([
								{ key: 'all', label: 'All' },
								{ key: 'unread', label: 'Unread' },
								{ key: 'read', label: 'Read' },
							] as { key: ReadFilter; label: string }[]).map((option) => {
								const active = readFilter === option.key;
								return (
									<TouchableOpacity
										key={option.key}
										style={[styles.filterChip, active ? styles.filterChipActive : null]}
										onPress={() => setReadFilter(option.key)}
									>
										<Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{option.label}</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>

					<View style={styles.filterRow}>
						<Text style={styles.filterLabel}>Lead Type:</Text>
						<View style={styles.filterChipsRow}>
							{([
								{ key: 'all', label: 'All Types' },
								{ key: 'business_profile', label: 'Business Profile' },
								{ key: 'marketplace', label: 'Marketplace' },
								{ key: 'job', label: 'Jobs' },
								{ key: 'service', label: 'Services' },
							] as { key: LeadType; label: string }[]).map((option) => {
								const active = typeFilter === option.key;
								return (
									<TouchableOpacity
										key={option.key}
										style={[styles.filterChip, active ? styles.filterChipActive : null]}
										onPress={() => setTypeFilter(option.key)}
									>
										<Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{option.label}</Text>
									</TouchableOpacity>
								);
							})}
						</View>
					</View>

					{screenLoading ? (
						<View style={styles.emptyState}>
							<ActivityIndicator size="small" color="#0f766e" />
							<Text style={styles.emptyStateText}>Loading conversations...</Text>
						</View>
					) : filteredThreads.length === 0 ? (
						<View style={styles.emptyState}>
							<Text style={styles.emptyStateText}>No lead conversations found for this filter.</Text>
						</View>
					) : (
						<View style={styles.threadsList}>
							{filteredThreads.map((thread) => {
								const unread = isUnreadThread(thread, user?.uid || '');
								const buyer = thread.buyerName || thread.buyerEmail || thread.buyerId || 'Buyer';
								return (
									<View key={thread.id} style={styles.threadCard}>
										<View style={styles.threadTopRow}>
											<Text style={styles.threadTitle} numberOfLines={1}>{thread.listingTitle || 'Conversation'}</Text>
											<Text style={styles.threadTime}>{formatDateTime(thread.lastTimestamp || thread.createdAt)}</Text>
										</View>
										<View style={styles.threadMetaRow}>
											<Text style={styles.threadMetaText}>Buyer: {buyer}</Text>
											<View style={[styles.pill, unread ? styles.unreadPill : styles.readPill]}>
												<Text style={[styles.pillText, unread ? styles.unreadPillText : styles.readPillText]}>{unread ? 'Unread' : 'Read'}</Text>
											</View>
											<View style={styles.typePill}>
												<Text style={styles.typePillText}>{getLeadTypeLabel(thread.leadType)}</Text>
											</View>
										</View>
										<Text style={styles.threadMessage} numberOfLines={2}>{thread.lastMessage || 'No messages yet'}</Text>
										<TouchableOpacity style={styles.primaryButton} onPress={() => openThread(thread.id)}>
											<Text style={styles.primaryButtonText}>Open Thread</Text>
										</TouchableOpacity>
									</View>
								);
							})}
						</View>
					)}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

export default function ThreadChatRoute() {
	const params = useLocalSearchParams();
	const { user, loading } = useAccountStatus();
	const threadId = typeof params.threadId === 'string' ? params.threadId : Array.isArray(params.threadId) ? params.threadId[0] : '';

	useEffect(() => {
		console.log('[ThreadChatRoute] mounted');
		return () => console.log('[ThreadChatRoute] unmounted');
	}, []);

	if (loading) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.centerState}>
					<ActivityIndicator size="large" color="#0f766e" />
					<Text style={styles.loadingText}>Loading...</Text>
				</View>
			</SafeAreaView>
		);
	}

	if (!user) {
		return <Redirect href="/login" />;
	}

	if (threadId) {
		return <ThreadChat />;
	}

	return <BusinessLeadsScreen />;
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#f3f5f7',
	},
	content: {
		padding: 14,
		paddingBottom: 28,
		gap: 14,
	},
	centerState: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 10,
		paddingHorizontal: 24,
	},
	loadingText: {
		color: '#475569',
		fontSize: 14,
		fontWeight: '600',
	},
	hero: {
		backgroundColor: '#ffffff',
		borderWidth: 1,
		borderColor: '#dbeafe',
		borderRadius: 16,
		padding: 16,
	},
	heroTitle: {
		fontSize: 28,
		fontWeight: '800',
		color: '#0f172a',
	},
	heroSubtitle: {
		marginTop: 6,
		fontSize: 14,
		lineHeight: 20,
		color: '#64748b',
	},
	heroButtonsRow: {
		marginTop: 14,
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
	},
	heroBackButton: {
		backgroundColor: '#334155',
		paddingVertical: 11,
		paddingHorizontal: 14,
		borderRadius: 10,
	},
	heroBackButtonText: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '700',
	},
	heroOpenButton: {
		backgroundColor: '#0f8b8d',
		paddingVertical: 11,
		paddingHorizontal: 14,
		borderRadius: 10,
	},
	heroOpenButtonText: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '700',
	},
	statusBanner: {
		backgroundColor: '#e7f8ee',
		borderWidth: 1,
		borderColor: '#b7ebcc',
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 16,
	},
	statusBannerText: {
		color: '#166534',
		fontSize: 14,
		fontWeight: '500',
	},
	panel: {
		backgroundColor: '#ffffff',
		borderRadius: 16,
		borderWidth: 1,
		borderColor: '#e2e8f0',
		padding: 14,
		gap: 12,
	},
	panelHeaderRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		gap: 12,
		flexWrap: 'wrap',
	},
	panelHeaderCopy: {
		flex: 1,
		minWidth: 220,
		gap: 4,
	},
	panelTitle: {
		fontSize: 20,
		fontWeight: '800',
		color: '#0f172a',
	},
	panelSubtitle: {
		fontSize: 14,
		color: '#64748b',
	},
	tinyNote: {
		marginTop: 4,
		fontSize: 13,
		color: '#64748b',
	},
	metricsGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'space-between',
		gap: 10,
	},
	metricCard: {
		width: '48.5%',
		minHeight: 108,
		borderWidth: 1,
		borderColor: '#dbe3ef',
		borderRadius: 14,
		padding: 12,
		backgroundColor: '#f9fbfd',
		gap: 6,
	},
	metricLabel: {
		fontSize: 11,
		fontWeight: '800',
		letterSpacing: 0.8,
		color: '#64748b',
		textTransform: 'uppercase',
	},
	metricValue: {
		fontSize: 20,
		fontWeight: '900',
		color: '#0f172a',
	},
	metricSubtext: {
		fontSize: 13,
		lineHeight: 18,
		color: '#64748b',
	},
	filterRow: {
		gap: 10,
	},
	filterLabel: {
		fontSize: 14,
		fontWeight: '700',
		color: '#475569',
	},
	filterChipsRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
	},
	filterChip: {
		borderWidth: 1,
		borderColor: '#cbd5e1',
		borderRadius: 999,
		paddingVertical: 9,
		paddingHorizontal: 14,
		backgroundColor: '#ffffff',
	},
	filterChipActive: {
		backgroundColor: '#334155',
		borderColor: '#334155',
	},
	filterChipText: {
		fontSize: 14,
		fontWeight: '700',
		color: '#334155',
	},
	filterChipTextActive: {
		color: '#ffffff',
	},
	emptyState: {
		borderWidth: 1,
		borderStyle: 'dashed',
		borderColor: '#cbd5e1',
		borderRadius: 12,
		backgroundColor: '#f8fafc',
		padding: 22,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 10,
	},
	emptyStateText: {
		color: '#64748b',
		fontSize: 14,
		textAlign: 'center',
	},
	threadsList: {
		gap: 12,
	},
	threadCard: {
		borderWidth: 1,
		borderColor: '#dbe3ef',
		borderRadius: 14,
		padding: 14,
		backgroundColor: '#fbfdff',
		gap: 10,
	},
	threadTopRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'flex-start',
		gap: 12,
	},
	threadTitle: {
		flex: 1,
		fontSize: 16,
		fontWeight: '800',
		color: '#0f172a',
	},
	threadTime: {
		fontSize: 12,
		color: '#64748b',
		maxWidth: 120,
		textAlign: 'right',
	},
	threadMetaRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		alignItems: 'center',
		gap: 8,
	},
	threadMetaText: {
		fontSize: 13,
		color: '#475569',
	},
	threadMessage: {
		fontSize: 14,
		lineHeight: 20,
		color: '#334155',
	},
	pill: {
		borderRadius: 999,
		paddingVertical: 5,
		paddingHorizontal: 10,
	},
	unreadPill: {
		backgroundColor: '#eff6ff',
	},
	readPill: {
		backgroundColor: '#f8fafc',
	},
	pillText: {
		fontSize: 12,
		fontWeight: '700',
	},
	unreadPillText: {
		color: '#1d4ed8',
	},
	readPillText: {
		color: '#64748b',
	},
	typePill: {
		borderRadius: 999,
		paddingVertical: 5,
		paddingHorizontal: 10,
		backgroundColor: '#e6fffb',
	},
	typePillText: {
		fontSize: 12,
		fontWeight: '700',
		color: '#0f766e',
	},
	primaryButton: {
		alignSelf: 'flex-start',
		backgroundColor: '#0f8b8d',
		paddingVertical: 11,
		paddingHorizontal: 14,
		borderRadius: 10,
	},
	primaryButtonText: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '700',
	},
	secondaryButton: {
		alignSelf: 'flex-start',
		backgroundColor: '#ffffff',
		borderWidth: 1,
		borderColor: '#cbd5e1',
		paddingVertical: 11,
		paddingHorizontal: 14,
		borderRadius: 10,
	},
	secondaryButtonText: {
		color: '#334155',
		fontSize: 14,
		fontWeight: '700',
	},
	buttonDisabled: {
		opacity: 0.65,
	},
});