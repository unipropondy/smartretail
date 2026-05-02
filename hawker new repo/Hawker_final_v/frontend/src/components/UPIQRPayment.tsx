import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useCurrency } from '../context/CurrencyContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface UPIQRPaymentProps {
  visible: boolean;
  onClose: () => void;
  amount: number;
  onSuccess: () => void;
  onFailed?: () => void;
  theme: any;
  t: any;
  shopName: string;
  upiId: string | null;
}

const UPIQRPayment: React.FC<UPIQRPaymentProps> = ({
  visible,
  onClose,
  amount,
  onSuccess,
  onFailed,
  theme,
  t,
  shopName,
  upiId
}) => {
  const insets = useSafeAreaInsets();
  const { formatPrice } = useCurrency();
  
  useEffect(() => {
    if (visible && !upiId) {
      Alert.alert(
        'UPI Not Configured',
        'Please configure UPI ID in Payment Settings first.',
        [
          {
            text: 'OK',
            onPress: () => {
              onClose();
              if (onFailed) onFailed();
            }
          }
        ]
      );
    }
  }, [visible, upiId]);

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

  const generateUPIUrl = () => {
    if (!upiId) return '';
    const cleanUpiId = upiId.trim();
    const cleanShopName = (shopName || 'Shop').replace(/[&?=]/g, '').trim();
    return `upi://pay?pa=${cleanUpiId}&pn=${cleanShopName}&am=${amount}&cu=INR`;
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.fullScreenModal, { backgroundColor: theme.background }]}>
        
        {/* Header */}
        <View style={[styles.fullScreenHeader, { backgroundColor: theme.primary, paddingTop: insets.top + 15 }]}>
          <Text style={[styles.fullScreenTitle, { color: '#fff' }]}>UPI QR Payment</Text>
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

          {upiId ? (
            <>
              {/* QR Code */}
              <View style={styles.fullQrContainer}>
                <View style={[styles.fullQrBox, { backgroundColor: '#fff' }]}>
                  <QRCode
                    value={generateUPIUrl()}
                    size={220}
                    color="#000"
                    backgroundColor="#fff"
                  />
                </View>
                <Text style={[styles.fullQrSubtext, { color: theme.textSecondary }]}>
                  Ask customer to scan this QR code
                </Text>
              </View>

              {/* Instructions */}
              <View style={[styles.fullInfoBox, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="phone-portrait-outline" size={22} color={theme.primary} />
                <View style={styles.fullInfoTextContainer}>
                  <Text style={[styles.fullInfoText, { color: theme.textSecondary }]}>
                    1. Customer scans QR with any UPI app
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
            <View style={styles.fullNoUpiContainer}>
              <Ionicons name="qr-code-outline" size={60} color={theme.danger} />
              <Text style={[styles.fullNoUpiText, { color: theme.danger }]}>
                UPI ID not configured!
              </Text>
              <Text style={[styles.fullNoUpiSubText, { color: theme.textSecondary }]}>
                Please configure UPI ID in Payment Settings
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.fullButtonContainer}>
            <TouchableOpacity
              style={[styles.fullCancelBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
              onPress={() => {
                if (onFailed) onFailed();
                onClose();
              }}
            >
              <Text style={[styles.fullCancelText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.fullSuccessBtn, { backgroundColor: theme.success, opacity: upiId ? 1 : 0.5 }]}
              onPress={handleManualSuccess}
              disabled={!upiId}
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
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  fullScreenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  fullScreenClose: {
    padding: 5,
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
  fullCancelBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  fullCancelText: {
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
  fullNoUpiContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  fullNoUpiText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
  },
  fullNoUpiSubText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default UPIQRPayment;