import React, { useState, useEffect } from 'react';
import { Platform, StatusBar, Image } from 'react-native';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import BillPDFGenerator from './BillPDFGenerator';
import { useCurrency } from '../context/CurrencyContext';
import API, { uploadAPI } from '../api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetworkPrinterService from './NetworkPrinterService';
declare global {
  interface Window {
    __markImagePickerOpen?: () => void;
    __markImagePickerClose?: () => void;
  }
}

interface CompanySettings {
  name: string;
  address: string;
  gstNo: string;
  gstPercentage: number;
  phone: string;
  email: string;
  cashierName: string;
  currency: string;
  currencySymbol: string;
  companyLogo?: string;
  halalLogo?: string;
  showCompanyLogo?: boolean;
  showHalalLogo?: boolean;
  printerType?: 'network' | 'sunmi';
  printerIP?: string;
  printerPort?: number;
  printerEnabled?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: CompanySettings) => void;
  theme: any;
  t: any;
  clientId?: string | number;
  userShopName?: string;
  defaultCashier?: string;
}

const CompanySettingsForm: React.FC<Props> = ({
  visible,
  onClose,
  onSave,
  theme,
  t,
  clientId,
  userShopName,
  defaultCashier
}) => {
  const insets = useSafeAreaInsets();
  const { refreshCurrency } = useCurrency();

  const [settings, setSettings] = useState<CompanySettings>({
    name: userShopName || '',
    address: '',
    gstNo: '',
    gstPercentage: 9,
    phone: '',
    email: '',
    cashierName: defaultCashier || '',
    currency: 'SGD',
    currencySymbol: '$',
    companyLogo: '',
    halalLogo: '',
    showCompanyLogo: true,
    showHalalLogo: true,
  });

  const [enableGST, setEnableGST] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCompanyLogo, setUploadingCompanyLogo] = useState(false);
  const [uploadingHalalLogo, setUploadingHalalLogo] = useState(false);
  // Add these with other useState declarations
  const [printerType, setPrinterType] = useState<'network' | 'sunmi'>('network');
  const [printerIP, setPrinterIP] = useState('192.168.0.244'); // ← Change to 244!
  const [printerPort, setPrinterPort] = useState('80');
  const [printerEnabled, setPrinterEnabled] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState(false);
  useEffect(() => {
    if (visible) {
      loadClientSettings();
    }
  }, [visible, clientId]);

  useEffect(() => {
    if (defaultCashier) {
      setSettings(prev => ({ ...prev, cashierName: defaultCashier }));
    }
  }, [defaultCashier]);

  useEffect(() => {
    if (userShopName) {
      setSettings(prev => ({ ...prev, name: userShopName }));
    }
  }, [userShopName]);

  const loadClientSettings = async () => {
    try {
      if (clientId) {
        console.log('🔄 Loading client settings with clientId:', clientId);
        console.log('🔄 clientId type:', typeof clientId);
        console.log('🔄 userShopName from parent:', userShopName);

        const savedSettings = await BillPDFGenerator.loadSettings(clientId);

        console.log('📥 SAVED SETTINGS FROM BILLPDFGENERATOR:', {
          showCompanyLogo: savedSettings.showCompanyLogo,
          showHalalLogo: savedSettings.showHalalLogo,
          name: savedSettings.name,
          type: typeof savedSettings.showCompanyLogo
        });

        setSettings({
          name: userShopName || savedSettings.name || '',
          address: savedSettings.address || '',
          gstNo: savedSettings.gstNo || '',
          gstPercentage: savedSettings.gstPercentage || 0,
          phone: savedSettings.phone || '',
          email: savedSettings.email || '',
          cashierName: savedSettings.cashierName || defaultCashier || '',
          currency: savedSettings.currency || 'SGD',
          currencySymbol: savedSettings.currencySymbol || '$',
          companyLogo: savedSettings.companyLogo || '',
          halalLogo: savedSettings.halalLogo || '',
          showCompanyLogo: savedSettings.showCompanyLogo,
          showHalalLogo: savedSettings.showHalalLogo,
          printerType: savedSettings.printerType || 'network',
          printerIP: savedSettings.printerIP || '192.168.0.241',
          printerPort: savedSettings.printerPort || 9100,
          printerEnabled: savedSettings.printerEnabled || false,
        });

        setEnableGST(savedSettings.gstPercentage > 0);
        setPrinterType(savedSettings.printerType || 'network');
        setPrinterIP(savedSettings.printerIP || '192.168.0.241');
        setPrinterPort(savedSettings.printerPort?.toString() || '9100');
        setPrinterEnabled(savedSettings.printerEnabled || false);
      } else {
        console.log('⚠️ No clientId provided!');
      }
    } catch (error) {
      console.log('Error loading settings:', error);
    }
  };

  const uploadLogo = async (imageUri: string, type: 'company' | 'halal') => {
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        name: `${type}-logo-${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);

      const response = await uploadAPI.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const imageUrl = response.data.imageUrl || response.data.imageUri;
      const fullUrl = imageUrl.startsWith('http') ? imageUrl : `https://smartretail-production-5457.up.railway.app${imageUrl}`;

      if (type === 'company') {
        setSettings(prev => ({ ...prev, companyLogo: fullUrl }));
      } else {
        setSettings(prev => ({ ...prev, halalLogo: fullUrl }));
      }

      return fullUrl;
    } catch (error) {
      console.log('Upload error:', error);
      throw error;
    }
  };

  const pickImage = async (type: 'company' | 'halal') => {
    try {
      // @ts-ignore
      if (window.__markImagePickerOpen) {
        console.log('📸 Marking image picker as open');
        window.__markImagePickerOpen();
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        if (type === 'company') {
          setUploadingCompanyLogo(true);
          await uploadLogo(result.assets[0].uri, 'company');
          setUploadingCompanyLogo(false);
        } else {
          setUploadingHalalLogo(true);
          await uploadLogo(result.assets[0].uri, 'halal');
          setUploadingHalalLogo(false);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image');
      if (type === 'company') setUploadingCompanyLogo(false);
      else setUploadingHalalLogo(false);
    } finally {
      setTimeout(() => {
        // @ts-ignore
        if (window.__markImagePickerClose) {
          console.log('📸 Marking image picker as closed (after delay)');
          window.__markImagePickerClose();
        }
      }, 500);
    }
  };

  const removeLogo = (type: 'company' | 'halal') => {
    if (type === 'company') {
      setSettings(prev => ({ ...prev, companyLogo: '' }));
    } else {
      setSettings(prev => ({ ...prev, halalLogo: '' }));
    }
  };

  const handleSave = async () => {
    console.log('🔍 HANDLE SAVE - Current settings:', {
      showCompanyLogo: settings.showCompanyLogo,
      showHalalLogo: settings.showHalalLogo,
      gstPercentage: settings.gstPercentage,
      enableGST: enableGST,
      companyLogo: settings.companyLogo ? 'YES' : 'NO',
      halalLogo: settings.halalLogo ? 'YES' : 'NO'
    });

    if (!settings.name.trim()) {
      Alert.alert(t.error, 'Shop name is required for bill receipt');
      return;
    }

    const finalSettings = {
      ...settings,
      gstPercentage: enableGST ? settings.gstPercentage : 0,
      showCompanyLogo: settings.showCompanyLogo,
      showHalalLogo: settings.showHalalLogo,
      companyLogo: settings.companyLogo,
      halalLogo: settings.halalLogo,
      printerType: printerType,
      printerIP: printerIP,
      printerPort: parseInt(printerPort),
      printerEnabled: printerEnabled
    };

    console.log('🔍 FINAL SETTINGS TO SAVE:', {
      gstPercentage: finalSettings.gstPercentage,
      enableGST: enableGST,
      showCompanyLogo: finalSettings.showCompanyLogo,
      showHalalLogo: finalSettings.showHalalLogo
    });

    setSaving(true);

    try {
      const success = await BillPDFGenerator.saveSettings(finalSettings, clientId);

      if (success) {
        console.log('✅ Save successful, waiting for DB commit...');
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('🔄 Reloading settings from DB...');
        const freshSettings = await BillPDFGenerator.loadSettings(clientId);

        console.log('📥 FRESH SETTINGS FROM DB:', {
          gstPercentage: freshSettings.gstPercentage,
          showCompanyLogo: freshSettings.showCompanyLogo,
          showHalalLogo: freshSettings.showHalalLogo,
          companyLogo: freshSettings.companyLogo ? 'YES' : 'NO',
          halalLogo: freshSettings.halalLogo ? 'YES' : 'NO'
        });

        setSettings({
          ...settings,
          gstPercentage: freshSettings.gstPercentage,
          showCompanyLogo: freshSettings.showCompanyLogo,
          showHalalLogo: freshSettings.showHalalLogo,
          companyLogo: freshSettings.companyLogo,
          halalLogo: freshSettings.halalLogo
        });
        if (clientId) {
          await API.post(`/company-settings/printer/${clientId}`, {
            printerType,
            printerIP,
            printerPort: parseInt(printerPort),
            printerEnabled
          }).catch(err => console.log('Printer save error:', err));
        }
        setEnableGST(freshSettings.gstPercentage > 0);
        await refreshCurrency();
        await new Promise(resolve => setTimeout(resolve, 300));
        onSave(finalSettings);
        Alert.alert(t.success, 'Settings saved successfully');
        onClose();
      } else {
        Alert.alert(t.error, 'Failed to save settings');
      }
    } catch (error) {
      console.log('❌ Save error:', error);
      Alert.alert(t.error, 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const currencyOptions = [
    { code: 'SGD', symbol: '$', name: 'Singapore Dollar' },
    { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
  ];
  const testNetworkPrinter = async () => {
    setTestingPrinter(true);

    try {
      const ip = printerIP.trim();
      const port = parseInt(printerPort) || 9100;

      console.log(`🔍 Testing printer at ${ip}:${port}`);

      // ✅ Call the test function from NetworkPrinterService
      const result = await NetworkPrinterService.testConnection(ip, port);

      if (result) {
        Alert.alert(
          '✅ Success',
          `Printer is reachable at ${ip}:${port}!`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          '❌ Failed',
          `Cannot reach printer at ${ip}:${port}\n\n` +
          `Please check:\n` +
          `• Printer is ON\n` +
          `• Same WiFi network\n` +
          `• IP address is correct: ${ip}\n` +
          `• Port is correct: ${port}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.log('Test error:', error);
      Alert.alert('Error', 'Failed to test printer: ' + (error?.message || 'Unknown error'));
    } finally {
      setTestingPrinter(false);
    }
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.fullScreenModal, { backgroundColor: theme.background }]}>

        {/* Header - Full Screen */}
        <View style={[styles.fullScreenHeader, { backgroundColor: theme.primary, paddingTop: insets.top }]}>
          <Text style={[styles.fullScreenTitle, { color: '#fff' }]}>Bill Settings</Text>
          <TouchableOpacity onPress={onClose} style={styles.fullScreenClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.fullScreenScroll}
          contentContainerStyle={styles.fullScreenContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {/* Shop Name - READONLY */}
          <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>Shop Name (from Admin) *</Text>
          <View style={[styles.fullReadonlyField, {
            backgroundColor: theme.surface + '80',
            borderColor: theme.border
          }]}>
            <Text style={[styles.fullReadonlyText, { color: theme.text }]}>
              {settings.name || 'Not set'}
            </Text>
          </View>

          {/* Address */}
          <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>Address</Text>
          <TextInput
            style={[styles.fullInput, styles.fullTextArea, {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border
            }]}
            value={settings.address}
            onChangeText={(text) => setSettings({ ...settings, address: text })}
            placeholder="Enter address"
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={3}
            editable={!saving}
          />

          {/* Logo Section */}
          <View style={styles.fullSectionHeader}>
            <Text style={[styles.fullSectionTitle, { color: theme.text }]}>🖼️ Bill Logo Settings</Text>
            <Text style={[styles.fullSectionHint, { color: theme.textSecondary }]}>
              Logos will appear on bill receipts
            </Text>
          </View>

          {/* Company Logo Toggle */}
          <View style={[styles.fullCard, { backgroundColor: theme.surface }]}>
            <View style={styles.fullSwitchRow}>
              <View style={styles.fullSwitchLeft}>
                <Ionicons name="business" size={24} color={theme.primary} />
                <Text style={[styles.fullSwitchLabel, { color: theme.text }]}>Show Company Logo</Text>
              </View>
              <Switch
                value={settings.showCompanyLogo}
                onValueChange={(val) => setSettings(prev => ({ ...prev, showCompanyLogo: val }))}
                trackColor={{ false: theme.inactive, true: theme.success }}
                thumbColor="#fff"
                disabled={saving}
              />
            </View>

            {settings.showCompanyLogo && (
              <View style={styles.fullLogoUploadContainer}>
                <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>Company Logo</Text>

                {settings.companyLogo ? (
                  <View style={styles.fullLogoPreviewContainer}>
                    <Image source={{ uri: settings.companyLogo }} style={styles.fullLogoPreview} />
                    <TouchableOpacity style={styles.fullRemoveLogoButton} onPress={() => removeLogo('company')}>
                      <Ionicons name="close-circle" size={24} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.fullUploadButton, { backgroundColor: theme.primary }]}
                    onPress={() => pickImage('company')}
                    disabled={uploadingCompanyLogo || saving}
                  >
                    {uploadingCompanyLogo ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={20} color="#fff" />
                        <Text style={styles.fullUploadButtonText}>Upload Company Logo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Halal Logo Toggle */}
          <View style={[styles.fullCard, { backgroundColor: theme.surface }]}>
            <View style={styles.fullSwitchRow}>
              <View style={styles.fullSwitchLeft}>
                <Ionicons name="restaurant" size={24} color={theme.primary} />
                <Text style={[styles.fullSwitchLabel, { color: theme.text }]}>Show Halal Logo</Text>
              </View>
              <Switch
                value={settings.showHalalLogo}
                onValueChange={(val) => setSettings(prev => ({ ...prev, showHalalLogo: val }))}
                trackColor={{ false: theme.inactive, true: theme.success }}
                thumbColor="#fff"
                disabled={saving}
              />
            </View>

            {settings.showHalalLogo && (
              <View style={styles.fullLogoUploadContainer}>
                <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>Halal Logo</Text>

                {settings.halalLogo ? (
                  <View style={styles.fullLogoPreviewContainer}>
                    <Image source={{ uri: settings.halalLogo }} style={styles.fullLogoPreview} />
                    <TouchableOpacity style={styles.fullRemoveLogoButton} onPress={() => removeLogo('halal')}>
                      <Ionicons name="close-circle" size={24} color={theme.danger} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.fullUploadButton, { backgroundColor: theme.primary }]}
                    onPress={() => pickImage('halal')}
                    disabled={uploadingHalalLogo || saving}
                  >
                    {uploadingHalalLogo ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload" size={20} color="#fff" />
                        <Text style={styles.fullUploadButtonText}>Upload Halal Logo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Currency Quick Selection */}
          <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>Quick Currency Select</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fullCurrencyScroll}>
            {currencyOptions.map((curr) => (
              <TouchableOpacity
                key={curr.code}
                style={[
                  styles.fullCurrencyChip,
                  {
                    backgroundColor: settings.currency === curr.code ? theme.primary : theme.surface,
                    borderColor: theme.border
                  }
                ]}
                onPress={() => setSettings({
                  ...settings,
                  currency: curr.code,
                  currencySymbol: curr.symbol
                })}
              >
                <Text style={[
                  styles.fullCurrencyChipText,
                  { color: settings.currency === curr.code ? '#fff' : theme.text }
                ]}>
                  {curr.code} ({curr.symbol})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Currency Code */}
          <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>Currency Code</Text>
          <TextInput
            style={[styles.fullInput, {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border
            }]}
            value={settings.currency}
            onChangeText={(text) => {
              const upperText = text.toUpperCase();
              let symbol = settings.currencySymbol;
              if (upperText === 'SGD') symbol = '$';
              else if (upperText === 'MYR') symbol = 'RM';
              else if (upperText === 'INR') symbol = '₹';
              else if (upperText === 'USD') symbol = '$';
              else if (upperText === 'EUR') symbol = '€';
              else if (upperText === 'GBP') symbol = '£';
              setSettings({ ...settings, currency: upperText, currencySymbol: symbol });
            }}
            placeholder="SGD, MYR, INR, USD"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="characters"
            maxLength={3}
            editable={!saving}
          />

          {/* Currency Symbol */}
          <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>Currency Symbol</Text>
          <TextInput
            style={[styles.fullInput, {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border
            }]}
            value={settings.currencySymbol}
            onChangeText={(text) => setSettings({ ...settings, currencySymbol: text })}
            placeholder="$"
            placeholderTextColor={theme.textSecondary}
            maxLength={3}
            editable={!saving}
          />

          {/* GST Toggle */}
          <View style={styles.fullSwitchRow}>
            <Text style={[styles.fullSwitchLabel, { color: theme.text }]}>Enable GST</Text>
            <Switch
              value={enableGST}
              onValueChange={setEnableGST}
              trackColor={{ false: theme.inactive, true: theme.primary }}
              thumbColor="#fff"
              disabled={saving}
            />
          </View>

          {enableGST && (
            <>
              <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>GST Number</Text>
              <TextInput
                style={[styles.fullInput, {
                  backgroundColor: theme.surface,
                  color: theme.text,
                  borderColor: theme.border
                }]}
                value={settings.gstNo}
                onChangeText={(text) => setSettings({ ...settings, gstNo: text })}
                placeholder="Enter GST number"
                placeholderTextColor={theme.textSecondary}
                editable={!saving}
              />

              <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>GST Percentage (%)</Text>
              <TextInput
                style={[styles.fullInput, {
                  backgroundColor: theme.surface,
                  color: theme.text,
                  borderColor: theme.border
                }]}
                value={settings.gstPercentage === 0 ? '' : settings.gstPercentage.toString()}
                onChangeText={(text) => {
                  if (text === '') {
                    setSettings({ ...settings, gstPercentage: 0 });
                  } else {
                    const num = parseFloat(text);
                    if (!isNaN(num)) setSettings({ ...settings, gstPercentage: num });
                  }
                }}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                editable={!saving && enableGST}
              />
            </>
          )}

          {/* Phone */}
          <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>Phone Number</Text>
          <TextInput
            style={[styles.fullInput, {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border
            }]}
            value={settings.phone}
            onChangeText={(text) => setSettings({ ...settings, phone: text })}
            placeholder="Enter phone number"
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
            editable={!saving}
          />

          {/* Email */}
          <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>Email Address</Text>
          <TextInput
            style={[styles.fullInput, {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border
            }]}
            value={settings.email}
            onChangeText={(text) => setSettings({ ...settings, email: text })}
            placeholder="Enter email"
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            editable={!saving}
          />

          {/* Cashier Name */}
          <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>Default Cashier Name</Text>
          <TextInput
            style={[styles.fullInput, {
              backgroundColor: theme.surface,
              color: theme.text,
              borderColor: theme.border
            }]}
            value={settings.cashierName}
            onChangeText={(text) => setSettings({ ...settings, cashierName: text })}
            placeholder="Cashier name"
            placeholderTextColor={theme.textSecondary}
            editable={!saving}
          />

          {/* Printer Settings Header */}
          <View style={styles.fullSectionHeader}>
            <Text style={[styles.fullSectionTitle, { color: theme.text }]}>🖨️ Printer Settings</Text>
            <Text style={[styles.fullSectionHint, { color: theme.textSecondary }]}>
              Configure Network / Thermal Printer
            </Text>
          </View>

          {/* Network Printer Toggle */}
          <View style={[styles.fullCard, { backgroundColor: theme.surface }]}>
            <View style={styles.fullSwitchRow}>
              <View style={styles.fullSwitchLeft}>
                <Ionicons name="print" size={24} color={theme.primary} />
                <Text style={[styles.fullSwitchLabel, { color: theme.text }]}>Network Printer</Text>
              </View>
              <Switch
                value={printerEnabled}
                onValueChange={(val) => {
                  setPrinterEnabled(val);
                }}
                trackColor={{ false: theme.inactive, true: theme.success }}
                thumbColor="#fff"
                disabled={saving}
              />
            </View>

            {printerEnabled && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>Printer IP Address</Text>
                <TextInput
                  style={[styles.fullInput, {
                    backgroundColor: theme.background,
                    color: theme.text,
                    borderColor: theme.border
                  }]}
                  value={printerIP}
                  onChangeText={setPrinterIP}
                  placeholder="e.g. 192.168.0.241"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  editable={!saving}
                />

                <Text style={[styles.fullLabel, { color: theme.textSecondary }]}>Printer Port</Text>
                <TextInput
                  style={[styles.fullInput, {
                    backgroundColor: theme.background,
                    color: theme.text,
                    borderColor: theme.border
                  }]}
                  value={printerPort}
                  onChangeText={setPrinterPort}
                  placeholder="e.g. 9100"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numeric"
                  editable={!saving}
                />

                <TouchableOpacity
                  style={[styles.testPrinterBtn, { backgroundColor: theme.primary }]}
                  onPress={testNetworkPrinter}
                  disabled={testingPrinter || saving}
                >
                  {testingPrinter ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Test Connection</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> :
                <Text style={[styles.fullSaveText, { color: '#fff' }]}>Save Settings</Text>}
            </TouchableOpacity>
          </View>

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
    paddingBottom: 1,
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
  fullLabel: {
    fontSize: 14,
    marginBottom: 1,
    marginTop: 1,
  },
  fullInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    marginBottom: 10,
    minHeight: 50,
  },
  fullTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fullReadonlyField: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    justifyContent: 'center',
    minHeight: 50,
  },
  fullReadonlyText: {
    fontSize: 15,
    fontWeight: '500',
  },
  fullSectionHeader: {
    marginTop: 20,
    marginBottom: 10,
  },
  fullSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  fullSectionHint: {
    fontSize: 12,
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
    marginVertical: 10,
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
  fullLogoUploadContainer: {
    marginTop: 12,
  },
  fullLogoPreviewContainer: {
    position: 'relative',
    alignItems: 'center',
    marginBottom: 12,
  },
  fullLogoPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  fullRemoveLogoButton: {
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
  fullCurrencyScroll: {
    flexDirection: 'row',
    marginBottom: 16,
    maxHeight: 50,
  },
  fullCurrencyChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    justifyContent: 'center',
  },
  fullCurrencyChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  fullButtonContainer: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 25,
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
  // Add these to the styles object
  printerTypeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  printerTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  testPrinterBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
});

export default CompanySettingsForm;