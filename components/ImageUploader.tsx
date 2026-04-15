import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import React from 'react';
import { Alert, Button, Platform, StyleSheet, Text, View } from 'react-native';
import { app } from '../firebase';
import { useAuth } from '../hooks/useAuth';

type ImageUploaderProps = {
	images: string[];
	onChange: (images: string[]) => void;
};

export default function ImageUploader({ images, onChange }: ImageUploaderProps) {
	const { user } = useAuth();
	const [uploading, setUploading] = React.useState(false);

	const uploadImageToStorage = async (uri: string, fileName: string): Promise<string> => {
		try {
			if (!user?.uid) {
				throw new Error('User must be logged in to upload images');
			}
			const response = await fetch(uri);
			const blob = await response.blob();
			const storage = getStorage(app);
			const userId = user.uid;
			const storageRef = ref(storage, `listingImages/${userId}/${fileName}`);
			await uploadBytes(storageRef, blob);
			const downloadUrl = await getDownloadURL(storageRef);
			return downloadUrl;
		} catch (error) {
			console.error('Error uploading image to storage:', error);
			throw error;
		}
	};

	const pickImage = async () => {
		if (Platform.OS === 'web') {
			// Web file input
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'image/*';
			input.onchange = async (e: any) => {
				const file = e.target.files[0];
				if (file) {
					setUploading(true);
					try {
						const uri = URL.createObjectURL(file);
						const fileName = `${Date.now()}_${file.name}`;
						const downloadUrl = await uploadImageToStorage(uri, fileName);
						onChange([...images, downloadUrl]);
					} catch (error) {
						Alert.alert('Error', 'Failed to upload image');
						console.error(error);
					} finally {
						setUploading(false);
					}
				}
			};
			input.click();
		} else {
			// Mobile
			const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (status !== 'granted') {
				Alert.alert('Permission required', 'Permission to access media library is required!');
				return;
			}
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ['images'],
				allowsEditing: false,
				quality: 0.7,
			});
			if (!result.canceled && result.assets && result.assets.length > 0) {
				setUploading(true);
				try {
					const uri = result.assets[0].uri;
					const fileName = `${Date.now()}_image.jpg`;
					const downloadUrl = await uploadImageToStorage(uri, fileName);
					onChange([...images, downloadUrl]);
				} catch (error) {
					Alert.alert('Error', 'Failed to upload image');
					console.error(error);
				} finally {
					setUploading(false);
				}
			}
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.label}>Upload Your Images</Text>
			<Button title={uploading ? "Uploading..." : "Add Image"} onPress={pickImage} disabled={uploading} />
			<View style={styles.imagesRow}>
				{images.map((img, idx) => (
					<View key={img} style={styles.imageBox}>
						<Image source={{ uri: img }} style={styles.imagePreview} />
						<Button title="Remove" onPress={() => onChange(images.filter((_, i) => i !== idx))} disabled={uploading} />
					</View>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { marginBottom: 16 },
	label: { fontWeight: '600', marginBottom: 4 },
	imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
	imageBox: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8, marginRight: 8, alignItems: 'center' },
	imagePreview: { width: 64, height: 64, borderRadius: 6, marginBottom: 4, backgroundColor: '#eee' },
});
