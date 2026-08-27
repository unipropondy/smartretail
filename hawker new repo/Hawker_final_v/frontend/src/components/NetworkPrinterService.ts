// components/NetworkPrinterService.ts - TCP Socket Version (Works in Expo with react-native-tcp-socket)
import TcpSocket from 'react-native-tcp-socket';

class NetworkPrinterService {
  
  static async testConnection(ip: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;
      const targetPort = port || 9100;
      const targetIp = ip.trim();
      
      console.log(`🔍 Testing printer TCP connection at ${targetIp}:${targetPort}`);
      
      const client = TcpSocket.createConnection(
        { port: targetPort, host: targetIp, localAddress: '0.0.0.0', reuseAddress: true },
        () => {
          console.log('✅ Connected to printer successfully for test');
          resolved = true;
          // Send simple carriage return to test write
          client.write('\r\n');
          client.destroy();
          resolve(true);
        }
      );
      
      client.on('error', (error) => {
        console.log('❌ Printer connection error:', error);
        if (!resolved) {
          resolved = true;
          client.destroy();
          resolve(false);
        }
      });
      
      // 3 second timeout for liveness check
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log('❌ Printer connection timeout');
          client.destroy();
          resolve(false);
        }
      }, 3000);
    });
  }
  
  static async printRawText(ip: string, port: number, text: string): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;
      const targetPort = port || 9100;
      const targetIp = ip.trim();
      
      console.log(`🖨️ Sending TCP print to ${targetIp}:${targetPort}`);
      
      const client = TcpSocket.createConnection(
        { port: targetPort, host: targetIp, localAddress: '0.0.0.0', reuseAddress: true },
        () => {
          console.log('✅ Connected to printer for printing');
          resolved = true;
          
          // ESC/POS Commands:
          // ESC @ (Initialize printer): 0x1B 0x40
          // GS V 66 0 (Cut paper): 0x1D 0x56 0x42 0x00
          const initCmd = '\x1B\x40';
          const cutCmd = '\x1D\x56\x42\x00';
          
          client.write(initCmd + text + '\n' + cutCmd);
          
          // Small delay before closing socket to ensure all buffers flush
          setTimeout(() => {
            client.destroy();
            resolve(true);
          }, 500);
        }
      );
      
      client.on('error', (error) => {
        console.log('❌ Printer print error:', error);
        if (!resolved) {
          resolved = true;
          client.destroy();
          resolve(false);
        }
      });
      
      // 5 second timeout for print job
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log('❌ Printer print timeout');
          client.destroy();
          resolve(false);
        }
      }, 5000);
    });
  }
  
  static async sendRawBytes(ip: string, port: number, data: string): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;
      const targetPort = port || 9100;
      const targetIp = ip.trim();
      
      console.log(`🔌 Sending raw bytes to ${targetIp}:${targetPort}`);
      
      const client = TcpSocket.createConnection(
        { port: targetPort, host: targetIp, localAddress: '0.0.0.0', reuseAddress: true },
        () => {
          console.log('✅ Connected to printer, writing raw bytes');
          resolved = true;
          client.write(data);
          
          setTimeout(() => {
            client.destroy();
            resolve(true);
          }, 300);
        }
      );
      
      client.on('error', (error) => {
        console.log('❌ Error writing raw bytes:', error);
        if (!resolved) {
          resolved = true;
          client.destroy();
          resolve(false);
        }
      });
      
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log('❌ Timeout writing raw bytes');
          client.destroy();
          resolve(false);
        }
      }, 3000);
    });
  }
}

export default NetworkPrinterService;