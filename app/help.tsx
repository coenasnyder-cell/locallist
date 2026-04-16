import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Help() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqData = [
    {
      section: "Getting Started",
      items: [
        {
          q: "What is Local List?",
          a: "Local List is a local marketplace designed to help people in the Harrison area buy, sell, and discover items, services, and events nearby.",
        },
        {
          q: "Do I need an account to browse?",
          a: "No. You can browse listings without an account, but you must create an account to post listings or message sellers.",
        },
        {
          q: "How do I create an account?",
          a: "Tap Sign Up, enter your email, ZIP code, and create a password.",
        },
        {
          q: "Why do you ask for my ZIP code?",
          a: "ZIP codes help keep listings local, relevant, and reduce spam from outside the area.",
        },
        {
          q: "How long does a featured listing stay featured?",
          a: "Featured listings remain highlighted for the duration of the listing or selected promotion period.",
        },
        {
          q: "Are featured listing fees refundable?",
          a: "Featured listing payments are generally non-refundable unless a technical error or duplicate charge occurs.",
        },
      ],
    },
    {
      section: "Messaging & Safety",
      items: [
        {
          q: "How do I contact a seller?",
          a: "Open a listing and tap the Message button to start a conversation.",
        },
        {
          q: "Is Local List responsible for transactions?",
          a: "No. Transactions are arranged directly between buyers and sellers.",
        },
        {
          q: "How can I stay safe when meeting buyers or sellers?",
          a: "Meet in public places, bring a friend if possible, and avoid sharing sensitive information.",
        },
        {
          q: "How do I report a listing or user?",
          a: "Use the Report option on a listing or contact support.",
        },
      ],
    },
    {
      section: "Payments & Refunds",
      items: [
        {
          q: "Does Local List handle payments between buyers and sellers?",
          a: "No. Payments for items are handled directly between buyers and sellers. Local List only processes payments for optional features.",
        },
        {
          q: "What payments does Local List process?",
          a: "Local List may process payments for optional features such as Featured Listings.",
        },
        {
          q: "What is the refund policy?",
          a: "Refunds are issued only for duplicate charges, technical issues, or payment errors.",
        },
        {
          q: "How do I request a refund?",
          a: "Contact support with your account email and transaction details.",
        },
      ],
    },
    {
      section: "Policies & Prohibited Items",
      items: [
        {
          q: "What items are not allowed?",
          a: "Illegal items, stolen property, adult content, restricted weapons, or anything violating laws are not allowed.",
        },
        {
          q: "Can businesses post listings?",
          a: "Yes, as long as listings follow policies and remain relevant to the local community.",
        },
        {
          q: "Can my account be suspended?",
          a: "Accounts that repeatedly violate policies or misuse the platform may be restricted or suspended.",
        },
      ],
    },
    {
      section: "Contact Support",
      items: [
        {
          q: "How do I contact support?",
          a: "Use the Contact page in the app or email support at support@locallist.com.",
        },
        {
          q: "What information should I include?",
          a: "Include your account email, description of the issue, and any relevant details.",
        },
      ],
    },
  ];

  let questionCounter = 0;

  return (
    <View style={styles.container}>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Help & FAQ</Text>

        <View style={styles.introCard}>
          <Text style={styles.introText}>
            Here you'll find answers to common questions about using the app, posting listings, and promoting your items.
            If you need more help, just reach out—we're always happy to help neighbors.
          </Text>
        </View>

        {faqData.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.faqSection}>
            <Text style={styles.sectionTitle}>{section.section}</Text>
            {section.items.map((item, itemIndex) => {
              const currentIndex = questionCounter++;
              const isLast = itemIndex === section.items.length - 1;
              return (
                <View key={itemIndex} style={[styles.faqItem, isLast && styles.faqItemLast]}>
                  <TouchableOpacity
                    onPress={() => toggleItem(currentIndex)}
                    style={styles.questionRow}
                  >
                    <Text style={styles.question}>{item.q}</Text>
                    <Text style={[styles.arrow, openIndex === currentIndex && styles.arrowOpen]}>
                      {openIndex === currentIndex ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                  {openIndex === currentIndex && (
                    <Text style={styles.answer}>{item.a}</Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 Local List. A local marketplace for Harrison.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 16,
  },

  introCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  introText: {
    fontSize: 14,
    color: "#444",
    lineHeight: 22,
  },

  faqSection: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#475569",
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "#f0f8fc",
  },

  faqItem: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },

  faqItemLast: {
    marginBottom: 0,
    borderBottomWidth: 0,
  },

  questionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },

  question: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    paddingRight: 10,
    color: "#333",
  },

  arrow: {
    fontSize: 14,
    color: "#666",
    minWidth: 20,
    textAlign: "center",
  },

  arrowOpen: {
    color: "#475569",
  },

  answer: {
    fontSize: 14,
    color: "#555",
    marginBottom: 12,
    paddingLeft: 0,
    lineHeight: 20,
  },

  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },

  footerText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
});
