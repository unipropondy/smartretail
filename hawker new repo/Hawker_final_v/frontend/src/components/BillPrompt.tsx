// components/BillPrompt.tsx - NAMMA VERSION (Improved)

import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,  // ✅ ADD for backdrop close
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BillPromptProps {
  visible: boolean;
  onClose: () => void;
  onPrintBill: () => void;
  onSkip: () => void;
  theme: any;
  t: any;
  total: number | string;  // ✅ Allow both number and string
  formatPrice?: (amount: number) => string;
}

const BillPrompt: React.FC<BillPromptProps> = ({
  visible,
  onClose,
  onPrintBill,
  onSkip,
  theme,
  t,
  total,
  formatPrice
}) => {
  // ✅ Safe total calculation
  const totalAmount = typeof total === 'string' ? parseFloat(total) : total;
  const displayTotal = formatPrice 
    ? formatPrice(totalAmount || 0) 
    : `$${(totalAmount || 0).toFixed(2)}`;

  // ✅ Close modal when tapping backdrop
  const handleBackdropPress = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalContent, { backgroundColor: theme.card || theme.bgCard || '#fff' }]}>
              
              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: (theme.primary || '#000') + '20' }]}>
                <Ionicons name="receipt-outline" size={50} color={theme.primary || '#000'} />
              </View>
              
              {/* Title */}
              <Text style={[styles.title, { color: theme.text || theme.textPrimary || '#000' }]}>
                {t.printBillReceipt || 'Print Receipt?'}
              </Text>
              
              {/* Amount */}
              <Text style={[styles.amount, { color: theme.primary || '#000' }]}>
                {t.totalAmount || 'Total'}: {displayTotal}
              </Text>
              
              {/* Message */}
              <Text style={[styles.message, { color: theme.textSecondary || '#666' }]}>
                {t.printBillMessage || 'Do you want to print a bill for this transaction?'}
              </Text>
              
              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.skipButton, { borderColor: theme.border || '#ccc' }]}
                  onPress={onSkip}
                >
                  <Text style={[styles.buttonText, { color: theme.text || theme.textPrimary || '#000' }]}>
                    {t.skipBill || 'No, Skip'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.button, styles.printButton, { backgroundColor: theme.primary || '#000' }]}
                  onPress={onPrintBill}
                >
                  <Text style={[styles.buttonText, { color: '#fff' }]}>
                    {t.printBill || 'Yes, Print Bill'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Note */}
              <Text style={[styles.note, { color: theme.textSecondary || '#666' }]}>
                {t.billNote || 'You can also view bill in Sales Report'}
              </Text>
              
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 350,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  amount: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 15,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    borderWidth: 1,
  },
  printButton: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  note: {
    fontSize: 11,
    textAlign: 'center',
  },
});

export default BillPrompt;