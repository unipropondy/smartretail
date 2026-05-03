import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../context/CurrencyContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PayNowQRPaymentProps {
  visible: boolean;
  onClose: () => void;
  onBack: () => void;
  amount: number;
  onSuccess: () => void;
  onFailed?: () => void;
  theme: any;
  t: any;
  shopName: string;
  qrCodeUrl: string | null;
  formatPrice: (amount: number) => string;
}

const PayNowQRPayment: React.FC<PayNowQRPaymentProps> = ({
  visible,
  onClose,
  onBack,
  amount,
  onSuccess,
  onFailed,
  theme,
  t,
  shopName,
  qrCodeUrl,
  formatPrice
}) => {
  const insets = useSafeAreaInsets();
  
  const handleManualSuccess = () => {
    Alert.alert(
      'Confirm Payment',
      'Has the customer paid successfully?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => {
            onSuccess();
            onClose();
          }
        }
      ]
    );
  };

  if (!visible) return null;
  
  const getFullImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) {
      return url;
    }
    return `https://smartretail-production-5457.up.railway.app${url}`;
  };
  
  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.fullScreenModal, { backgroundColor: theme.background }]}>
        
        {/* Header */}
        <View style={[styles.fullScreenHeader, { backgroundColor: theme.primary, paddingTop: insets.top + 15 }]}>
          <TouchableOpacity onPress={onBack} style={styles.fullScreenBackBtn}>
            <Ionicons name="arrow-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.fullScreenTitle, { color: '#fff' }]}>PayNow QR Payment</Text>
          <TouchableOpacity onPress={onClose} style={styles.fullScreenClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.fullScreenScroll}
          contentContainerStyle={styles.fullScreenContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Amount */}
          <View style={[styles.fullAmountContainer, { backgroundColor: theme.surface }]}>
            <Text style={[styles.fullAmountLabel, { color: theme.textSecondary }]}>Amount to Pay</Text>
            <Text style={[styles.fullAmountValue, { color: theme.primary }]}>
              {formatPrice(amount)}
            </Text>
          </View>

          {qrCodeUrl ? (
            <>
              {/* QR Code Image */}
              <View style={styles.fullQrContainer}>
                <View style={[styles.fullQrBox, { backgroundColor: '#fff' }]}>
                  <Image 
                    source={{ uri: getFullImageUrl(qrCodeUrl) }} 
                    style={styles.fullQrImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={[styles.fullQrSubtext, { color: theme.textSecondary }]}>
                  Ask customer to scan this PayNow QR code
                </Text>
              </View>

              {/* Instructions */}
              <View style={[styles.fullInfoBox, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="phone-portrait-outline" size={22} color={theme.primary} />
                <View style={styles.fullInfoTextContainer}>
                  <Text style={[styles.fullInfoText, { color: theme.textSecondary }]}>
                    1. Customer scans QR with PayNow app
                  </Text>
                  <Text style={[styles.fullInfoText, { color: theme.textSecondary }]}>
                    2. They pay on their phone
                  </Text>
                  <Text style={[styles.fullInfoText, { color: theme.textSecondary }]}>
                    3. You click "Payment Received" below
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.fullNoQrContainer}>
              <Ionicons name="qr-code-outline" size={60} color={theme.danger} />
              <Text style={[styles.fullNoQrText, { color: theme.danger }]}>
                PayNow QR not configured!
              </Text>
              <Text style={[styles.fullNoQrSubText, { color: theme.textSecondary }]}>
                Please configure PayNow QR in Payment Settings
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.fullButtonContainer}>
            <TouchableOpacity
              style={[styles.fullBackBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
              onPress={onBack}
            >
              <Ionicons name="arrow-back" size={20} color={theme.text} />
              <Text style={[styles.fullBackText, { color: theme.text }]}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.fullSuccessBtn, { backgroundColor: theme.success, opacity: qrCodeUrl ? 1 : 0.5 }]}
              onPress={handleManualSuccess}
              disabled={!qrCodeUrl}
            >
              <Ionicons name="checkmark-circle" size={22} color="#fff" />
              <Text style={styles.fullSuccessText}>Payment Received</Text>
            </TouchableOpacity>
          </View>
          
          <View style={{ height: 30 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenModal: {
    flex: 1,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 15,
  },
  fullScreenBackBtn: {
    padding: 8,
  },
  fullScreenTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  fullScreenClose: {
    padding: 8,
  },
  fullScreenScroll: {
    flex: 1,
  },
  fullScreenContent: {
    padding: 20,
    paddingBottom: 40,
  },
  fullAmountContainer: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  fullAmountLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  fullAmountValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  fullQrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  fullQrBox: {
    width: 240,
    height: 240,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fullQrImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
  },
  fullQrSubtext: {
    fontSize: 12,
    marginTop: 12,
  },
  fullInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  fullInfoTextContainer: {
    flex: 1,
  },
  fullInfoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  fullButtonContainer: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 20,
  },
  fullBackBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  fullBackText: {
    fontSize: 16,
    fontWeight: '600',
  },
  fullSuccessBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  fullSuccessText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  fullNoQrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  fullNoQrText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
  },
  fullNoQrSubText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default PayNowQRPayment;