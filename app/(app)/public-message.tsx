import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";

export default function AdminMessages() {
  const [messages, setMessages] = React.useState<any[]>([]);

  React.useEffect(() => {
    const q = query(
      collection(db, "publicMessages"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(data);
    });

    return unsubscribe;
  }, []);

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <Text style={styles.email}>{item.publicMessageEmail}</Text>
      <Text>{item.publicSenderName}</Text>
      <Text>{item.publicMessageText}</Text>
      <Text style={styles.date}>
        {new Date(item.createdAt).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F6F8",
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  email: {
    fontWeight: "700",
  },
  date: {
    fontSize: 12,
    color: "#888",
    marginTop: 5,
  },
});