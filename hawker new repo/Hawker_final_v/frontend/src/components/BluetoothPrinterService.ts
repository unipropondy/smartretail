// components/BluetoothPrinterService.ts
import { Platform } from 'react-native';

export class BluetoothPrinterService {
  
  static async print(saleData: any, company: any): Promise<boolean> {
    try {
      const BtPrinter = require('react-native-bluetooth-printer');
      const devices = await BtPrinter.getPairedDevices();
      
      const printer = devices?.find((d: any) => 
        d.name?.toLowerCase().includes('printer') ||
        d.name?.toLowerCase().includes('pos')
      );
      
      if (printer) {
        await BtPrinter.connect(printer.address);
        const text = this.formatText(saleData, company);
        await BtPrinter.print(text);
        return true;
      }
      return false;
    } catch (error) {
      console.log('Bluetooth print error:', error);
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

export default BluetoothPrinterService;