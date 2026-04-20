import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { addDoc, collection, getFirestore, serverTimestamp } from "firebase/firestore";
import React, { useState } from "react";
import {
	Alert,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { app } from "../firebase";

const db = getFirestore(app);
const auth = getAuth(app);

const SUPPORT_EMAIL = "support@locallist.com";

const sectionTitleStyle = {
  fontSize: 16,
  fontWeight: "400" as const,
  color: "black",
  paddingVertical: 6,
  paddingHorizontal: 16,
  textAlign: "center" as const,
};

const gradientRowStyle = {
  borderRadius: 8,
};

const gradientRowWrapperStyle = {
  marginBottom: 10,
};

const contactBodyTextStyle = {
  fontSize: 16,
  fontWeight: "300" as const,
  color: "#555",
  marginBottom: 8,
  lineHeight: 20,
  textAlign: "left" as const,
};

function InfoBox() {
  return (
    <View style={gradientRowWrapperStyle}>
      <LinearGradient
        colors={["#e9edf1", "#daeaf0", "#e0dfd4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[gradientRowStyle, { padding: 16 }]}
      >
        <Text style={sectionTitleStyle}>Contact Support</Text>
        <Text style={[contactBodyTextStyle, { marginTop: 12 }]}>If you need help, have a question, or want to report an issue, we're here to help. Please include as much detail as possible so we can assist you quickly.</Text>
        <Text style={contactBodyTextStyle}>Helpful information includes:</Text>
        <Text style={contactBodyTextStyle}>• Your account email</Text>
        <Text style={contactBodyTextStyle}>• A description of the issue</Text>
        <Text style={contactBodyTextStyle}>• The listing or user involved (if applicable)</Text>
        <Text style={contactBodyTextStyle}>• Screenshots if available</Text>
        <Text style={contactBodyTextStyle}>Our support team will respond as soon as possible.</Text>
      </LinearGradient>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <View style={gradientRowWrapperStyle}>
      <LinearGradient
        colors={["#e9edf1", "#daeaf0", "#e0dfd4"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={gradientRowStyle}
      >
        <Text style={sectionTitleStyle}>{children}</Text>
      </LinearGradient>
    </View>
  );
}

export default function ContactUsComp() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState("");

	const handleSubmit = async () => {
		Keyboard.dismiss();
		
		if (!message.trim()) {
			Alert.alert("Message required", "Please enter a message for support.");
			return;
		}

		try {
			const userId = auth.currentUser?.uid || null;
			
			await addDoc(collection(db, "supportMessages"), {
				name: name.trim() || "(not provided)",
				email: email.trim() || "(not provided)",
				message: message.trim(),
				createdAt: serverTimestamp(),
				status: "new",
				userId: userId,
				platform: Platform.OS,
			});

			setName("");
			setEmail("");
			setMessage("");
			
			Alert.alert("Success", "Your message has been sent. We'll get back to you soon!", [
				{
					text: "OK",
					onPress: () => {
						if (router.canGoBack()) {
							router.back();
						} else {
							router.replace("/(tabs)");
						}
					},
				},
			]);
		} catch (error) {
			console.error("Error sending message:", error);
			Alert.alert("Error", "Failed to send message. Please try again.");
		}
	};
    

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
		>
			<ScrollView 
				contentContainerStyle={[styles.content, { paddingBottom: Math.max(40, insets.bottom + 24) }]}
				keyboardDismissMode="on-drag"
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
			<InfoBox />

				<View style={styles.field}>
					<Text style={styles.label}>Name</Text>
					<TextInput
						value={name}
						onChangeText={setName}
						placeholder="Your name"
						placeholderTextColor="#999"
						style={styles.input}
					/>
				</View>

				<View style={styles.field}>
					<Text style={styles.label}>Email</Text>
					<TextInput
						value={email}
						onChangeText={setEmail}
						placeholder="you@email.com"
						placeholderTextColor="#999"
						keyboardType="email-address"
						autoCapitalize="none"
						style={styles.input}
					/>
				</View>

				<View style={styles.field}>
					<Text style={styles.label}>Message</Text>
					<TextInput
						value={message}
						onChangeText={setMessage}
						placeholder="How can we help?"
						placeholderTextColor="#999"
						multiline
						style={[styles.input, styles.messageInput]}
					/>
				</View>

				<TouchableOpacity style={styles.button} onPress={handleSubmit}>
					<Text style={styles.buttonText}>Email Support</Text>
				</TouchableOpacity>

				<Text style={styles.footerText}>
					Or email us directly at {SUPPORT_EMAIL}
				</Text>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
	},
	content: {
		flexGrow: 1,
		padding: 16,
		paddingBottom: 40,
	},
	title: {
		fontSize: 22,
		fontWeight: "600",
		color: "#111",
		marginBottom: 6,
	},
	subtitle: {
		fontSize: 14,
		color: "#444",
		marginBottom: 16,
	},

	field: {
		marginBottom: 14,
	},
	label: {
		fontSize: 13,
		color: "#333",
		marginBottom: 6,
	},
	input: {
		borderWidth: 1,
		borderColor: "#d6d6d6",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 15,
		color: "#222",
		backgroundColor: "#fafafa",
	},
	messageInput: {
		minHeight: 120,
		textAlignVertical: "top",
	},
	button: {
		backgroundColor: "#1f78ff",
		borderRadius: 10,
		paddingVertical: 12,
		alignItems: "center",
		marginTop: 4,
	},
	buttonText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "600",
	},
	footerText: {
		marginTop: 12,
		fontSize: 12,
		color: "#666",
		textAlign: "center",
	},
});
