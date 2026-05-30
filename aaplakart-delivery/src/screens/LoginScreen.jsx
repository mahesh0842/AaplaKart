import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import ActionButton from '../components/ActionButton';
import { COLORS } from '../utils/constants';
import { useAuthStore } from '../store/authStore';

const LoginScreen = () => {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleSendOtp = () => {
    if (phone.replace(/\D/g, '').length < 10) {
      Toast.show({ type: 'error', text1: 'Enter valid 10-digit phone number' });
      return;
    }
    setStep('otp');
    Toast.show({ type: 'info', text1: 'OTP sent', text2: 'Use 123456 to login in demo mode' });
  };

  const handleVerify = async () => {
    if (otp.length < 4) return;
    const result = await login(phone, otp);
    if (!result.success) Toast.show({ type: 'error', text1: 'Login failed', text2: result.error });
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.logoWrap}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.title}>AaplaKart</Text>
        <Text style={styles.subtitle}>Delivery Partner</Text>

        {step === 'phone' ? (
          <>
            <View style={styles.inputRow}>
              <Text style={styles.cc}>+91</Text>
              <TextInput style={styles.phoneInput} placeholder="Phone Number" placeholderTextColor={COLORS.mutedText}
                value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={10} />
            </View>
            <ActionButton label="Send OTP" onPress={handleSendOtp} loading={isLoading} />
          </>
        ) : (
          <>
            <Text style={styles.otpSent}>OTP sent to +91 {phone}</Text>
            <View style={styles.demoHint}>
              <Text style={styles.demoHintText}>Demo mode — use code </Text>
              <Text style={styles.demoHintCode}>123456</Text>
            </View>
            <TextInput style={styles.input} placeholder="Enter OTP" placeholderTextColor={COLORS.mutedText}
              value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
            <ActionButton label="Verify & Login" onPress={handleVerify} loading={isLoading} />
            <Pressable onPress={() => setStep('phone')} style={{ marginTop: 16 }}>
              <Text style={styles.backText}>Change phone number</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 30 },
  logoWrap: { alignItems: 'center', marginBottom: 16 },
  logo: { width: 80, height: 80 },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
  subtitle: { fontSize: 16, color: COLORS.primary, fontWeight: '700', textAlign: 'center', marginBottom: 40 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cc: { fontSize: 16, fontWeight: '800', color: COLORS.text, backgroundColor: COLORS.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  phoneInput: { flex: 1, backgroundColor: COLORS.card, borderRadius: 14, padding: 16, fontSize: 16, borderWidth: 1, borderColor: COLORS.border, color: COLORS.text },
  input: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, fontSize: 16, borderWidth: 1, borderColor: COLORS.border, color: COLORS.text, marginBottom: 16, textAlign: 'center', letterSpacing: 8 },
  otpSent: { fontSize: 14, color: COLORS.mutedText, textAlign: 'center', marginBottom: 8 },
  demoHint: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16, gap: 4 },
  demoHintText: { fontSize: 13, color: COLORS.mutedText, fontWeight: '600' },
  demoHintCode: { fontSize: 15, color: COLORS.primary, fontWeight: '800', letterSpacing: 2 },
  backText: { color: COLORS.primary, fontWeight: '600', fontSize: 14, textAlign: 'center' },
});

export default LoginScreen;
