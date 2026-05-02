import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '../api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
interface UPISettingsProps {
  visible: boolean;
  onClose: () => void;
  userId: number;
  theme: any;
  t: any;
  onUpdate: (upiId: string) => void;
}

const UPISettings: React.FC<UPISettingsProps> = ({
  visible,
  onClose,
  userId,
  theme,
  t,
  onUpdate
}) => {
  const insets = useSafeAreaInsets();
  const [upiId, setUpiId] = useState('');
  const [enableUPI, setEnableUPI] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ALL YOUR EXISTING FUNCTIONS REMAIN EXACTLY THE SAME
  useEffect(() => {
    if (visible) {
      loadUPISettings();
    }
  }, [visible]);

const loadUPISettings = async () => {
  setLoading(true);
  try {
    // ✅ Get outlet ID first
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    const targetId = outletId || userId;
    
    console.log('📡 Loading UPI for target:', targetId);
    
    const response = await API.get(`/user/upi/${targetId}`);
    const savedUpiId = response.data.upiId || '';
    
    console.log('📥 UPI loaded:', savedUpiId || 'none');
    
    setUpiId(savedUpiId);
    setEnableUPI(!!savedUpiId);
  } catch (error) {
    console.log('Error loading UPI:', error);
  } finally {
    setLoading(false);
  }
};
  const saveUPISettings = async () => {
  if (enableUPI && !upiId.trim()) {
    Alert.alert('Error', 'Please enter UPI ID');
    return;
  }
  if (enableUPI && !upiId.includes('@')) {
    Alert.alert('Error', 'Invalid UPI ID format (should contain @)');
    return;
  }
  
  setSaving(true);
  try {
    // ✅ Get outlet ID for correct target
    const outletId = await AsyncStorage.getItem('selectedOutletId');
    const targetId = outletId || userId;
    
    console.log('💾 Saving UPI for target:', targetId);
    
    // 1️⃣ Save UPI ID to database using targetId
    await API.put('/user/update-upi', {
      userId: targetId,  // ✅ Changed from userId to targetId
      upiId: enableUPI ? upiId.trim() : null
    });
    
    // 2️⃣ Get current payment modes using targetId
    const modesResponse = await API.get(`/user/payment-modes/${targetId}`);
    let paymentModes = modesResponse.data.paymentModes || [];
    
    const upiIndex = paymentModes.findIndex((m: any) => m.id === 'upi');
    
    if (enableUPI) {
      if (upiIndex === -1) {
        const newUPIMode = {
          id: 'upi',
          name: 'UPI',
          icon: '📱',
          description: 'UPI QR payment',
          isActive: true,
          order: paymentModes.length
        };
        paymentModes.push(newUPIMode);
      } else {
        paymentModes[upiIndex] = {
          ...paymentModes[upiIndex],
          isActive: true,
          name: 'UPI',
          icon: '📱'
        };
      }
    } else {
      if (upiIndex !== -1) {
        paymentModes[upiIndex] = {
          ...paymentModes[upiIndex],
          isActive: false
        };
      }
    }
    
    // 3️⃣ Save updated payment modes using targetId
    await API.put('/user/payment-modes', {
      userId: targetId,  // ✅ Changed from userId to targetId
      paymentModes
    });
    
    console.log('✅ UPI settings saved for target:', targetId);
    Alert.alert('✅ Success', 'UPI settings saved');
    onUpdate(enableUPI ? upiId.trim() : '');
    onClose();
    
  } catch (error: any) {
    console.log('❌ Error saving UPI:', error.response?.data || error.message);
    Alert.alert('Error', error.response?.data?.error || 'Failed to save UPI settings');
  } finally {
    setSaving(false);
  }
};
  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.fullScreenModal, { backgroundColor: theme.background }]}>
        
        {/* Header - Full Screen */}
        <View style={[styles.fullScreenHeader, { backgroundColor: theme.primary, paddingTop: insets.top + 15 }]}>
          <Text style={[styles.fullScreenTitle, { color: '#fff' }]}>📱 UPI Payment Settings</Text>
          <TouchableOpacity onPress={onClose} style={styles.fullScreenClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.fullScreenScroll}
          contentContainerStyle={styles.fullScreenContent}
          showsVerticalScrollIndicator={true}
        >
          {loading ? (
            <View style={styles.fullLoadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <>
              {/* Enable UPI Switch */}
              <View style={[styles.fullCard, { backgroundColor: theme.surface }]}>
                <View style={styles.fullSwitchRow}>
                  <View style={styles.fullSwitchLeft}>
                    <Ionicons name="qr-code-outline" size={24} color={theme.primary} />
                    <Text style={[styles.fullSwitchLabel, { color: theme.text }]}>
                      Enable UPI Payments
                    </Text>
                  </View>
                  <Switch
                    value={enableUPI}
                    onValueChange={setEnableUPI}
                    trackColor={{ false: theme.inactive, true: theme.success }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              {enableUPI && (
                <>
                  {/* UPI ID Input */}
                  <View style={[styles.fullCard, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>
                      Your UPI ID *
                    </Text>
                    <TextInput
                      style={[styles.fullInput, { 
                        backgroundColor: theme.card,
                        color: theme.text,
                        borderColor: theme.border
                      }]}
                      placeholder="e.g. shopname@okhdfcbank"
                      placeholderTextColor={theme.textSecondary}
                      value={upiId}
                      onChangeText={setUpiId}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />

                    <Text style={[styles.fullHelper, { color: theme.textSecondary }]}>
                      This UPI ID will be used for QR payments
                    </Text>

                    {/* Examples */}
                    <Text style={[styles.fullExampleTitle, { color: theme.textSecondary }]}>
                      Examples:
                    </Text>
                    <TouchableOpacity onPress={() => setUpiId('shop@okhdfcbank')}>
                      <Text style={[styles.fullExample, { color: theme.primary }]}>
                        • shop@okhdfcbank
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setUpiId('shop@icici')}>
                      <Text style={[styles.fullExample, { color: theme.primary }]}>
                        • shop@icici
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setUpiId('shop@ybl')}>
                      <Text style={[styles.fullExample, { color: theme.primary }]}>
                        • shop@ybl (PhonePe)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Preview Card */}
                  <View style={[styles.fullPreviewCard, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={[styles.fullPreviewTitle, { color: theme.primary }]}>
                      QR Payment Preview
                    </Text>
                    <View style={styles.fullPreviewRow}>
                      <Text style={[styles.fullPreviewLabel, { color: theme.textSecondary }]}>
                        UPI ID:
                      </Text>
                      <Text style={[styles.fullPreviewValue, { color: theme.text }]}>
                        {upiId || 'Not set'}
                      </Text>
                    </View>
                    <View style={styles.fullPreviewRow}>
                      <Text style={[styles.fullPreviewLabel, { color: theme.textSecondary }]}>
                        Status:
                      </Text>
                      <Text style={[styles.fullPreviewValue, { color: upiId ? theme.success : theme.danger }]}>
                        {upiId ? '✅ Active' : '❌ Inactive'}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {/* Info Box */}
              <View style={[styles.fullInfoBox, { backgroundColor: theme.info + '20' }]}>
                <Ionicons name="information-circle" size={20} color={theme.info} />
                <Text style={[styles.fullInfoText, { color: theme.textSecondary }]}>
                  When enabled, UPI will appear as a payment option in checkout.
                  Customers can scan QR code or tap to open UPI app.
                </Text>
              </View>

              {/* Buttons */}
              <View style={styles.fullButtonContainer}>
                <TouchableOpacity
                  style={[styles.fullCancelBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
                  onPress={onClose}
                  disabled={saving}
                >
                  <Text style={[styles.fullCancelText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.fullSaveBtn, { backgroundColor: theme.primary }]}
                  onPress={saveUPISettings}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.fullSaveText}>Save Settings</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
          
          <View style={{ height: 30 }} />
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Full Screen Styles
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
  fullLoadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  fullCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  fullSwitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullSwitchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fullSwitchLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  fullLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  fullInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    marginBottom: 10,
    minHeight: 50,
  },
  fullHelper: {
    fontSize: 12,
    marginBottom: 12,
  },
  fullExampleTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  fullExample: {
    fontSize: 13,
    paddingVertical: 2,
  },
  fullPreviewCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  fullPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  fullPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fullPreviewLabel: {
    fontSize: 13,
  },
  fullPreviewValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  fullInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  fullInfoText: {
    flex: 1,
    fontSize: 12,
  },
  fullButtonContainer: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 10,
  },
  fullCancelBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  fullCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  fullSaveBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  fullSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UPISettings;