// components/USBPrinterService.ts
import { Platform } from 'react-native';

export class USBPrinterService {
  
  static async print(saleData: any, company: any): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') return false;
      
      const UsbPrinter = require('react-native-usb-printer');
      const devices = await UsbPrinter.getDeviceList();
      
      if (devices && devices.length > 0) {
        const text = this.formatText(saleData, company);
        await UsbPrinter.printText(text);
        return true;
      }
      return false;
    } catch (error) {
      console.log('USB print error:', error);
      return false;
    }
  }
  
  private static formatText(saleData: any, company: any): string {
    const symbol = company.currencySymbol || '$';
    let text = '';
    
    text += '='.repeat(32) + '\n';
    text += `${company.name || 'POS SYSTEM'}\n`;
    text += '='.repeat(32) + '\n';
    text += `Bill: ${saleData.invoiceNumber || saleData.id}\n`;
    text += `Date: ${new Date().toLocaleString()}\n`;
    text += '-'.repeat(32) + '\n';
    
    for (const item of saleData.items || []) {
      text += `${item.name} x${item.quantity} = ${symbol}${(item.price * item.quantity).toFixed(2)}\n`;
    }
    
    text += '-'.repeat(32) + '\n';
    text += `TOTAL: ${symbol}${(saleData.total || 0).toFixed(2)}\n`;
    text += '='.repeat(32) + '\n';
    text += 'THANK YOU!\n\n';
    
    return text;
  }
}

export default USBPrinterService;