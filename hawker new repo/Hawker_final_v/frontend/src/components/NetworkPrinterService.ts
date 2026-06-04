// components/NetworkPrinterService.ts - HTTP Version (Works in Expo)
class NetworkPrinterService {
  
  static async testConnection(ip: string, port: number): Promise<boolean> {
    try {
      console.log(`🔍 Testing printer at ${ip}:${port}`);
      
      // Simple HTTP POST request
      const response = await fetch(`http://${ip}:${port}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'Test Print\n'
      }).catch(() => null);
      
      if (response) {
        console.log('✅ Printer responded');
        return true;
      }
      
      console.log('❌ No response from printer');
      return false;
      
    } catch (error) {
      console.log('❌ Test error:', error);
      return false;
    }
  }
  
  static async print(ip: string, port: number, receiptData: any): Promise<boolean> {
    try {
      console.log(`🖨️ Sending print to ${ip}:${port}`);
      
      // Build simple text receipt
      let text = '';
      text += '='.repeat(32) + '\n';
      text += `${receiptData.shopName || 'YOUR SHOP'}\n`;
      text += '='.repeat(32) + '\n';
      text += `INVOICE: ${receiptData.invoiceNumber || 'N/A'}\n`;
      text += `DATE: ${new Date().toLocaleString()}\n`;
      text += '-'.repeat(32) + '\n';
      
      for (const item of receiptData.items || []) {
        text += `${item.name} x${item.quantity} = $${(item.price * item.quantity).toFixed(2)}\n`;
      }
      
      text += '-'.repeat(32) + '\n';
      text += `TOTAL: $${receiptData.total.toFixed(2)}\n`;
      text += '='.repeat(32) + '\n';
      text += 'THANK YOU!\n';
      text += 'COME AGAIN!\n\n';
      
      // Send via HTTP POST
      const response = await fetch(`http://${ip}:${port}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: text
      });
      
      if (response) {
        console.log('✅ Print sent successfully');
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.log('❌ Print error:', error);
      return false;
    }
  }
}

export default NetworkPrinterService;