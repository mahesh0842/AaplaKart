// GUI category: Screen. Renders About Us or Privacy Policy based on `type` prop.
import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Container from '../components/common/Container';
import { COLORS } from '../utils/constants';
import { getShadowStyle } from '../utils/helpers';

const CONTENT = {
  about: {
    title: 'About Us',
    body: () => (
      <>
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.appName}>AaplaKart</Text>
        <Text style={styles.tagline}>Fresh groceries, delivered fast.</Text>
        <View style={styles.card}>
          <Text style={styles.description}>
            AaplaKart is your go-to grocery delivery app. We bring farm-fresh vegetables, dairy products, and daily essentials straight to your doorstep.
          </Text>
          <Text style={styles.description}>
            Our mission is to make grocery shopping effortless with competitive prices, quick delivery, and a seamless experience.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.version}>Version 1.0.0</Text>
          <Text style={styles.copyright}>© 2026 AaplaKart. All rights reserved.</Text>
        </View>
      </>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    body: () => (
      <>
        <Text style={styles.updated}>Last updated: April 2026</Text>
        <Text style={styles.heading}>Information We Collect</Text>
        <Text style={styles.text}>
          We collect phone number, name, delivery address, and order history to provide our grocery delivery service.
        </Text>
        <Text style={styles.heading}>How We Use Your Information</Text>
        <Text style={styles.text}>
          Your information is used to process orders, deliver groceries, send order updates, and improve our service.
        </Text>
        <Text style={styles.heading}>Data Security</Text>
        <Text style={styles.text}>
          We use industry-standard encryption and Firebase secure infrastructure to protect your personal data.
        </Text>
        <Text style={styles.heading}>Third-Party Services</Text>
        <Text style={styles.text}>
          We use Firebase (Google) for authentication and data storage. Payment gateway integration will be added when checkout moves beyond the current demo flow.
        </Text>
        <Text style={styles.heading}>Contact Us</Text>
        <Text style={styles.text}>
          For privacy-related inquiries, contact us at support@aaplakart.com
        </Text>
      </>
    ),
  },
};

const InfoScreen = ({ type, onBack }) => {
  const content = CONTENT[type] || CONTENT.about;

  return (
    <Container>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.title}>{content.title}</Text>
        <View style={styles.backBtn} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>{content.body()}</View>
      </ScrollView>
    </Container>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  content: { paddingHorizontal: 20, paddingBottom: 30, alignItems: 'center' },
  card: {
    width: '100%', backgroundColor: COLORS.card, borderRadius: 22, padding: 18,
    borderWidth: 1, borderColor: '#fde6cf', marginTop: 20,
    ...getShadowStyle(COLORS.shadow),
  },
  logoWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border, alignSelf: 'center', marginBottom: 8,
  },
  logo: { width: 56, height: 56 },
  appName: { fontSize: 28, fontWeight: '800', color: COLORS.primary, textAlign: 'center' },
  tagline: { fontSize: 14, color: COLORS.mutedText, textAlign: 'center', marginBottom: 4 },
  description: { fontSize: 14, color: COLORS.text, lineHeight: 22, marginBottom: 10 },
  version: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  copyright: { marginTop: 4, fontSize: 12, color: COLORS.mutedText },
  updated: { fontSize: 12, color: COLORS.mutedText, marginBottom: 16 },
  heading: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 6 },
  text: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
});

export default InfoScreen;
