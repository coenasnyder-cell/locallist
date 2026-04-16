import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import CreateListing from '../../components/CreateListing';
import { ThemedView } from '../../components/themed-view';

export default function CreateListingPage() {
	return (
		<SafeAreaView style={{ flex: 1 }}>
			<ThemedView style={{ flex: 1 }}>
				<CreateListing />
			</ThemedView>
		</SafeAreaView>
	);
}
