import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { addDoc, collection } from "firebase/firestore";
import { db } from '../firebase';

export default function ContactPublic() {
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [message, setMessage] = React.useState("");

  const handleSubmit = async () => {
    if (!email || !message) {
      alert("Please enter your email and message");
      return;
    }

    try {
      await addDoc(collection(db, "publicMessages"), {
        publicMessageEmail: email,
        publicSenderName: name || "",
        publicMessageText: message,
        createdAt: Date.now(),
        publicMessageStatus: "new",
        publicMessageSource: "public-form",
      });

      alert("Message sent!");
      setEmail("");
      setName("");
      setMessage("");

    } catch (error) {
      console.log("Error:", error);
      alert("Something went wrong");
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>

        <View style={styles.logoSection}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.centeredLogo}
            contentFit="contain"
          />
        </View>

        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.arrowButton}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>

          <View style={styles.titleCenterWrapper}>
            <Text style={styles.infoRowText}>Contact Us</Text>
          </View>
        </View>

        <View style={styles.contentBox}>
          <TextInput
            placeholder="Your name (optional)"
            style={styles.input}
            value={name}
            onChangeText={setName}
          />

          <TextInput
            placeholder="Your email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            placeholder="Your message"
            multiline
            style={styles.textArea}
            value={message}
            onChangeText={setMessage}
          />

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitText}>Send Message</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F6F8" },
  scrollContainer: { padding: 16 },

  logoSection: { alignItems: "center", marginBottom: 10 },
  centeredLogo: { width: 140, height: 66 },

  titleRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  arrowButton: { width: 50, alignItems: "center" },
  titleCenterWrapper: { flex: 1, alignItems: "center" },

  infoRowText: { fontSize: 18, fontWeight: "700" },

  contentBox: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },

  textArea: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    height: 100,
    marginBottom: 10,
  },

  submitButton: {
    backgroundColor: "#334155",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  submitText: { color: "#fff", fontWeight: "700" },
});