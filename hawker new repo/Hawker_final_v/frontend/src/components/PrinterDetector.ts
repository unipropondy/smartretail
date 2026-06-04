// components/PrinterDetector.ts
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let SunmiModule: any = null;
if (Platform.OS === 'android') {
  try {
    SunmiModule = require('sunmi-printer-expo');
  } catch (e) {
    console.log('Sunmi module not available');
  }
}

export class PrinterDetector {
  
  // ✅ This returns the correct type
  static async detectPrinter(): Promise<'sunmi' | 'network' | 'usb' | 'bluetooth' | 'pdf'> {
    console.log('🔍 Starting printer detection...');
    
    if (Platform.OS !== 'android') {
      console.log('📱 Not Android, checking network printer...');
      const networkReady = await this.checkNetworkPrinter();
      if (networkReady) return 'network';
      return 'pdf';
    }
    
    // 1. Check Sunmi
    const sunmiReady = await this.checkSunmiPrinter();
    if (sunmiReady) {
      console.log('✅ Sunmi printer detected');
      return 'sunmi';
    }
    
    // 2. Check USB printers
    const usbReady = await this.checkUSBPrinter();
    if (usbReady) {
      console.log('✅ USB printer detected');
      return 'usb';
    }
    
    // 3. Check Bluetooth printers
    const bluetoothReady = await this.checkBluetoothPrinter();
    if (bluetoothReady) {
      console.log('✅ Bluetooth printer detected');
      return 'bluetooth';
    }
    
    // 4. Check Network printer (from settings)
    const networkReady = await this.checkNetworkPrinter();
    if (networkReady) {
      console.log('✅ Network printer detected');
      return 'network';
    }
    
    console.log('⚠️ No printer detected, using PDF fallback');
    return 'pdf';
  }
  
  // ✅ Returns boolean (for internal checks)
  static async checkSunmiPrinter(): Promise<boolean> {
    try {
      if (!SunmiModule) return false;
      await SunmiModule.initPrinter();
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // ✅ Returns boolean
  static async checkUSBPrinter(): Promise<boolean> {
    try {
      const UsbModule = require('react-native-usb-printer');
      const devices = await UsbModule.getDeviceList?.();
      return devices && devices.length > 0;
    } catch (error) {
      return false;
    }
  }
  
  // ✅ Returns boolean
  static async checkBluetoothPrinter(): Promise<boolean> {
    try {
      const BtModule = require('react-native-bluetooth-printer');
      const devices = await BtModule.getPairedDevices?.();
      const hasPrinter = devices?.some((d: any) => 
        d.name?.toLowerCase().includes('printer') ||
        d.name?.toLowerCase().includes('pos')
      );
      return hasPrinter === true;
    } catch (error) {
      return false;
    }
  }
  
  // ✅ Returns boolean (FIXED - was returning string before)
  static async checkNetworkPrinter(): Promise<boolean> {
    try {
      const printerIp = await AsyncStorage.getItem('printer_ip');
      if (!printerIp) return false;
      
      // Simple connection test
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`http://${printerIp}:9100`, {
        method: 'HEAD',
        signal: controller.signal
      }).catch(() => null);
      
      clearTimeout(timeoutId);
      return response?.ok === true;
    } catch (error) {
      return false;
    }
  }
  
  // ✅ Returns boolean
  static async checkPrintService(): Promise<boolean> {
    return Platform.OS === 'android';
  }
}