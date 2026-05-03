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
  Image,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import API, { uploadAPI } from '../api';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PayNowSettingsProps {
  visible: boolean;
  onClose: () => void;
  userId: number;
  theme: any;
  t: any;
  onUpdate: (qrCodeUrl: string) => void;
}

const PayNowSettings: React.FC<PayNowSettingsProps> = ({
  visible,
  onClose,
  userId,
  theme,
  t,
  onUpdate
}) => {
  const insets = useSafeAreaInsets();
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [enablePayNow, setEnablePayNow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  // ALL YOUR EXISTING FUNCTIONS REMAIN EXACTLY THE SAME
  useEffect(() => {
    if (visible) {
      loadPayNowSettings();
    }
  }, [visible]);

  const loadPayNowSettings = async () => {
    setLoading(true);
    try {
      const response = await API.get(`/user/paynow/${userId}`);
      const savedQrUrl = response.data.qrCodeUrl || '';
      setQrCodeUrl(savedQrUrl);
      setEnablePayNow(!!savedQrUrl);
    } catch (error) {
      console.log('Error loading PayNow:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      if (typeof window !== 'undefined' && window.__markImagePickerOpen) {
        console.log('📸 Marking image picker as open');
        window.__markImagePickerOpen();
      }
      setImageUploading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await uploadImage(imageUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setImageUploading(false);
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.__markImagePickerClose) {
          console.log('📸 Marking image picker as closed (after delay)');
          window.__markImagePickerClose();
        }
      }, 500);
    }
  };

  const uploadImage = async (uri: string) => {
    try {
      console.log('📤 Starting upload for:', uri);
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      const formData = new FormData();
      formData.append('image', {
        uri,
        name: filename || 'paynow-qr.jpg',
        type,
      } as any);
      const baseURL = 'https://smartretail-production-5457.up.railway.app/api';
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(`${baseURL}/upload`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000,
      });
      const imageUrl = response.data.imageUrl || response.data.imageUri;
      const fullImageUrl = imageUrl.startsWith('http') 
        ? imageUrl 
        : `https://smartretail-production-5457.up.railway.app${imageUrl}`;
      setQrCodeUrl(fullImageUrl);
      Alert.alert('✅ Success', 'QR code uploaded successfully');
    } catch (error: any) {
      console.log('❌ Upload error:', error);
      let errorMsg = 'Failed to upload image';
      if (error.code === 'ECONNABORTED') {
        errorMsg = 'Upload timeout - please try again';
      } else if (error.message === 'Network Error') {
        errorMsg = 'Network error - check your connection';
      } else if (error.response?.status === 404) {
        errorMsg = 'Upload endpoint not found - check URL';
      } else if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      }
      Alert.alert('❌ Error', errorMsg);
    }
  };

  const savePayNowSettings = async () => {
    if (enablePayNow && !qrCodeUrl) {
      Alert.alert('Error', 'Please upload PayNow QR code first');
      return;
    }
    setSaving(true);
    try {
      await API.put('/user/update-paynow', {
        userId,
        qrCodeUrl: enablePayNow ? qrCodeUrl : null
      });
      const modesResponse = await API.get(`/user/payment-modes/${userId}`);
      let paymentModes = modesResponse.data.paymentModes || [];
      let payNowMode = paymentModes.find((m: any) => m.id === 'paynow');
      if (!payNowMode) {
        payNowMode = {
          id: 'paynow',
          name: 'PayNow',
          icon: '📱',
          description: 'PayNow QR payment',
          isActive: enablePayNow,
          order: paymentModes.length
        };
        paymentModes.push(payNowMode);
      } else {
        payNowMode.isActive = enablePayNow;
      }
      await API.put('/user/payment-modes', {
        userId,
        paymentModes
      });
      onUpdate(qrCodeUrl);
      setTimeout(() => {
        Alert.alert('✅ Success', 'PayNow settings saved');
        onClose();
      }, 100);
    } catch (error: any) {
      console.log('❌ Save error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.fullScreenModal, { backgroundColor: theme.background }]}>
        
        {/* Header - Full Screen */}
        <View style={[styles.fullScreenHeader, { backgroundColor: theme.primary, paddingTop: insets.top + 2 }]}>
          <Text style={[styles.fullScreenTitle, { color: '#fff' }]}>💳 PayNow Settings</Text>
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
              {/* Enable PayNow Switch */}
              <View style={[styles.fullCard, { backgroundColor: theme.surface }]}>
                <View style={styles.fullSwitchRow}>
                  <View style={styles.fullSwitchLeft}>
                    <Ionicons name="qr-code-outline" size={24} color={theme.primary} />
                    <Text style={[styles.fullSwitchLabel, { color: theme.text }]}>
                      Enable PayNow
                    </Text>
                  </View>
                  <Switch
                    value={enablePayNow}
                    onValueChange={setEnablePayNow}
                    trackColor={{ false: theme.inactive, true: theme.success }}
                    thumbColor="#fff"
                  />
                </View>
              </View>

              {enablePayNow && (
                <>
                  {/* QR Code Upload */}
                  <View style={[styles.fullCard, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>
                      PayNow QR Code *
                    </Text>

                    {qrCodeUrl ? (
                      <View style={styles.fullQrPreviewContainer}>
                        <Image 
                          source={{ uri: qrCodeUrl }}
                          style={styles.fullQrPreview}
                          resizeMode="contain"
                        />
                        <TouchableOpacity
                          style={styles.fullRemoveImageButton}
                          onPress={() => setQrCodeUrl('')}
                        >
                          <Ionicons name="close-circle" size={24} color={theme.danger} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.fullUploadButton, { backgroundColor: theme.primary }]}
                        onPress={pickImage}
                        disabled={imageUploading}
                      >
                        {imageUploading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="cloud-upload" size={24} color="#fff" />
                            <Text style={styles.fullUploadButtonText}>Upload QR Code</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}

                    <Text style={[styles.fullHelper, { color: theme.textSecondary }]}>
                      Upload your PayNow QR code image
                    </Text>
                  </View>

                  {/* Preview Card */}
                  <View style={[styles.fullPreviewCard, { backgroundColor: theme.primary + '20' }]}>
                    <Text style={[styles.fullPreviewTitle, { color: theme.primary }]}>
                      PayNow Preview
                    </Text>
                    <View style={styles.fullPreviewRow}>
                      <Text style={[styles.fullPreviewLabel, { color: theme.textSecondary }]}>
                        Status:
                      </Text>
                      <Text style={[styles.fullPreviewValue, { color: qrCodeUrl ? theme.success : theme.danger }]}>
                        {qrCodeUrl ? '✅ QR Code Ready' : '❌ No QR Code'}
                      </Text>
                    </View>
                  </View>
                </>
              )}

              {/* Info Box */}
              <View style={[styles.fullInfoBox, { backgroundColor: theme.info + '20' }]}>
                <Ionicons name="information-circle" size={20} color={theme.info} />
                <Text style={[styles.fullInfoText, { color: theme.textSecondary }]}>
                  When enabled, PayNow will appear as a payment option. 
                  Customers can scan the QR code to pay.
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
                  onPress={savePayNowSettings}
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
  fullQrPreviewContainer: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 12,
  },
  fullQrPreview: {
    width: 200,
    height: 200,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  fullRemoveImageButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 2,
  },
  fullUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
  },
  fullUploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  fullHelper: {
    fontSize: 12,
    marginTop: 4,
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

export default PayNowSettings;