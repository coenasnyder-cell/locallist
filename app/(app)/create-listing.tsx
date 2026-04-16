import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CreateListing from '../../components/CreateListing';
import { ThemedView } from '../../components/themed-view';

export default function CreateListingPage() {
	const insets = useSafeAreaInsets();
	return (
		<View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
			<ThemedView style={{ flex: 1 }}>
				<CreateListing />
			</ThemedView>
		</View>
	);
}
