import React from 'react';
import { View } from 'react-native';
import Header from '../components/Header';
import ListingScreen from './(app)/listing';

export default function SingleListingRoute() {
	return (
		<View style={{ flex: 1 }}>
			<Header showTitle={false} />
			<ListingScreen />
		</View>
	);
}
