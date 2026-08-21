// frontend/src/components/UniversalPrinter.ts - COMPLETE WITH DISCOUNT SUPPORT ✅

import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import SunmiPrinterService from './SunmiPrinterService';
import BillPDFGenerator from './BillPDFGenerator';
import NetworkPrinterService from './NetworkPrinterService';

import { PrinterDetector } from './PrinterDetector';
// Printer types
export type PrinterType = 
  | 'thermal'
  | 'receipt'
  | 'label'
  | 'laser'
  | 'bluetooth'
  | 'network'
  | 'usb'
  | 'unknown';

interface PrinterInfo {
  type: PrinterType;
  name: string;
  address?: string;
  isDefault: boolean;
  paperSize?: '58mm' | '80mm' | 'A4' | 'label';
}

interface DiscountInfo {
  applied: boolean;
  type: 'percentage' | 'fixed';
  value: number;
  amount: number;
}

class UniversalPrinter {
  
  private static detectedPrinters: PrinterInfo[] = [];
  private static defaultPrinter: PrinterInfo | null = null;

  static async detectAllPrinters(): Promise<PrinterInfo[]> {
    const printers: PrinterInfo[] = [];
    if (Platform.OS !== 'android') return printers;
    
    try {
      // Sunmi Thermal
     
      // Bluetooth
     

      // Network
    
      // USB
     
      // Android Print Service
      try {
        const hasPrintService = await this.checkAndroidPrintService();
        if (hasPrintService) {
          printers.push({ type: 'laser', name: 'Android Print Service', isDefault: false, paperSize: 'A4' });
        }
      } catch (e) {}

      this.detectedPrinters = printers;
      this.defaultPrinter = printers.find(p => p.type === 'thermal') || printers[0] || null;
      return printers;
    } catch (error) {
      return [];
    }
  }

  static async openCashDrawer(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        try {
          const SunmiPrinter = require('react-native-sunmi-inner-printer');
          if (SunmiPrinter?.hasPrinter?.()) {
            await SunmiPrinter.openCashDrawer();
            return true;
          }
        } catch (e) {}
        try {
          const ThermalPrinter = require('react-native-thermal-printer');
          await ThermalPrinter.printRaw([0x1B, 0x70, 0x00, 0x19, 0xFA]);
          return true;
        } catch (e) {}
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  private static guessPaperSize(printerName: string): '58mm' | '80mm' | 'A4' | 'label' {
    const name = printerName.toLowerCase();
    if (name.includes('58') || name.includes('2inch')) return '58mm';
    if (name.includes('80') || name.includes('3inch')) return '80mm';
    if (name.includes('label') || name.includes('zebra')) return 'label';
    if (name.includes('laser') || name.includes('inkjet')) return 'A4';
    return '80mm';
  }

  private static getPrintWidth(printer: PrinterInfo): number {
    switch (printer.paperSize) {
      case '58mm': return 164;
      case '80mm': return 226;
      case 'A4': return 612;
      case 'label': return 300;
      default: return 226;
    }
  }

  // ==================== SALES REPORT ====================
static async printSalesReport(reportData: any, userId?: string | number, t?: any): Promise<boolean> {
  try {
    const company = await BillPDFGenerator.loadSettings(userId);
    const html = this.generateSalesReportHTML(reportData, company);
    
    // ✅ Save as PDF (no preview)
    const { uri } = await Print.printToFileAsync({ html });
    console.log('📄 Sales report saved at:', uri);
    
    // ✅ Optionally share the PDF
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
    
    return true;
  } catch (error) {
    console.log('Sales report error:', error);
    return false;
  }
}
  private static generateSalesReportHTML(data: any, company: any): string {
    const symbol = company.currencySymbol || '$';
    return `<!DOCTYPE html><html><head><style>
      body { font-family: monospace; padding: 20px; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
      .company-name { font-size: 24px; font-weight: bold; }
      .report-title { font-size: 20px; font-weight: bold; margin: 15px 0; text-align: center; }
      .section-title { font-size: 16px; font-weight: bold; margin: 15px 0 10px; background: #f0f0f0; padding: 5px; }
      table { width: 100%; border-collapse: collapse; margin: 10px 0; }
      th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
      .amount { text-align: right; }
      .summary-box { display: inline-block; width: 30%; padding: 10px; margin: 5px; background: #f9f9f9; text-align: center; border-radius: 5px; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
    </style></head><body>
      <div class="header"><div class="company-name">${company.name || 'POS SYSTEM'}</div><div>${company.address || ''}</div><div>GST: ${company.gstNo || 'N/A'}</div><div class="report-title">SALES REPORT</div><div>Period: ${data.period || 'Today'}</div></div>
      <div style="text-align:center"><div class="summary-box"><div>Total Sales</div><div style="font-size:24px">${data.summary?.totalSales || 0}</div></div>
      <div class="summary-box"><div>Total Items</div><div style="font-size:24px">${data.summary?.totalItems || 0}</div></div>
      <div class="summary-box"><div>Total Revenue</div><div style="font-size:24px">${symbol}${(data.summary?.totalRevenue || 0).toFixed(2)}</div></div></div>
      <div class="section-title">💳 PAYMENT BREAKDOWN</div>${this.generateTableFromObject(data.paymentBreakdown || {}, symbol)}</div>
      <div class="footer"><p>© ${new Date().getFullYear()} UNIPRO SOFTWARES SG PTE LTD</p></div>
    </body></html>`;
  }

  // ==================== CATEGORY REPORT ====================
  static async printCategoryReport(
  categories: any[], selectedCategory: string | null, categoryItems: any[], categoryTransactions: any[],
  userId?: string | number, t?: any, options?: any
): Promise<boolean> {
  try {
    const company = await BillPDFGenerator.loadSettings(userId);
    const html = selectedCategory 
      ? this.generateCategoryDetailHTML(selectedCategory, categoryItems, categoryTransactions, company, options)
      : this.generateAllCategoriesHTML(categories, company, options);
    
    // ✅ Save as PDF (no preview)
    const { uri } = await Print.printToFileAsync({ html });
    console.log('📄 Category report saved at:', uri);
    
    // ✅ Optionally share the PDF
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
    
    return true;
  } catch (error) { 
    console.log('Category report error:', error);
    return false; 
  }
}

  private static generateCategoryDetailHTML(categoryName: string, items: any[], transactions: any[], company: any, options?: any): string {
    const symbol = company.currencySymbol || '$';
    const groupTransactions = (tx: any[]) => {
      const grouped: any = {};
      tx.forEach(t => { if (!grouped[t.saleId]) grouped[t.saleId] = { id: t.saleId, date: t.saleDate, items: [], total: 0 }; grouped[t.saleId].items.push({ name: t.name, quantity: t.quantity, price: t.price }); grouped[t.saleId].total += t.price * t.quantity; });
      return Object.values(grouped).sort((a: any,b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    };
    return `<!DOCTYPE html><html><head><style>
      body { font-family: Arial; padding: 20px; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; }
      .category-title { font-size: 22px; font-weight: bold; text-align: center; margin: 20px 0; }
      .section-title { font-size: 18px; font-weight: bold; margin: 20px 0 10px; background: #f0f0f0; padding: 8px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { padding: 8px; border-bottom: 1px solid #eee; }
      .amount { text-align: right; }
      .transaction-card { border: 1px solid #ddd; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
    </style></head><body>
      <div class="header"><div class="company-name">${company.name || 'Store'}</div><div>${company.address || ''}</div><div>GST: ${company.gstNo || 'N/A'}</div></div>
      <div class="category-title">📦 ${categoryName}</div>
      <div style="display:flex;justify-content:space-around;margin:20px 0;padding:15px;background:#f9f9f9;border-radius:5px">
        <div><div>Total Items</div><div style="font-size:18px;font-weight:bold">${items.length}</div></div>
        <div><div>Quantity Sold</div><div style="font-size:18px;font-weight:bold">${items.reduce((s,i)=>s+(i.quantity||0),0)}</div></div>
        <div><div>Total Revenue</div><div style="font-size:18px;font-weight:bold">${symbol}${items.reduce((s,i)=>s+(i.revenue||0),0).toFixed(2)}</div></div>
      </div>
      <div class="section-title">📋 Items Sold</div>${this.generateItemsTable(items, symbol)}
      <div class="section-title">📄 Transaction History</div>${transactions.length ? groupTransactions(transactions).map((sale:any) => `<div class="transaction-card"><div><strong>#${sale.id}</strong> - ${symbol}${sale.total.toFixed(2)}</div><div>${new Date(sale.date).toLocaleString()}</div>${sale.items.map((item:any) => `<div>• ${item.name} x${item.quantity} - ${symbol}${(item.price*item.quantity).toFixed(2)}</div>`).join('')}</div>`).join('') : '<p>No transactions</p>'}
      <div class="footer"><p>End of Report</p></div>
    </body></html>`;
  }

  private static generateAllCategoriesHTML(categories: any[], company: any, options?: any): string {
    const symbol = company.currencySymbol || '$';
    const summary = options?.summary || { totalSales: 0, totalItems: 0, totalRevenue: 0, paymentBreakdown: {} };
    return `<!DOCTYPE html><html><head><style>
      body { font-family: Arial; padding: 20px; max-width: 800px; margin: 0 auto; }
      .header { text-align: center; border-bottom: 2px solid #000; margin-bottom: 20px; }
      .summary-section { display: flex; justify-content: space-between; margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
      .category-card { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 5px; padding: 15px; }
      .category-name { font-size: 18px; font-weight: bold; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { padding: 8px; border-bottom: 1px solid #eee; }
      .amount { text-align: right; }
      .footer { margin-top: 30px; text-align: center; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
    </style></head><body>
      <div class="header"><div class="company-name">${company.name || 'Store'}</div><div>${company.address || ''}</div><div>GST: ${company.gstNo || 'N/A'}</div><div class="report-title">📊 CATEGORY WISE SALES</div></div>
      <div class="summary-section"><div><div>Total Sales</div><div>${summary.totalSales}</div></div><div><div>Total Items</div><div>${summary.totalItems}</div></div><div><div>Total Revenue</div><div>${symbol}${summary.totalRevenue.toFixed(2)}</div></div></div>
      <div><h3>💳 PAYMENT BREAKDOWN</h3>${Object.entries(summary.paymentBreakdown).map(([m,a]) => `<div>${m}: ${symbol}${(a as number).toFixed(2)}</div>`).join('')}</div>
      ${categories.map(cat => `<div class="category-card"><div class="category-name">${cat.name}</div><div>Revenue: ${symbol}${(cat.totalRevenue||0).toFixed(2)} | Items: ${cat.totalQuantity||0}</div>${this.generateItemsTable(cat.items || [], symbol)}</div>`).join('')}
      <div class="footer"><p>© ${new Date().getFullYear()} UNIPRO SOFTWARES SG PTE LTD</p></div>
    </body></html>`;
  }

  private static generateItemsTable(items: any[], symbol: string): string {
    if (!items.length) return '<p>No items</p>';
    return `<table><thead><tr><th>Item</th><th class="amount">Qty</th><th class="amount">Price</th><th class="amount">Total</th></tr></thead><tbody>${items.map(i => `<tr><td>${i.name}</td><td class="amount">${i.quantity||0}</td><td class="amount">${symbol}${(i.price||0).toFixed(2)}</td><td class="amount">${symbol}${(i.revenue||0).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
  }

  private static generateTableFromObject(obj: Record<string, any>, symbol: string): string {
    const entries = Object.entries(obj);
    if (!entries.length) return '<p>No data</p>';
    return `<table><tbody>${entries.map(([k,v]) => `<tr><td>${k}</td><td class="amount">${symbol}${(v as number).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
  }

  // ==================== MAIN SMART PRINT WITH DISCOUNT ====================
static async smartPrint(
  saleData: any, 
  outletId?: string | number,
  t?: any, 
  discountInfo?: DiscountInfo, 
  preferredType?: PrinterType,
  isReprint: boolean = false
): Promise<boolean> {
  try {
    const company = await BillPDFGenerator.loadSettings(outletId);
    let printedOnNetwork = false;
    if (company.printerEnabled) {
      console.log('🔌 Network printer enabled, printing receipt...');
      const text = this.formatThermalTextWithDiscount(saleData, company, discountInfo, 48);
      printedOnNetwork = await NetworkPrinterService.printRawText(
        company.printerIP || '192.168.0.241',
        company.printerPort || 9100,
        text
      );
    }

    // ✅ Auto-detect printer type and print on Sunmi as well
    let printedOnSunmi = false;
    const printerType = await PrinterDetector.detectPrinter();
    if (printerType === 'sunmi') {
      printedOnSunmi = await this.printThermalReceipt(saleData, outletId, undefined, discountInfo);
    }
    
    if (printedOnNetwork || printedOnSunmi) {
      return true;
    }
    
    // ✅ Fallback to PDF
    return await this.offerPDFFallback(saleData, outletId, t, discountInfo);
    
  } catch (error) { 
    console.log('SmartPrint error:', error);
    return await this.offerPDFFallback(saleData, outletId, t, discountInfo); 
  }
}
  // ==================== THERMAL PRINTING WITH DISCOUNT ====================
private static async printThermalReceipt(
  saleData: any, 
  userId?: string | number, 
  printer?: PrinterInfo, 
  discountInfo?: DiscountInfo
): Promise<boolean> {
  try {
    const company = await BillPDFGenerator.loadSettings(userId);
    let printedOnNetwork = false;

    if (company.printerEnabled) {
      console.log('🔌 Network printer enabled, printing thermal receipt...');
      const text = this.formatThermalTextWithDiscount(saleData, company, discountInfo, 48);
      printedOnNetwork = await NetworkPrinterService.printRawText(
        company.printerIP || '192.168.0.241',
        company.printerPort || 9100,
        text
      );
    }

    // ✅ Try Sunmi direct print (NO preview)
    let printedOnSunmi = false;
    const sunmiReady = await SunmiPrinterService.init();
    if (sunmiReady) {
      // ✅ Pass discount to saleData for Sunmi printer
      const enhancedSaleData = { ...saleData };
      if (discountInfo?.applied && discountInfo.amount > 0) {
        enhancedSaleData.discountAmount = discountInfo.amount;
        enhancedSaleData.discountType = discountInfo.type;
        enhancedSaleData.discountValue = discountInfo.value;
        enhancedSaleData.originalTotal = saleData.total + discountInfo.amount;
      }
      
      const printed = await SunmiPrinterService.printReceipt(enhancedSaleData, company);
      if (printed) {
        console.log('✅ Printed with Sunmi printer - NO PREVIEW');
        printedOnSunmi = true;
      }
    }
    
    if (printedOnNetwork || printedOnSunmi) {
      return true;
    }
    
    // ✅ STEP 2: If Sunmi fails, create PDF (no preview)
    const html = await BillPDFGenerator.generateHTML(saleData, userId, discountInfo);
    const { uri } = await Print.printToFileAsync({ 
      html, 
      width: this.getPrintWidth(printer || { paperSize: '58mm' } as PrinterInfo) 
    });
    
    console.log('📄 PDF saved at:', uri);
    return true;
    
  } catch (error) { 
    console.log('Thermal print error:', error);
    return false; 
  }
}

  private static formatThermalTextWithDiscount(saleData: any, company: any, discountInfo?: DiscountInfo, width: number = 32): string {
    const symbol = company.currencySymbol || '$';
    
    // Helper alignment functions
    const center = (text: string) => {
      if (!text) return ' '.repeat(width);
      if (text.length >= width) return text.substring(0, width);
      const padding = Math.floor((width - text.length) / 2);
      return ' '.repeat(padding) + text;
    };
    
    const twoCols = (left: string, right: string) => {
      const leftWidth = Math.floor(width * 0.6);
      const rightWidth = width - leftWidth;
      let leftStr = left.substring(0, leftWidth).padEnd(leftWidth, ' ');
      let rightStr = right.substring(0, rightWidth).padStart(rightWidth, ' ');
      return leftStr + rightStr;
    };
    
    const itemRow = (name: string, qty: string, price: string, total: string) => {
      const nameW = Math.floor(width * 0.40); 
      const qtyW = Math.floor(width * 0.10);  
      const priceW = Math.floor(width * 0.22); 
      const totalW = width - (nameW + qtyW + priceW + 1); 
      
      let line = name.substring(0, nameW).padEnd(nameW, ' ');
      line += qty.substring(0, qtyW).padStart(qtyW, ' ');
      line += ' '; 
      line += price.substring(0, priceW).padStart(priceW, ' ');
      line += total.substring(0, totalW).padStart(totalW, ' ');
      return line;
    };

    let text = '\n' + '='.repeat(width) + '\n';
    text += center(company.name || 'YOUR STORE') + '\n';
    
    if (company.address) {
      const addressLines = company.address.split('\n');
      for (const line of addressLines) {
        if (line.trim()) text += center(line.trim()) + '\n';
      }
    }
    
    if (company.phone) text += center(`📞 ${company.phone}`) + '\n';
    if (company.email) text += center(`📧 ${company.email}`) + '\n';
    if (company.gstNo) text += center(`GST: ${company.gstNo}`) + '\n';
    
    text += '='.repeat(width) + '\n';
    
    // Bill Details
    const rawDateVal = saleData.originalDate || saleData.date || saleData.SaleDate || saleData.saleDate;
    let dateStr = '';
    if (rawDateVal) {
      try {
        const dateString = typeof rawDateVal === 'string' ? rawDateVal : new Date(rawDateVal).toISOString();
        const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
        if (match) {
          const [_, year, month, day, hours, minutes] = match;
          dateStr = `${day}/${month}/${year} ${hours}:${minutes}`;
        }
      } catch (e) {}
    }
    if (!dateStr) {
      const d = rawDateVal ? new Date(rawDateVal) : new Date();
      // Ensure we display Singapore time (UTC+8) timezone-neutrally
      const utcTime = d.getTime() + (d.getTimezoneOffset() * 60 * 1000);
      const sgTime = new Date(utcTime + (8 * 60 * 60 * 1000));
      const day = String(sgTime.getDate()).padStart(2, '0');
      const month = String(sgTime.getMonth() + 1).padStart(2, '0');
      const year = sgTime.getFullYear();
      const hours = String(sgTime.getHours()).padStart(2, '0');
      const minutes = String(sgTime.getMinutes()).padStart(2, '0');
      dateStr = `${day}/${month}/${year} ${hours}:${minutes}`;
    }
    
    text += `INVOICE NO: ${saleData.invoiceNumber || saleData.id}\n`;
    text += `DATE: ${dateStr}\n`;
    text += `CASHIER: ${saleData.cashier || company.cashierName || 'Staff'}\n`;
    if (saleData.staffName) {
      text += `STAFF: ${saleData.staffName}\n`;
    }
    
    text += '-'.repeat(width) + '\n';
    
    // Item Header
    text += itemRow('ITEM', 'QTY', 'PRICE', 'TOTAL') + '\n';
    text += '-'.repeat(width) + '\n';
    
    // Items
    for (const item of saleData.items || []) {
      const itemName = item.name || '';
      const qty = (item.quantity || 1).toString();
      const price = `${symbol}${item.price.toFixed(2)}`;
      const total = `${symbol}${(item.price * item.quantity).toFixed(2)}`;
      
      text += itemRow(itemName, qty, price, total) + '\n';
      
      if (item.quantity > 10) {
        text += `    @ ${symbol}${item.price.toFixed(2)} ea\n`;
      }
    }
    
    text += '-'.repeat(width) + '\n';
    
    // Subtotal / Discount
    let subtotal = saleData.total;
    const discountAmt = discountInfo?.amount || saleData.discountAmount || 0;
    const discountVal = discountInfo?.value || saleData.discountValue || 0;
    const discountType = discountInfo?.type || saleData.discountType || 'percentage';
    
    if (discountAmt > 0) {
      const originalTotal = saleData.total + discountAmt;
      text += twoCols('Sub Total:', `${symbol}${originalTotal.toFixed(2)}`) + '\n';
      text += twoCols('Discount:', `-${symbol}${discountAmt.toFixed(2)}`) + '\n';
      if (discountType === 'percentage') {
        text += `    (${discountVal}% off)\n`;
      }
      text += '-'.repeat(width) + '\n';
      subtotal = saleData.total;
    } else {
      text += twoCols('Sub Total:', `${symbol}${subtotal.toFixed(2)}`) + '\n';
      text += '-'.repeat(width) + '\n';
    }
    
    // GST
    if (company.gstPercentage > 0) {
      const gstAmount = subtotal * (company.gstPercentage / (100 + company.gstPercentage));
      const beforeGst = subtotal - gstAmount;
      text += twoCols('Sub Total (before GST):', `${symbol}${beforeGst.toFixed(2)}`) + '\n';
      text += twoCols(`GST (${company.gstPercentage}%):`, `${symbol}${gstAmount.toFixed(2)}`) + '\n';
      text += '-'.repeat(width) + '\n';
    }
    
    // Grand Total
    text += twoCols('GRAND TOTAL:', `${symbol}${subtotal.toFixed(2)}`) + '\n';
    text += '='.repeat(width) + '\n';
    
    // Payment
    text += twoCols('PAYMENT:', saleData.paymentMethod || 'Cash') + '\n';
    
    const cashPaidVal = saleData.cashPaid || 0;
    const changeVal = saleData.change || 0;
    if (cashPaidVal > 0) {
      text += twoCols('PAID:', `${symbol}${cashPaidVal.toFixed(2)}`) + '\n';
      if (changeVal > 0) {
        text += twoCols('CHANGE:', `${symbol}${changeVal.toFixed(2)}`) + '\n';
      }
    }
    
    text += '\n';
    text += center('THANK YOU! COME AGAIN!') + '\n';
    text += center('SMARTRETAIL BY UNIPROSG') + '\n';
    if (company.gstPercentage > 0) {
      text += center(`* Prices include ${company.gstPercentage}% GST`) + '\n';
    }
    text += '\n\n';
    return text;
  }

  // ==================== LASER PRINTING ====================
private static async printLaser(saleData: any, userId?: string | number, printer?: PrinterInfo, discountInfo?: DiscountInfo): Promise<boolean> {
  try { 
    const html = await BillPDFGenerator.generateHTML(saleData, userId, discountInfo); 
    // ✅ Save as PDF instead of print (no preview)
    const { uri } = await Print.printToFileAsync({ html });
    console.log('📄 PDF saved at:', uri);
    return true; 
  } catch (error) { 
    return false; 
  }
}
  // ==================== BLUETOOTH PRINTING ====================
  private static async printBluetooth(saleData: any, userId?: string | number, printer?: PrinterInfo, discountInfo?: DiscountInfo): Promise<boolean> {
    try {
      const BluetoothPrinter = require('react-native-bluetooth-printer');
      if (printer?.address) await BluetoothPrinter.connect(printer.address);
      const company = await BillPDFGenerator.loadSettings(userId);
      await BluetoothPrinter.print(this.formatThermalTextWithDiscount(saleData, company, discountInfo));
      return true;
    } catch (error) { return false; }
  }

  // ==================== NETWORK PRINTING ====================
  private static async printNetwork(saleData: any, userId?: string | number, printer?: PrinterInfo, discountInfo?: DiscountInfo): Promise<boolean> {
    try {
      const NetPrinter = require('react-native-thermal-printer');
      const company = await BillPDFGenerator.loadSettings(userId);
      await NetPrinter.printIP(printer?.address || '', { text: this.formatThermalTextWithDiscount(saleData, company, discountInfo) });
      return true;
    } catch (error) { return false; }
  }

  // ==================== USB PRINTING ====================
  private static async printUSB(saleData: any, userId?: string | number, printer?: PrinterInfo, discountInfo?: DiscountInfo): Promise<boolean> {
    try {
      const UsbPrinter = require('react-native-usb-printer');
      if (printer?.address) await UsbPrinter.connect(printer.address);
      const company = await BillPDFGenerator.loadSettings(userId);
      await UsbPrinter.print(this.formatThermalTextWithDiscount(saleData, company, discountInfo));
      return true;
    } catch (error) { return false; }
  }

  // ==================== LABEL PRINTING ====================
  private static async printLabel(saleData: any, printer: PrinterInfo): Promise<boolean> {
    try {
      let labelText = '';
      saleData.items.forEach((item: any) => { labelText += `${item.name}\nQty: ${item.quantity}\nPrice: $${(item.price * item.quantity).toFixed(2)}\n---\n`; });
      const LabelPrinter = require('react-native-label-printer');
      await LabelPrinter.print(labelText);
      return true;
    } catch (error) { return false; }
  }

  // ==================== PDF FALLBACK WITH DISCOUNT ====================
  static async offerPDFFallback(saleData: any, userId?: string | number, t?: any, discountInfo?: DiscountInfo): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(t?.printerNotFound || '🖨️ No Printer Available', t?.wantPDF || 'Save as PDF?', [
        { text: t?.no || 'No', onPress: () => resolve(false), style: 'cancel' },
        { text: t?.yes || 'Yes', onPress: async () => {
            try {
              const html = await BillPDFGenerator.generateHTML(saleData, userId, discountInfo);
              const { uri } = await Print.printToFileAsync({ html, width: 226 });
              if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
              resolve(true);
            } catch { resolve(false); }
          }
        }
      ]);
    });
  }

  // ==================== UTILITIES ====================
  private static async checkAndroidPrintService(): Promise<boolean> { return Platform.OS === 'android'; }

  private static cleanThermalText(text: string): string {
    if (!text) return '';
    return text
      .replace(/[\u202f\u00a0]/g, ' ')
      .replace(/[📞📧📦👤💳💎💰🏷️📱💵💵📊⚡🖨️✅⚠️📄🏷️]/gu, '')
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '');
  }

  static async testAllPrinters(): Promise<void> {
    const printers = await this.detectAllPrinters();
    let message = `📋 Found ${printers.length} printer(s):\n\n`;
    printers.forEach((p, i) => { message += `${i+1}. ${p.name}\n   Type: ${p.type}\n   Paper: ${p.paperSize || 'Unknown'}\n   Default: ${p.isDefault ? '✅' : '❌'}\n\n`; });
    Alert.alert('Printer Detection', message);
  }
    // ==================== SALES REPORT THERMAL PRINT ====================
  // ==================== SALES REPORT THERMAL PRINT ====================
static async printSalesReportThermal(reportData: any, userId?: string | number, t?: any): Promise<boolean> {
    try {
        const company = await BillPDFGenerator.loadSettings(userId);
        const symbol = company.currencySymbol || '$';
        
        const buildText = (width: number) => {
            const getReportDateStr = (rawDate: any): string => {
              const d = rawDate ? new Date(rawDate) : new Date();
              const utcTime = d.getTime() + (d.getTimezoneOffset() * 60 * 1000);
              const sgTime = new Date(utcTime + (8 * 60 * 60 * 1000));
              const day = String(sgTime.getDate()).padStart(2, '0');
              const month = String(sgTime.getMonth() + 1).padStart(2, '0');
              const year = sgTime.getFullYear();
              const hours = String(sgTime.getHours()).padStart(2, '0');
              const minutes = String(sgTime.getMinutes()).padStart(2, '0');
              return `${day}/${month}/${year} ${hours}:${minutes}`;
            };

            let text = '\n';
            text += '='.repeat(width) + '\n';
            text += this.centerText(company.name || 'SALES REPORT', width) + '\n';
            text += '='.repeat(width) + '\n';
            text += `Period: ${reportData.period || 'Today'}\n`;
            text += `Date: ${getReportDateStr(new Date())}\n`;
            text += '-'.repeat(width) + '\n\n';
            
            // ========== SUMMARY ==========
            text += this.centerText('SUMMARY', width) + '\n';
            text += '-'.repeat(width) + '\n';
            text += this.twoColumns('Total Sales:', `${reportData.summary?.totalSales || 0}`, width) + '\n';
            text += this.twoColumns('Total Items:', `${reportData.summary?.totalItems || 0}`, width) + '\n';
            text += this.twoColumns('Total Revenue:', `${symbol}${(reportData.summary?.totalRevenue || 0).toFixed(2)}`, width) + '\n';
            
            // ✅ DISCOUNT SECTION
            if (reportData.summary?.totalDiscount > 0) {
                text += this.twoColumns('Total Discount:', `-${symbol}${reportData.summary.totalDiscount.toFixed(2)}`, width) + '\n';
                const discountPercent = reportData.summary?.totalSales > 0 
                    ? ((reportData.summary.discountedSales / reportData.summary.totalSales) * 100).toFixed(1)
                    : '0';
                text += this.twoColumns('Discounted Sales:', `${reportData.summary?.discountedSales || 0} / ${reportData.summary?.totalSales || 0} (${discountPercent}%)`, width) + '\n';
            }
            
            // ✅ VALUE CARD SECTION
            if (reportData.summary?.totalValueCardAmount > 0) {
                text += '\n' + '-'.repeat(width) + '\n';
                text += this.centerText('VALUE CARD USAGE', width) + '\n';
                text += '-'.repeat(width) + '\n';
                text += this.twoColumns('Total Value Card:', `${symbol}${(reportData.summary?.totalValueCardAmount || 0).toFixed(2)}`, width) + '\n';
                text += this.twoColumns('Card Transactions:', `${reportData.summary?.valueCardTransactions || 0}`, width) + '\n';
            }
            
            text += '\n' + '-'.repeat(width) + '\n';
            
            // ========== PAYMENT BREAKDOWN ==========
            text += this.centerText('PAYMENT BREAKDOWN', width) + '\n';
            text += '-'.repeat(width) + '\n';
            
            if (reportData.paymentBreakdown) {
                const sortedMethods = Object.entries(reportData.paymentBreakdown).sort((a, b) => (b[1] as number) - (a[1] as number));
                
                for (const [method, amount] of sortedMethods) {
                    let methodIcon = '';
                    const methodLower = method.toLowerCase();
                    
                    if (methodLower.includes('cash')) methodIcon = '💰';
                    else if (methodLower.includes('upi')) methodIcon = '📱';
                    else if (methodLower.includes('paynow')) methodIcon = '📱';
                    else if (methodLower.includes('card')) methodIcon = '💳';
                    else if (methodLower.includes('value')) methodIcon = '💎';
                    else if (methodLower.includes('discount')) methodIcon = '🏷️';
                    else methodIcon = '💵';
                    
                    const methodName = method;
                    text += this.twoColumns(methodName, `${symbol}${(amount as number).toFixed(2)}`, width) + '\n';
                }
            }
            
            // ========== STAFF BREAKDOWN ==========
            const staffMap: Record<string, any> = {};
            if (reportData.salesHistory && Array.isArray(reportData.salesHistory)) {
                reportData.salesHistory.forEach((sale: any) => {
                    if (sale.status === 'VOIDED') return;
                    const name = sale.staffName || 'Unassigned / Cashier';
                    if (!staffMap[name]) {
                        staffMap[name] = {
                            revenue: 0,
                            count: 0,
                            payments: {},
                            categories: {},
                            items: {}
                        };
                    }
                    const entry = staffMap[name];
                    entry.revenue += Number(sale.total) || 0;
                    entry.count += 1;
    
                    const method = sale.paymentMethod || 'Unknown';
                    entry.payments[method] = (entry.payments[method] || 0) + (Number(sale.total) || 0);
    
                    if (sale.items && Array.isArray(sale.items)) {
                        sale.items.forEach((item: any) => {
                            const itemName = item.name || 'Unknown Item';
                            const itemCat = item.category || item.displayCategory || 'Uncategorized';
                            const qty = Number(item.quantity) || 0;
                            const itemVal = (Number(item.price) || 0) * qty;
    
                            entry.categories[itemCat] = (entry.categories[itemCat] || 0) + itemVal;
                            if (!entry.items[itemName]) {
                                entry.items[itemName] = 0;
                            }
                            entry.items[itemName] += qty;
                        });
                    }
                });
            }
    
            const staffList = Object.entries(staffMap);
            if (staffList.length > 0) {
                text += '\n' + '='.repeat(width) + '\n';
                text += this.centerText('STAFF BREAKDOWN', width) + '\n';
                text += '='.repeat(width) + '\n';
    
                for (const [staffName, data] of staffList) {
                text += `Staff Name: ${staffName}\n`;
                    text += this.twoColumns('  Revenue:', `${symbol}${data.revenue.toFixed(2)}`, width) + '\n';
                    text += this.twoColumns('  Sales Count:', `${data.count}`, width) + '\n';
    
                    // Payments
                    text += '  - Payments:\n';
                    for (const [method, amount] of Object.entries(data.payments)) {
                        text += this.twoColumns(`    ${method}:`, `${symbol}${(amount as number).toFixed(2)}`, width) + '\n';
                    }
    
                    // Categories
                    text += '  - Categories:\n';
                    for (const [catName, amount] of Object.entries(data.categories)) {
                        text += this.twoColumns(`    ${catName}:`, `${symbol}${(amount as number).toFixed(2)}`, width) + '\n';
                    }
    
                    // Items
                    text += '  - Items:\n';
                    for (const [itemName, qty] of Object.entries(data.items)) {
                        text += this.twoColumns(`    ${itemName}:`, `${qty}x`, width) + '\n';
                    }
                    text += '-'.repeat(width) + '\n';
                }
            }
            
            text += '\n' + '='.repeat(width) + '\n';
            text += this.centerText('END OF REPORT', width) + '\n';
            text += '='.repeat(width) + '\n\n';
            text += this.centerText('SMARTRETAIL BY UNIPROSG', width) + '\n';
            text += '\n\n';
            return text;
        };
        
        let printedOnNetwork = false;
        if (company.printerEnabled) {
            console.log('🔌 Network printer enabled, printing sales report...');
            const networkText = this.cleanThermalText(buildText(48));
            printedOnNetwork = await NetworkPrinterService.printRawText(
                company.printerIP || '192.168.0.241',
                company.printerPort || 9100,
                networkText
            );
        }

        let printedOnSunmi = false;
        const sunmiReady = await SunmiPrinterService.init();
        if (sunmiReady) {
            const sunmiText = this.cleanThermalText(buildText(32));
            await SunmiPrinterService.printRawText(sunmiText);
            await SunmiPrinterService.cutPaper();
            printedOnSunmi = true;
        }
        
        return printedOnNetwork || printedOnSunmi;
        
    } catch (error) {
        console.log('Thermal sales report error:', error);
        return false;
    }
}
  // ==================== CATEGORY REPORT THERMAL PRINT ====================
  // ==================== CATEGORY REPORT THERMAL PRINT ====================
static async printCategoryReportThermal(
    categories: any[], 
    selectedCategory: string | null, 
    categoryItems: any[], 
    categoryTransactions: any[],
    userId?: string | number, 
    t?: any, 
    options?: any
): Promise<boolean> {
    try {
        const company = await BillPDFGenerator.loadSettings(userId);
        const symbol = company.currencySymbol || '$';
        const summary = options?.summary || {};
        
        const buildText = (width: number) => {
            const getReportDateStr = (rawDate: any): string => {
              const d = rawDate ? new Date(rawDate) : new Date();
              const utcTime = d.getTime() + (d.getTimezoneOffset() * 60 * 1000);
              const sgTime = new Date(utcTime + (8 * 60 * 60 * 1000));
              const day = String(sgTime.getDate()).padStart(2, '0');
              const month = String(sgTime.getMonth() + 1).padStart(2, '0');
              const year = sgTime.getFullYear();
              const hours = String(sgTime.getHours()).padStart(2, '0');
              const minutes = String(sgTime.getMinutes()).padStart(2, '0');
              return `${day}/${month}/${year} ${hours}:${minutes}`;
            };

            let text = '\n';
            text += '='.repeat(width) + '\n';
            text += this.centerText(company.name || 'CATEGORY REPORT', width) + '\n';
            text += '='.repeat(width) + '\n';
            text += `Filter: ${options?.filter || 'Today'}\n`;
            text += `Date: ${getReportDateStr(new Date())}\n`;
            text += '-'.repeat(width) + '\n\n';
            
            if (selectedCategory) {
                // Single category view
                text += this.centerText(selectedCategory, width) + '\n';
                text += '-'.repeat(width) + '\n';
                text += this.twoColumns('Total Revenue:', `${symbol}${(summary.totalRevenue || 0).toFixed(2)}`, width) + '\n';
                text += this.twoColumns('Total Items:', `${summary.totalItems || 0}`, width) + '\n';
                text += this.twoColumns('Transactions:', `${summary.totalSales || 0}`, width) + '\n';
                
                // ✅ Discount in category
                if (summary.totalDiscount > 0) {
                    text += this.twoColumns('Total Discount:', `-${symbol}${summary.totalDiscount.toFixed(2)}`, width) + '\n';
                    text += this.twoColumns('Discounted Trans:', `${summary.discountedTransactions || 0} / ${summary.totalSales || 0}`, width) + '\n';
                }
                
                // ✅ Value Card in category
                if (summary.totalValueCardAmount > 0) {
                    text += this.twoColumns('Value Card Used:', `${symbol}${summary.totalValueCardAmount.toFixed(2)}`, width) + '\n';
                }
                
                // Payment breakdown for this category
                if (summary.paymentBreakdown && Object.keys(summary.paymentBreakdown).length > 0) {
                    text += '\n' + '-'.repeat(width) + '\n';
                    text += this.centerText('PAYMENT BREAKDOWN', width) + '\n';
                    text += '-'.repeat(width) + '\n';
                    
                    const sortedMethods = Object.entries(summary.paymentBreakdown).sort((a, b) => (b[1] as number) - (a[1] as number));
                    for (const [method, amount] of sortedMethods) {
                        text += this.twoColumns(method, `${symbol}${(amount as number).toFixed(2)}`, width) + '\n';
                    }
                }
                
                // Items list
                if (categoryItems && categoryItems.length > 0) {
                    text += '\n' + '-'.repeat(width) + '\n';
                    text += this.centerText('TOP ITEMS', width) + '\n';
                    text += '-'.repeat(width) + '\n';
                    
                    const topItems = [...categoryItems].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
                    for (const item of topItems) {
                        text += `\n${item.name}\n`;
                        text += `  Qty: ${item.quantity}  Revenue: ${symbol}${item.revenue.toFixed(2)}\n`;
                        if (item.discountAmount > 0) {
                            text += `  Discount: -${symbol}${item.discountAmount.toFixed(2)}\n`;
                        }
                    }
                }
            } else {
                // All categories view
                text += this.centerText('CATEGORIES SUMMARY', width) + '\n';
                text += '-'.repeat(width) + '\n';
                text += this.twoColumns('Categories:', `${categories.length}`, width) + '\n';
                text += this.twoColumns('Total Revenue:', `${symbol}${(summary.totalRevenue || 0).toFixed(2)}`, width) + '\n';
                text += this.twoColumns('Total Items:', `${summary.totalItems || 0}`, width) + '\n';
                text += this.twoColumns('Transactions:', `${summary.totalSales || 0}`, width) + '\n';
                
                // ✅ Discount summary
                if (summary.totalDiscount > 0) {
                    text += this.twoColumns('Total Discount:', `-${symbol}${summary.totalDiscount.toFixed(2)}`, width) + '\n';
                }
                
                // ✅ Value Card summary
                if (summary.totalValueCardAmount > 0) {
                    text += this.twoColumns('Value Card Total:', `${symbol}${summary.totalValueCardAmount.toFixed(2)}`, width) + '\n';
                    text += this.twoColumns('Value Card Trans:', `${summary.valueCardTransactionCount || 0}`, width) + '\n';
                }
                
                // Payment breakdown
                if (summary.paymentBreakdown && Object.keys(summary.paymentBreakdown).length > 0) {
                    text += '\n' + '-'.repeat(width) + '\n';
                    text += this.centerText('PAYMENT BREAKDOWN', width) + '\n';
                    text += '-'.repeat(width) + '\n';
                    
                    const sortedMethods = Object.entries(summary.paymentBreakdown).sort((a, b) => (b[1] as number) - (a[1] as number));
                    for (const [method, amount] of sortedMethods) {
                        text += this.twoColumns(method, `${symbol}${(amount as number).toFixed(2)}`, width) + '\n';
                    }
                }
                
                // Category breakdown
                text += '\n' + '-'.repeat(width) + '\n';
                text += this.centerText('CATEGORY BREAKDOWN', width) + '\n';
                text += '-'.repeat(width) + '\n';
                
                for (const cat of categories) {
                    text += `\n${cat.name}\n`;
                    text += `  Revenue: ${symbol}${(cat.totalRevenue || 0).toFixed(2)}\n`;
                    text += `  Items: ${cat.totalQuantity || 0}\n`;
                    if (cat.discountAmount > 0) {
                        text += `  Discount: -${symbol}${cat.discountAmount.toFixed(2)}\n`;
                    }
                    if (cat.valueCardAmount > 0) {
                        text += `  Value Card: ${symbol}${cat.valueCardAmount.toFixed(2)}\n`;
                    }
                }
            }
            
            text += '\n' + '='.repeat(width) + '\n';
            text += this.centerText('END OF REPORT', width) + '\n';
            text += '='.repeat(width) + '\n\n';
            text += this.centerText('SMARTRETAIL BY UNIPROSG', width) + '\n';
            return text;
        };
        
        let printedOnNetwork = false;
        if (company.printerEnabled) {
            console.log('🔌 Network printer enabled, printing category report...');
            const networkText = buildText(48);
            printedOnNetwork = await NetworkPrinterService.printRawText(
                company.printerIP || '192.168.0.241',
                company.printerPort || 9100,
                networkText
            );
        }

        let printedOnSunmi = false;
        const sunmiReady = await SunmiPrinterService.init();
        if (sunmiReady) {
            const sunmiText = buildText(32);
            await SunmiPrinterService.printRawText(sunmiText);
            await SunmiPrinterService.cutPaper();
            printedOnSunmi = true;
        }
        
        return printedOnNetwork || printedOnSunmi;
        
    } catch (error) {
        console.log('Thermal category report error:', error);
        return false;
    }
}
  // ==================== SETTLEMENT REPORT THERMAL PRINT ====================
  static async printSettlementReportThermal(
      summary: any,
      cashFlow: any,
      paymodeBreakdown: any,
      staffBreakdown: any[],
      cashierName: string,
      outletName: string,
      dateStr: string,
      userId?: string | number
  ): Promise<boolean> {
      try {
          const company = await BillPDFGenerator.loadSettings(userId);
          const symbol = company.currencySymbol || '$';
          let printedOnNetwork = false;

          const buildText = (width: number) => {
              const getReportDateStr = (rawDate: any): string => {
                const d = rawDate ? new Date(rawDate) : new Date();
                const utcTime = d.getTime() + (d.getTimezoneOffset() * 60 * 1000);
                const sgTime = new Date(utcTime + (8 * 60 * 60 * 1000));
                const day = String(sgTime.getDate()).padStart(2, '0');
                const month = String(sgTime.getMonth() + 1).padStart(2, '0');
                const year = sgTime.getFullYear();
                const hours = String(sgTime.getHours()).padStart(2, '0');
                const minutes = String(sgTime.getMinutes()).padStart(2, '0');
                return `${day}/${month}/${year} ${hours}:${minutes}`;
              };

              let text = '\n';
              text += '='.repeat(width) + '\n';
              text += this.centerText(company.name || outletName || 'SETTLEMENT REPORT', width) + '\n';
              text += '='.repeat(width) + '\n';
              text += `Date: ${dateStr}\n`;
              text += `Cashier: ${cashierName}\n`;
              text += `Printed: ${getReportDateStr(new Date())}\n`;
              text += '-'.repeat(width) + '\n\n';
    
              // ========== SALES SUMMARY ==========
              text += this.centerText('SALES SUMMARY', width) + '\n';
              text += '-'.repeat(width) + '\n';
              text += this.twoColumns('Total Sales:', `${symbol}${(summary.totalSales || 0).toFixed(2)}`, width) + '\n';
              text += this.twoColumns('Discount:', `-${symbol}${(summary.totalDiscount || 0).toFixed(2)}`, width) + '\n';
              text += this.twoColumns('Void Amount:', `-${symbol}${(summary.voidAmount || 0).toFixed(2)}`, width) + '\n';
              text += this.twoColumns('Net Sales:', `${symbol}${(summary.netSales || 0).toFixed(2)}`, width) + '\n';
              text += '-'.repeat(width) + '\n\n';
    
              // ========== PAYMENT BREAKDOWN ==========
              text += this.centerText('PAYMENT BREAKDOWN', width) + '\n';
              text += '-'.repeat(width) + '\n';
              if (paymodeBreakdown.cash > 0) text += this.twoColumns('Cash:', `${symbol}${paymodeBreakdown.cash.toFixed(2)}`, width) + '\n';
              if (paymodeBreakdown.paynow > 0) text += this.twoColumns('PayNow:', `${symbol}${paymodeBreakdown.paynow.toFixed(2)}`, width) + '\n';
              if (paymodeBreakdown.upi > 0) text += this.twoColumns('UPI:', `${symbol}${paymodeBreakdown.upi.toFixed(2)}`, width) + '\n';
              if (paymodeBreakdown.card > 0) text += this.twoColumns('Card:', `${symbol}${paymodeBreakdown.card.toFixed(2)}`, width) + '\n';
              if (paymodeBreakdown.valuecard > 0) text += this.twoColumns('Value Card:', `${symbol}${paymodeBreakdown.valuecard.toFixed(2)}`, width) + '\n';
              if (paymodeBreakdown.cdc > 0) text += this.twoColumns('CDC Voucher:', `${symbol}${paymodeBreakdown.cdc.toFixed(2)}`, width) + '\n';
              if (paymodeBreakdown.other > 0) text += this.twoColumns('Other:', `${symbol}${paymodeBreakdown.other.toFixed(2)}`, width) + '\n';
              text += '-'.repeat(width) + '\n\n';
    
              // ========== CASH FLOW ==========
              text += this.centerText('CASH FLOW', width) + '\n';
              text += '-'.repeat(width) + '\n';
              text += this.twoColumns('Opening Cash:', `${symbol}${cashFlow.openingCash.toFixed(2)}`, width) + '\n';
              text += this.twoColumns('Cash Received:', `+${symbol}${cashFlow.cashReceived.toFixed(2)}`, width) + '\n';
              text += this.twoColumns('Cash Out Total:', `-${symbol}${cashFlow.manualCashOutTotal.toFixed(2)}`, width) + '\n';
              text += this.twoColumns('Expected Closing:', `${symbol}${cashFlow.expectedClosing.toFixed(2)}`, width) + '\n';
              text += this.twoColumns('Physical Cash:', `${symbol}${cashFlow.physicalCash.toFixed(2)}`, width) + '\n';
              
              const varianceSign = cashFlow.variance >= 0 ? '+' : '-';
              text += this.twoColumns('Variance:', `${varianceSign}${symbol}${Math.abs(cashFlow.variance).toFixed(2)}`, width) + '\n';
              text += '-'.repeat(width) + '\n\n';
    
              // ========== STAFF BREAKDOWN ==========
              if (staffBreakdown && staffBreakdown.length > 0) {
                  text += this.centerText('STAFF SALES BREAKDOWN', width) + '\n';
                  text += '='.repeat(width) + '\n';
                  for (const staff of staffBreakdown) {
                      text += `Staff Name: ${staff.name}\n`;
                      text += this.twoColumns('  Total Sales:', `${symbol}${staff.totalSales.toFixed(2)}`, width) + '\n';
                      
                      // Payments
                      const payList = [];
                      if (staff.cash > 0) payList.push(`Cash: ${symbol}${staff.cash.toFixed(2)}`);
                      if (staff.paynow > 0) payList.push(`PayNow: ${symbol}${staff.paynow.toFixed(2)}`);
                      if (staff.upi > 0) payList.push(`UPI: ${symbol}${staff.upi.toFixed(2)}`);
                      if (staff.card > 0) payList.push(`Card: ${symbol}${staff.card.toFixed(2)}`);
                      if (staff.valuecard > 0) payList.push(`Value Card: ${symbol}${staff.valuecard.toFixed(2)}`);
                      
                      if (payList.length > 0) {
                          text += `  - Payments: ${payList.join(', ')}\n`;
                      }
    
                      // Categories
                      if (staff.categories && Object.keys(staff.categories).length > 0) {
                          const catList = Object.entries(staff.categories).map(([catName, val]) => `${catName}: ${symbol}${(val as number).toFixed(2)}`);
                          text += `  - Categories: ${catList.join(', ')}\n`;
                      }
    
                      // Items
                      if (staff.items && Object.keys(staff.items).length > 0) {
                          const itemList = Object.entries(staff.items).map(([itemName, data]: any) => `${itemName} (${data.qty}x)`);
                          text += `  - Items: ${itemList.join(', ')}\n`;
                      }
                      text += '-'.repeat(width) + '\n';
                  }
              }
    
              text += '\n' + '='.repeat(width) + '\n';
              text += this.centerText('END OF SETTLEMENT', width) + '\n';
              text += '='.repeat(width) + '\n\n';
              text += this.centerText('SMARTRETAIL BY UNIPROSG', width) + '\n';
              text += '\n\n';
              return text;
          };

          if (company.printerEnabled) {
              console.log('🔌 Network printer enabled, printing settlement report...');
              const networkText = this.cleanThermalText(buildText(48));
              printedOnNetwork = await NetworkPrinterService.printRawText(
                  company.printerIP || '192.168.0.241',
                  company.printerPort || 9100,
                  networkText
              );
          }

          let printedOnSunmi = false;
          const sunmiReady = await SunmiPrinterService.init();
          if (sunmiReady) {
              const sunmiText = this.cleanThermalText(buildText(32));
              await SunmiPrinterService.printRawText(sunmiText);
              await SunmiPrinterService.cutPaper();
              printedOnSunmi = true;
          }

          return printedOnNetwork || printedOnSunmi;
      } catch (e) {
          console.log('Error printing settlement report thermal:', e);
          return false;
      }
  }

  // ==================== HELPER METHODS ====================
  private static centerText(text: string, width: number): string {
    if (!text) return ' '.repeat(width);
    const padding = Math.max(0, width - text.length);
    return ' '.repeat(Math.floor(padding / 2)) + text + ' '.repeat(padding - Math.floor(padding / 2));
  }

  private static twoColumns(left: string, right: string, width: number): string {
    const leftWidth = Math.floor(width * 0.55);
    const rightWidth = width - leftWidth;
    let leftText = left.substring(0, leftWidth);
    let rightText = right.substring(0, rightWidth);
    leftText = leftText.padEnd(leftWidth, ' ');
    return leftText + rightText;
  }
}

export default UniversalPrinter;