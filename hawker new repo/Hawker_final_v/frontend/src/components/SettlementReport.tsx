// components/SettlementReport.tsx - FIXED VERSION

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import API from '../api';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';

interface SettlementReportProps {
  visible: boolean;
  onClose: () => void;
  outletId: number;
  outletName: string;
  cashierName: string;
  theme: any;
  t: any;
  formatPrice: (amount: number) => string;
}

const NOTES = [100, 50, 20, 10, 5, 2, 1];
const COINS = [0.50, 0.20, 0.10, 0.05];

// ✅ Processing Modal Component
const ProcessingModal = ({ visible, message, theme }: { visible: boolean; message: string; theme: any }) => (
  <Modal visible={visible} transparent={true} animationType="fade">
    <View style={styles.processingOverlay}>
      <View style={[styles.processingContainer, { backgroundColor: theme.card }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.processingText, { color: theme.text, marginTop: 15 }]}>{message}</Text>
        <Text style={[styles.processingSubText, { color: theme.textSecondary, marginTop: 5 }]}>
          Please wait...
        </Text>
      </View>
    </View>
  </Modal>
);

const SettlementReport: React.FC<SettlementReportProps> = ({
  visible, onClose, outletId, outletName, cashierName,
  theme, t, formatPrice
}) => {
  const [loading, setLoading] = useState(false);
  const [settlementDate, setSettlementDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  
  const hasLoadedRef = useRef(false);
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Processing...');
  
  const [isSettled, setIsSettled] = useState(false);
  const [settlementId, setSettlementId] = useState<number | null>(null);
  
  // Opening Cash
  const [showOpeningCashModal, setShowOpeningCashModal] = useState(false);
  const [openingNotes, setOpeningNotes] = useState<Record<number, number>>({
    100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
  });
  const [openingCoins, setOpeningCoins] = useState<Record<number, number>>({
    0.50: 0, 0.20: 0, 0.10: 0, 0.05: 0
  });
  const [openingCashSaved, setOpeningCashSaved] = useState(false);
  
  // Cash Out
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [cashOutReason, setCashOutReason] = useState('');
  const [cashOutRecipient, setCashOutRecipient] = useState('');
  const [manualCashOuts, setManualCashOuts] = useState<any[]>([]);
  const [editingCashOut, setEditingCashOut] = useState<any>(null);
  
  // Physical Cash
  const [showPhysicalCashModal, setShowPhysicalCashModal] = useState(false);
  const [physicalNotes, setPhysicalNotes] = useState<Record<number, number>>({
    100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 2: 0, 1: 0
  });
  const [physicalCoins, setPhysicalCoins] = useState<Record<number, number>>({
    0.50: 0, 0.20: 0, 0.10: 0, 0.05: 0
  });
  const [physicalCashSaved, setPhysicalCashSaved] = useState(false);
  
  // Settlement Data
  const [summary, setSummary] = useState({
    totalSales: 0, totalDiscount: 0, voidAmount: 0, netSales: 0
  });
  
  const [paymodeBreakdown, setPaymodeBreakdown] = useState({
    cash: 0, card: 0, upi: 0, paynow: 0, valuecard: 0, cdc: 0, other: 0
  });
  
  const [cashFlow, setCashFlow] = useState({
    openingCash: 0,
    cashReceived: 0,
    manualCashOutTotal: 0,
    expectedClosing: 0,
    physicalCash: 0,
    variance: 0
  });
  
  const [emailAddress, setEmailAddress] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // ============ LOAD DATA ============
  const loadData = useCallback(async () => {
    if (!visible || !outletId) {
      console.log('⚠️ Settlement: Not visible or no outletId');
      return;
    }
    
    setLoading(true);
    try {
      const dateStr = settlementDate.toISOString().split('T')[0];
      console.log('📅 Settlement date:', dateStr);
      console.log('🏪 Outlet ID:', outletId);
      
      // ✅ STEP 1: Check if settlement exists
      const checkRes = await API.get(`/settlement/check?outletId=${outletId}&date=${dateStr}`);
      console.log('📥 Check response:', checkRes.data);
      
      if (checkRes.data.settled) {
        setIsSettled(true);
        setSettlementId(checkRes.data.settlementId);
      } else {
        setIsSettled(false);
        setSettlementId(null);
      }
      
      // ✅ STEP 2: Load opening cash
      try {
        const openingRes = await API.get(`/settlement/opening-cash?outletId=${outletId}&date=${dateStr}`);
        console.log('📥 Opening cash response:', openingRes.data);
        
        if (openingRes.data.success && openingRes.data.data) {
          const data = openingRes.data.data;
          setOpeningNotes(data.notes || openingNotes);
          setOpeningCoins(data.coins || openingCoins);
          setCashFlow(prev => ({ ...prev, openingCash: data.total || 0 }));
          setOpeningCashSaved(true);
        }
      } catch (error) {
        console.log('⚠️ Opening cash load error:', error);
        setOpeningCashSaved(false);
      }
      
      // ✅ STEP 3: Load cash out
      try {
        const cashOutRes = await API.get(`/settlement/cash-out?outletId=${outletId}&date=${dateStr}`);
        console.log('📥 Cash out response:', cashOutRes.data);
        
        if (cashOutRes.data.success && cashOutRes.data.data) {
          setManualCashOuts(cashOutRes.data.data);
          const total = cashOutRes.data.data.reduce((sum: number, item: any) => sum + item.amount, 0);
          setCashFlow(prev => ({ ...prev, manualCashOutTotal: total }));
        }
      } catch (error) {
        console.log('⚠️ Cash out load error:', error);
        setManualCashOuts([]);
        setCashFlow(prev => ({ ...prev, manualCashOutTotal: 0 }));
      }
      
      // ✅ STEP 4: Load physical cash
      try {
        const physicalRes = await API.get(`/settlement/physical-cash?outletId=${outletId}&date=${dateStr}`);
        console.log('📥 Physical cash response:', physicalRes.data);
        
        if (physicalRes.data.success && physicalRes.data.data) {
          const data = physicalRes.data.data;
          setPhysicalNotes(data.notes || physicalNotes);
          setPhysicalCoins(data.coins || physicalCoins);
          const total = data.total || 0;
          setCashFlow(prev => ({ ...prev, physicalCash: total }));
          setPhysicalCashSaved(true);
        }
      } catch (error) {
        console.log('⚠️ Physical cash load error:', error);
        setPhysicalCashSaved(false);
      }
      
      // ✅ STEP 5: Load sales data
      try {
        console.log('📊 Fetching sales for date:', dateStr);
        const salesRes = await API.get(`/sales?filter=custom&startDate=${dateStr}&endDate=${dateStr}&showAll=true`);
        console.log('📥 Sales response count:', salesRes.data?.length || 0);
        
        const sales = salesRes.data || [];
        let totalSales = 0;
        let totalDiscount = 0;
        let cashReceived = 0;
        const paymodeMap: Record<string, number> = {};
        
        sales.forEach((sale: any) => {
          // ✅ FIX: Get discount from sale
          let discountAmount = 0;
          let finalAmount = sale.total || 0;
          
          if (sale.discount && sale.discount.amount) {
            discountAmount = sale.discount.amount;
          } else if (sale.discountAmount) {
            discountAmount = sale.discountAmount;
          }
          
          // ✅ Original total = final + discount
          const originalAmount = finalAmount + discountAmount;
          
          // ✅ Add to totals
          totalSales += originalAmount;
          totalDiscount += discountAmount;
          
          // ✅ Payment breakdown
          const method = (sale.paymentMethod || 'Unknown').toLowerCase();
          if (method.includes('cash')) {
            paymodeMap['Cash'] = (paymodeMap['Cash'] || 0) + finalAmount;
            cashReceived += finalAmount;
          } else if (method.includes('upi')) {
            paymodeMap['UPI'] = (paymodeMap['UPI'] || 0) + finalAmount;
          } else if (method.includes('card')) {
            paymodeMap['Card'] = (paymodeMap['Card'] || 0) + finalAmount;
          } else if (method.includes('paynow')) {
            paymodeMap['PayNow'] = (paymodeMap['PayNow'] || 0) + finalAmount;
          } else if (method.includes('value')) {
            paymodeMap['Value Card'] = (paymodeMap['Value Card'] || 0) + finalAmount;
          } else {
            paymodeMap['Other'] = (paymodeMap['Other'] || 0) + finalAmount;
          }
        });
        
        console.log('📊 Calculated totals:', { totalSales, totalDiscount, cashReceived });
        
        setSummary({
          totalSales: totalSales,
          totalDiscount: totalDiscount,
          voidAmount: 0, // ✅ Will be loaded separately
          netSales: totalSales - totalDiscount,
        });
        
        setPaymodeBreakdown({
          cash: paymodeMap['Cash'] || 0,
          card: paymodeMap['Card'] || 0,
          upi: paymodeMap['UPI'] || 0,
          paynow: paymodeMap['PayNow'] || 0,
          valuecard: paymodeMap['Value Card'] || 0,
          cdc: paymodeMap['CDC Voucher'] || 0,
          other: paymodeMap['Other'] || 0
        });
        
        // ✅ Load void sales separately
        try {
          const voidRes = await API.get(`/sales?filter=custom&startDate=${dateStr}&endDate=${dateStr}&status=voided&showAll=true`);
          const voidSales = voidRes.data || [];
          let voidAmount = 0;
          voidSales.forEach((sale: any) => {
            let saleTotal = sale.total || 0;
            let saleDiscount = 0;
            if (sale.discount && sale.discount.amount) {
              saleDiscount = sale.discount.amount;
            } else if (sale.discountAmount) {
              saleDiscount = sale.discountAmount;
            }
            voidAmount += (saleTotal + saleDiscount);
          });
          
          setSummary(prev => ({ ...prev, voidAmount }));
        } catch (voidError) {
          console.log('⚠️ Void load error:', voidError);
        }
        
        // ✅ Update cash flow
        setCashFlow(prev => {
          const expectedClosing = prev.openingCash + cashReceived - prev.manualCashOutTotal;
          const variance = prev.physicalCash - expectedClosing;
          return { ...prev, cashReceived, expectedClosing, variance };
        });
        
      } catch (salesError) {
        console.log('❌ Sales load error:', salesError);
      }
      
    } catch (error) {
      console.log('❌ Load error:', error);
      Alert.alert('Error', 'Failed to load settlement data');
    } finally {
      setLoading(false);
    }
  }, [visible, settlementDate, outletId]);

  // ============ EFFECTS ============
  useEffect(() => {
    if (visible && outletId) {
      console.log('📊 Settlement modal opened, loading data...');
      hasLoadedRef.current = false;
      loadData();
    }
  }, [visible, outletId, settlementDate]);

  useEffect(() => {
    if (visible && outletId) {
      loadData();
    }
  }, [settlementDate]);

  // ============ SAVE FUNCTIONS ============
  const withMinDisplayTime = async (callback: () => Promise<void>, message: string) => {
    setProcessingMessage(message);
    setProcessing(true);
    const startTime = Date.now();
    
    try {
      await callback();
    } finally {
      const elapsed = Date.now() - startTime;
      setTimeout(() => setProcessing(false), Math.max(0, 500 - elapsed));
    }
  };

  const saveOpeningCashToDatabase = async () => {
    let total = 0;
    Object.entries(openingNotes).forEach(([denom, count]) => total += parseFloat(denom) * count);
    Object.entries(openingCoins).forEach(([denom, count]) => total += parseFloat(denom) * count);
    
    await withMinDisplayTime(async () => {
      const dateStr = settlementDate.toISOString().split('T')[0];
      await API.post('/settlement/opening-cash', {
        outletId, settlementDate: dateStr, notes: openingNotes, coins: openingCoins, total, cashierName
      });
      
      setCashFlow(prev => ({ 
        ...prev, 
        openingCash: total,
        expectedClosing: total + prev.cashReceived - prev.manualCashOutTotal,
        variance: prev.physicalCash - (total + prev.cashReceived - prev.manualCashOutTotal)
      }));
      
      setOpeningCashSaved(true);
      setShowOpeningCashModal(false);
      
      Alert.alert('✅ Success', `Opening cash saved: ${formatPrice(total)}`);
    }, 'Saving opening cash...');
  };

  const saveCashOutToDatabase = async () => {
    const amount = parseFloat(cashOutAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Enter valid amount');
      return;
    }
    if (!cashOutReason.trim()) {
      Alert.alert('Error', 'Enter reason');
      return;
    }
    
    await withMinDisplayTime(async () => {
      const dateStr = settlementDate.toISOString().split('T')[0];
      
      if (editingCashOut) {
        await API.put(`/settlement/cash-out/${editingCashOut.id}?outletId=${Number(outletId)}&date=${dateStr}`, {
          amount, reason: cashOutReason, recipient: cashOutRecipient
        });
      } else {
        await API.post('/settlement/cash-out', {
          outletId: Number(outletId), settlementDate: dateStr, amount,
          reason: cashOutReason, recipient: cashOutRecipient, cashierName
        });
      }
      
      const cashOutRes = await API.get(`/settlement/cash-out?outletId=${Number(outletId)}&date=${dateStr}`);
      if (cashOutRes.data.success) {
        setManualCashOuts(cashOutRes.data.data);
        const newTotal = cashOutRes.data.data.reduce((sum, item) => sum + item.amount, 0);
        setCashFlow(prev => {
          const newExpectedClosing = prev.openingCash + prev.cashReceived - newTotal;
          const newVariance = prev.physicalCash - newExpectedClosing;
          return { ...prev, manualCashOutTotal: newTotal, expectedClosing: newExpectedClosing, variance: newVariance };
        });
      }
      
      setCashOutAmount('');
      setCashOutReason('');
      setCashOutRecipient('');
      setEditingCashOut(null);
      setShowCashOutModal(false);
      Alert.alert('✅ Success', editingCashOut ? 'Cash out updated' : 'Cash out added');
    }, editingCashOut ? 'Updating cash out...' : 'Adding cash out...');
  };

  const deleteCashOut = async (id: number) => {
    Alert.alert('Confirm', 'Delete this cash out entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await withMinDisplayTime(async () => {
            const dateStr = settlementDate.toISOString().split('T')[0];
            await API.delete(`/settlement/cash-out/${id}?outletId=${Number(outletId)}&date=${dateStr}`);
            
            const cashOutRes = await API.get(`/settlement/cash-out?outletId=${Number(outletId)}&date=${dateStr}`);
            if (cashOutRes.data.success) {
              setManualCashOuts(cashOutRes.data.data);
              const newTotal = cashOutRes.data.data.reduce((sum, item) => sum + item.amount, 0);
              setCashFlow(prev => {
                const newExpectedClosing = prev.openingCash + prev.cashReceived - newTotal;
                const newVariance = prev.physicalCash - newExpectedClosing;
                return { ...prev, manualCashOutTotal: newTotal, expectedClosing: newExpectedClosing, variance: newVariance };
              });
            }
            Alert.alert('✅ Success', 'Entry deleted');
          }, 'Deleting cash out...');
        }
      }
    ]);
  };

  const editCashOut = (item: any) => {
    setEditingCashOut(item);
    setCashOutAmount(item.amount.toString());
    setCashOutReason(item.reason);
    setCashOutRecipient(item.recipient || '');
    setShowCashOutModal(true);
  };

  const savePhysicalCashToDatabase = async () => {
    let total = 0;
    Object.entries(physicalNotes).forEach(([denom, count]) => total += parseFloat(denom) * count);
    Object.entries(physicalCoins).forEach(([denom, count]) => total += parseFloat(denom) * count);
    
    await withMinDisplayTime(async () => {
      const dateStr = settlementDate.toISOString().split('T')[0];
      await API.post('/settlement/physical-cash', {
        outletId, settlementDate: dateStr, notes: physicalNotes, coins: physicalCoins, total
      });
      
      const newExpectedClosing = cashFlow.openingCash + cashFlow.cashReceived - cashFlow.manualCashOutTotal;
      const newVariance = total - newExpectedClosing;
      
      setCashFlow(prev => ({ ...prev, physicalCash: total, expectedClosing: newExpectedClosing, variance: newVariance }));
      setPhysicalCashSaved(true);
      setShowPhysicalCashModal(false);
      
      if (newVariance !== 0) {
        Alert.alert('Cash Variance', `${newVariance > 0 ? '💰 Over by' : '⚠️ Short by'} ${formatPrice(Math.abs(newVariance))}`);
      } else {
        Alert.alert('✅ Perfect Match', 'Physical cash matches expected closing!');
      }
    }, 'Verifying physical cash...');
  };

  const finalizeSettlement = async () => {
    if (!openingCashSaved) {
      Alert.alert('Missing', 'Save Opening Cash first');
      return;
    }
    if (!physicalCashSaved) {
      Alert.alert('Missing', 'Save Physical Cash Count first');
      return;
    }
    
    await withMinDisplayTime(async () => {
      const dateStr = settlementDate.toISOString().split('T')[0];
      await API.post('/settlement/finalize', {
        outletId, settlementDate: dateStr, cashierName,
        totalSales: summary.totalSales, totalDiscount: summary.totalDiscount,
        voidAmount: summary.voidAmount, netSales: summary.netSales,
        openingCash: cashFlow.openingCash, cashReceived: cashFlow.cashReceived,
        manualCashOutTotal: cashFlow.manualCashOutTotal,
        expectedClosing: cashFlow.expectedClosing, physicalCash: cashFlow.physicalCash,
        variance: cashFlow.variance,
        varianceStatus: cashFlow.variance === 0 ? 'BALANCED' : cashFlow.variance > 0 ? 'OVER' : 'SHORT',
        cashAmount: paymodeBreakdown.cash, cardAmount: paymodeBreakdown.card,
        upiAmount: paymodeBreakdown.upi, paynowAmount: paymodeBreakdown.paynow,
        valueCardAmount: paymodeBreakdown.valuecard
      });
      
      setIsSettled(true);
      Alert.alert('✅ Success', 'Day settled successfully!');
      onClose();
    }, 'Finalizing settlement...');
  };

  // ============ DATEPICKER HANDLERS ============
  const openDatePicker = useCallback(() => {
    setTempDate(settlementDate);
    setShowPicker(true);
  }, [settlementDate]);

  const onDateChange = useCallback((event: any, selectedDate?: Date) => {
    if (event.type === 'set' && selectedDate) {
      setSettlementDate(selectedDate);
      hasLoadedRef.current = false;
      setIsSettled(false);
      setSettlementId(null);
    }
    setShowPicker(false);
  }, []);

  // ============ RENDER DENOMINATION INPUT ============
  const renderDenominationInput = (
    notes: Record<number, number>, setNotes: any,
    coins: Record<number, number>, setCoins: any,
    title: string
  ) => {
    const handleNoteChange = (denom: number, value: string) => {
      if (value === '') {
        setNotes((prev: any) => ({ ...prev, [denom]: 0 }));
        return;
      }
      const num = parseInt(value);
      if (!isNaN(num) && num >= 0) {
        setNotes((prev: any) => ({ ...prev, [denom]: num }));
      }
    };
    
    const handleCoinChange = (denom: number, value: string) => {
      if (value === '') {
        setCoins((prev: any) => ({ ...prev, [denom]: 0 }));
        return;
      }
      const num = parseInt(value);
      if (!isNaN(num) && num >= 0) {
        setCoins((prev: any) => ({ ...prev, [denom]: num }));
      }
    };
    
    const getSymbol = () => {
      const sample = formatPrice(1);
      return sample.replace('1.00', '').replace('1', '').trim() || '$';
    };
    const currencySymbol = getSymbol();
    
    return (
      <>
        <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>{title} - Notes</Text>
        {NOTES.map(denom => (
          <View key={denom} style={styles.denomRow}>
            <Text style={[styles.denomLabel, { color: theme.text }]}>
              {currencySymbol}{denom} ×
            </Text>
            <TextInput
              style={[styles.denomInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              keyboardType="numeric"
              value={notes[denom] === 0 ? '' : notes[denom].toString()}
              onChangeText={(t) => handleNoteChange(denom, t)}
              editable={!isSettled}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
            />
            <Text style={[styles.denomTotal, { color: theme.primary }]}>
              = {currencySymbol}{(denom * (notes[denom] || 0)).toFixed(2)}
            </Text>
          </View>
        ))}
        <Text style={[styles.modalLabel, { color: theme.textSecondary, marginTop: 15 }]}>{title} - Coins</Text>
        {COINS.map(denom => (
          <View key={denom} style={styles.denomRow}>
            <Text style={[styles.denomLabel, { color: theme.text }]}>
              {currencySymbol}{denom} ×
            </Text>
            <TextInput
              style={[styles.denomInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              keyboardType="numeric"
              value={coins[denom] === 0 ? '' : coins[denom].toString()}
              onChangeText={(t) => handleCoinChange(denom, t)}
              editable={!isSettled}
              placeholder="0"
              placeholderTextColor={theme.textSecondary}
            />
            <Text style={[styles.denomTotal, { color: theme.primary }]}>
              = {currencySymbol}{(denom * (coins[denom] || 0)).toFixed(2)}
            </Text>
          </View>
        ))}
      </>
    );
  };

  // ============ REPORT ACTIONS ============
  const generateHTML = (): string => {
    const symbol = '$';
    const dateStr = settlementDate.toLocaleDateString();
    
    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Settlement Report</title>
        <style>
            body { 
                font-family: monospace; 
                padding: 20px; 
                background: #f5f5f5;
                margin: 0;
            }
            .container { 
                max-width: 800px; 
                margin: 0 auto; 
                background: white; 
                padding: 20px; 
                border-radius: 10px;
                min-height: 100vh;
                position: relative;
                display: flex;
                flex-direction: column;
            }
            .header { 
                text-align: center; 
                border-bottom: 2px solid #000; 
                margin-bottom: 20px;
            }
            .content {
                flex: 1;
            }
            .section-title { 
                font-size: 16px; 
                font-weight: bold; 
                background: #f0f0f0; 
                padding: 8px; 
                margin: 15px 0 10px; 
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin: 10px 0; 
            }
            th, td { 
                padding: 8px; 
                border-bottom: 1px solid #ddd; 
                text-align: left; 
            }
            .amount { 
                text-align: right; 
            }
            .footer { 
                margin-top: 40px;
                padding-top: 20px;
                text-align: center; 
                font-size: 11px;
                color: #666;
                border-top: 1px solid #ddd;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>${outletName || 'Outlet'}</h2>
                <p>Cashier: ${cashierName || 'Admin'} | Date: ${dateStr}</p>
                <h3>SETTLEMENT REPORT</h3>
            </div>
            
            <div class="content">
                <div class="section-title">📊 SALES SUMMARY</div>
                <table>
                    <tr><th>Total Sales</th><td class="amount">${formatPrice(summary.totalSales)}</td></tr>
                    <tr><th>Discount</th><td class="amount">-${formatPrice(summary.totalDiscount)}</td></tr>
                    <tr><th>Void</th><td class="amount">-${formatPrice(summary.voidAmount)}</td></tr>
                    <tr style="font-weight:bold"><th>Net Sales</th><td class="amount">${formatPrice(summary.netSales)}</td></tr>
                </table>
                
                <div class="section-title">💰 CASH FLOW</div>
                <table>
                    <tr><th>Description</th><th class="amount">Amount</th></tr>
                    <tr><td>Opening Cash</td><td class="amount">${formatPrice(cashFlow.openingCash)}</td></tr>
                    <tr><td>+ Cash Received</td><td class="amount">+${formatPrice(cashFlow.cashReceived)}</td></tr>
                    ${manualCashOuts.map(t => `<tr><td style="padding-left:20px">- ${t.reason}</td><td class="amount">-${formatPrice(t.amount)}</td></tr>`).join('')}
                    <tr style="font-weight:bold"><td>Expected Closing Cash</td><td class="amount">${formatPrice(cashFlow.expectedClosing)}</td></tr>
                    <tr><td>Physical Cash Count</td><td class="amount">${formatPrice(cashFlow.physicalCash)}</td></tr>
                    <tr style="font-weight:bold;${cashFlow.variance === 0 ? 'color:green' : cashFlow.variance > 0 ? 'color:orange' : 'color:red'}">
                        <td>Variance</td><td class="amount">${cashFlow.variance >= 0 ? '+' : ''}${formatPrice(Math.abs(cashFlow.variance))}</td>
                    </tr>
                </table>
            </div>
            
            <div class="footer">
                <p>© ${new Date().getFullYear()} SMART-POS | Generated on ${new Date().toLocaleString()}</p>
            </div>
        </div>
    </body>
    </html>`;
  };

  const handlePrint = async () => {
    if (!isSettled) {
      Alert.alert('Info', 'Please finalize settlement first');
      return;
    }
    await Print.printAsync({ html: generateHTML() });
  };
  
  const handleDownloadPDF = async () => {
    if (!isSettled) {
      Alert.alert('Info', 'Please finalize settlement first');
      return;
    }
    const { uri } = await Print.printToFileAsync({ html: generateHTML() });
    await Sharing.shareAsync(uri);
  };

  const handleExportExcel = async () => {
    if (!isSettled) {
      Alert.alert('Info', 'Please finalize settlement first');
      return;
    }
    
    setProcessing(true);
    
    try {
      const csvRows = [
        ['Settlement Report', settlementDate.toLocaleDateString()],
        ['Total Sales', summary.totalSales],
        ['Total Discount', summary.totalDiscount],
        ['Void Amount', summary.voidAmount],
        ['Net Sales', summary.netSales],
        ['Opening Cash', cashFlow.openingCash],
        ['Cash Received', cashFlow.cashReceived],
        ['Manual Cash Out', cashFlow.manualCashOutTotal],
        ['Expected Closing', cashFlow.expectedClosing],
        ['Physical Cash', cashFlow.physicalCash],
        ['Variance', cashFlow.variance]
      ];
      
      const csvContent = csvRows.map(row => row.join(',')).join('\n');
      
      const fileName = `settlement_${Date.now()}.csv`;
      const filePath = FileSystem.cacheDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(filePath, csvContent);
      await Sharing.shareAsync(filePath);
      
      Alert.alert('✅ Success', 'File saved');
      
    } catch (error) {
      Alert.alert('Error', 'Failed to export');
    } finally {
      setProcessing(false);
    }
  };

  const generateCSV = () => {
    const dateStr = settlementDate.toLocaleDateString();
    
    const rows = [
      ['SETTLEMENT REPORT'],
      [`Outlet: ${outletName}`],
      [`Cashier: ${cashierName}`],
      [`Date: ${dateStr}`],
      [],
      ['SALES SUMMARY'],
      ['Total Sales', formatPrice(summary.totalSales)],
      ['Total Discount', formatPrice(summary.totalDiscount)],
      ['Void Amount', formatPrice(summary.voidAmount)],
      ['Net Sales', formatPrice(summary.netSales)],
      [],
      ['CASH FLOW'],
      ['Opening Cash', formatPrice(cashFlow.openingCash)],
      ['Cash Received', formatPrice(cashFlow.cashReceived)],
      ['Manual Cash Out', formatPrice(cashFlow.manualCashOutTotal)],
      ['Expected Closing', formatPrice(cashFlow.expectedClosing)],
      ['Physical Cash', formatPrice(cashFlow.physicalCash)],
      ['Variance', formatPrice(cashFlow.variance)],
      [],
      ['PAYMENT BREAKDOWN'],
      ['Cash', formatPrice(paymodeBreakdown.cash)],
      ['Card', formatPrice(paymodeBreakdown.card)],
      ['UPI', formatPrice(paymodeBreakdown.upi)],
      ['PayNow', formatPrice(paymodeBreakdown.paynow)],
      ['Value Card', formatPrice(paymodeBreakdown.valuecard)],
      ['Other', formatPrice(paymodeBreakdown.other)],
      [],
      [`Generated on: ${new Date().toLocaleString()}`]
    ];
    
    return rows.map(row => row.join(',')).join('\n');
  };

  const handleEmailReport = async () => {
    if (!emailAddress) {
      Alert.alert('Error', 'Please enter email address');
      return;
    }
    
    if (!emailAddress.includes('@')) {
      Alert.alert('Error', 'Please enter valid email address');
      return;
    }
    
    setSendingEmail(true);
    
    try {
      const pdfResult = await Print.printToFileAsync({ 
        html: generateHTML(),
        base64: true
      });
      
      const csvContent = generateCSV();
      let excelBase64 = '';
      try {
        excelBase64 = btoa(csvContent);
      } catch (e) {
        excelBase64 = await stringToBase64(csvContent);
      }
      
      const response = await API.post('/send-settlement-email', {
        to: emailAddress,
        subject: `Settlement Report - ${settlementDate.toLocaleDateString()} - ${outletName}`,
        pdfBase64: pdfResult.base64,
        excelBase64: excelBase64,
        outletName: outletName,
        cashierName: cashierName,
        date: settlementDate.toLocaleDateString()
      });
      
      if (response.data.success) {
        Alert.alert('✅ Success', `Report sent to ${emailAddress}`);
        setEmailAddress('');
        setShowEmailModal(false);
      }
      
    } catch (error) {
      console.error('Email error:', error);
      Alert.alert('Error', 'Failed to send email: ' + (error.message || 'Unknown error'));
    } finally {
      setSendingEmail(false);
    }
  };

  const stringToBase64 = (str: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const base64 = btoa(unescape(encodeURIComponent(str)));
        resolve(base64);
      } catch (error) {
        reject(error);
      }
    });
  };

  // ============ RENDER ============
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ProcessingModal visible={processing} message={processingMessage} theme={theme} />
      
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settlement Report</Text>
          {isSettled && <View style={styles.settledBadge}><Text style={styles.settledBadgeText}>✓ SETTLED</Text></View>}
        </View>
        
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={openDatePicker}
          >
            <Ionicons name="calendar" size={20} color={theme.primary} />
            <Text style={[styles.dateText, { color: theme.text }]}>{settlementDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
          {showPicker && <DateTimePicker value={tempDate} mode="date" display="default" onChange={onDateChange} />}
          
          <View style={styles.actionRow}>
            <TouchableOpacity
              disabled={isSettled}
              style={[styles.smallBtn, { backgroundColor: theme.primary, opacity: isSettled ? 0.6 : 1 }]}
              onPress={() => setShowOpeningCashModal(true)}
            >
              <Ionicons name="cash-outline" size={18} color="#fff" />
              <Text style={styles.smallBtnText}>{openingCashSaved ? '✓ Opening Cash' : 'Opening Cash'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.smallBtn, { backgroundColor: theme.danger, opacity: isSettled ? 0.6 : 1 }]} 
              onPress={() => { 
                setEditingCashOut(null); 
                setCashOutAmount(''); 
                setCashOutReason(''); 
                setCashOutRecipient(''); 
                setShowCashOutModal(true); 
              }} 
              disabled={isSettled}
            >
              <Ionicons name="remove-circle-outline" size={18} color="#fff" />
              <Text style={styles.smallBtnText}>Cash Out</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.smallBtn, { backgroundColor: theme.success, opacity: isSettled ? 0.6 : 1 }]} 
              onPress={() => setShowPhysicalCashModal(true)} 
              disabled={isSettled}
            >
              <Ionicons name="eye-outline" size={18} color="#fff" />
              <Text style={styles.smallBtnText}>{physicalCashSaved ? '✓ Count Cash' : 'Count Cash'}</Text>
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : (
            <>
              <View style={styles.summaryGrid}>
                <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Sales</Text>
                  <Text style={[styles.summaryValue, { color: theme.primary }]}>{formatPrice(summary.totalSales)}</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Discount</Text>
                  <Text style={[styles.summaryValue, { color: theme.danger }]}>-{formatPrice(summary.totalDiscount)}</Text>
                </View>
                <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Void</Text>
                  <Text style={[styles.summaryValue, { color: theme.danger }]}>-{formatPrice(summary.voidAmount)}</Text>
                </View>
              </View>
              
              <View style={[styles.netCard, { backgroundColor: theme.primary }]}>
                <Text style={styles.netLabel}>NET SALES</Text>
                <Text style={styles.netValue}>{formatPrice(summary.netSales)}</Text>
              </View>
              
              <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>💰 Cash Flow</Text>
                <View style={styles.cashRow}>
                  <Text style={[styles.cashLabel, { color: theme.textSecondary }]}>Opening Cash</Text>
                  <Text style={[styles.cashValue, { color: theme.success }]}>{formatPrice(cashFlow.openingCash)}</Text>
                  {openingCashSaved && <Text style={styles.savedIcon}>✓</Text>}
                </View>
                <View style={styles.cashRow}>
                  <Text style={[styles.cashLabel, { color: theme.textSecondary }]}>Cash Received</Text>
                  <Text style={[styles.cashValue, { color: theme.success }]}>+{formatPrice(cashFlow.cashReceived)}</Text>
                </View>
                {manualCashOuts.map(item => (
                  <View key={item.id} style={[styles.cashRow, styles.manualRow]}>
                    <Text style={[styles.cashLabel, { color: theme.textSecondary, marginLeft: 20 }]}>
                      ➖ {item.reason}{item.recipient ? ` (${item.recipient})` : ''}
                    </Text>
                    <Text style={[styles.cashValue, { color: theme.danger }]}>-{formatPrice(item.amount)}</Text>
                    {!isSettled && (
                      <View style={styles.cashOutActions}>
                        <TouchableOpacity onPress={() => editCashOut(item)}>
                          <Ionicons name="pencil" size={16} color={theme.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteCashOut(item.id)}>
                          <Ionicons name="trash" size={16} color={theme.danger} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
                <View style={[styles.cashRow, styles.closingRow]}>
                  <Text style={[styles.cashLabel, { color: theme.text, fontWeight: 'bold' }]}>Expected Closing Cash</Text>
                  <Text style={[styles.cashValue, { color: theme.primary, fontWeight: 'bold', fontSize: 18 }]}>
                    {formatPrice(cashFlow.expectedClosing)}
                  </Text>
                </View>
              </View>
              
              {cashFlow.physicalCash > 0 && (
                <View style={[styles.section, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>🔍 Physical Cash Verification</Text>
                  <View style={styles.cashRow}>
                    <Text style={[styles.cashLabel, { color: theme.textSecondary }]}>Physical Cash Count</Text>
                    <Text style={[styles.cashValue, { color: theme.text }]}>{formatPrice(cashFlow.physicalCash)}</Text>
                    {physicalCashSaved && <Text style={styles.savedIcon}>✓</Text>}
                  </View>
                  <View style={[styles.cashRow, styles.varianceRow]}>
                    <Text style={[styles.cashLabel, { 
                      color: cashFlow.variance === 0 ? theme.success : cashFlow.variance > 0 ? theme.warning : theme.danger, 
                      fontWeight: 'bold' 
                    }]}>
                      {cashFlow.variance === 0 ? '✅ Balanced' : cashFlow.variance > 0 ? '💰 Over' : '⚠️ Short'}
                    </Text>
                    <Text style={[styles.cashValue, { 
                      color: cashFlow.variance === 0 ? theme.success : cashFlow.variance > 0 ? theme.success : theme.danger, 
                      fontWeight: 'bold', fontSize: 18 
                    }]}>
                      {cashFlow.variance === 0 ? '' : cashFlow.variance > 0 ? '+' : '-'}{formatPrice(Math.abs(cashFlow.variance))}
                    </Text>
                  </View>
                </View>
              )}
              
              {isSettled ? (
                <View style={styles.actionGrid}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={handlePrint}>
                    <Ionicons name="print" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Print</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.secondary }]} onPress={handleDownloadPDF}>
                    <Ionicons name="download" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.secondary }]} onPress={handleExportExcel}>
                    <Ionicons name="document-text" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Excel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.warning }]} onPress={() => setShowEmailModal(true)}>
                    <Ionicons name="mail" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Email</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.endDayBtn, { 
                    backgroundColor: theme.danger, 
                    opacity: (!openingCashSaved || !physicalCashSaved) ? 0.5 : 1 
                  }]} 
                  onPress={finalizeSettlement} 
                  disabled={!openingCashSaved || !physicalCashSaved}
                >
                  <Text style={styles.endDayBtnText}>END DAY - FINALIZE SETTLEMENT</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </View>
      
      {/* Opening Cash Modal */}
      <Modal visible={showOpeningCashModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, maxHeight: '85%' }]}>
            <ScrollView showsVerticalScrollIndicator={true}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>💰 Opening Cash Count</Text>
              {renderDenominationInput(openingNotes, setOpeningNotes, openingCoins, setOpeningCoins, 'Count Cash in Drawer')}
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: theme.border }]} onPress={() => setShowOpeningCashModal(false)}>
                  <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]} onPress={saveOpeningCashToDatabase} disabled={processing}>
                  <Text style={styles.modalSaveText}>Save Opening Cash</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Cash Out Modal */}
      <Modal visible={showCashOutModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, maxHeight: '85%' }]}>
            <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{editingCashOut ? '✏️ Edit Cash Out' : '➖ Cash Out Entry'}</Text>
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Amount *</Text>
              <TextInput 
                style={[styles.modalInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} 
                placeholder="0.00" 
                keyboardType="numeric" 
                value={cashOutAmount} 
                onChangeText={setCashOutAmount} 
              />
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Reason *</Text>
              <TextInput 
                style={[styles.modalInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} 
                placeholder="e.g., Supplier payment, Staff advance" 
                value={cashOutReason} 
                onChangeText={setCashOutReason} 
                multiline 
                numberOfLines={3} 
              />
              <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Paid To (Optional)</Text>
              <TextInput 
                style={[styles.modalInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} 
                placeholder="Recipient name" 
                value={cashOutRecipient} 
                onChangeText={setCashOutRecipient} 
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: theme.border }]} onPress={() => { setShowCashOutModal(false); setEditingCashOut(null); }}>
                  <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: theme.danger }]} onPress={saveCashOutToDatabase} disabled={processing}>
                  <Text style={styles.modalSaveText}>{editingCashOut ? 'Update' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Physical Cash Modal */}
      <Modal visible={showPhysicalCashModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card, maxHeight: '90%' }]}>
            <ScrollView>
              <Text style={[styles.modalTitle, { color: theme.text }]}>🔍 End of Day Cash Count</Text>
              {renderDenominationInput(physicalNotes, setPhysicalNotes, physicalCoins, setPhysicalCoins, 'Count All Cash')}
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: theme.border }]} onPress={() => setShowPhysicalCashModal(false)}>
                  <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]} onPress={savePhysicalCashToDatabase} disabled={processing}>
                  <Text style={styles.modalSaveText}>Verify & Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Email Modal */}
      <Modal visible={showEmailModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>📧 Send Report</Text>
            <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Email Address</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              placeholder="Enter email address"
              value={emailAddress}
              onChangeText={setEmailAddress}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus={true}
            />
            <Text style={[styles.infoText, { color: theme.textSecondary, marginTop: 10 }]}>
              📎 PDF & Excel reports will be attached
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalCancelBtn, { borderColor: theme.border }]} 
                onPress={() => {
                  setShowEmailModal(false);
                  setEmailAddress('');
                }}
              >
                <Text style={[styles.modalCancelText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]} 
                onPress={handleEmailReport}
                disabled={sendingEmail}
              >
                {sendingEmail ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>Send Now</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

// ============ STYLES ============
const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  settledBadge: { backgroundColor: '#28a745', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  settledBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  content: { padding: 16, paddingBottom: 40 },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 20 },
  dateText: { fontSize: 16, fontWeight: '500' },
  summaryGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  summaryLabel: { fontSize: 11, marginBottom: 4 },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  netCard: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  netLabel: { fontSize: 12, color: '#fff', marginBottom: 6 },
  netValue: { fontSize: 28, fontWeight: '800', color: '#fff' },
  section: { padding: 14, borderRadius: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  cashRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  manualRow: { marginLeft: 10 },
  closingRow: { marginTop: 6, paddingTop: 8, borderTopWidth: 2, borderTopColor: '#000' },
  varianceRow: { marginTop: 6, paddingTop: 8, borderTopWidth: 2 },
  cashLabel: { fontSize: 13 },
  cashValue: { fontSize: 14, fontWeight: '600' },
  savedIcon: { color: '#28a745', fontSize: 14, marginLeft: 8 },
  cashOutActions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  smallBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 8, borderRadius: 8 },
  smallBtnText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, minWidth: '45%', padding: 12, borderRadius: 10, alignItems: 'center', gap: 5 },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 3 },
  endDayBtn: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  endDayBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 0 },
  modalContent: { width: '100%', maxWidth: '100%', borderRadius: 0, padding: 20, maxHeight: '100%' },
  processingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  processingContainer: { padding: 30, borderRadius: 20, alignItems: 'center', minWidth: 200, elevation: 5 },
  processingText: { fontSize: 16, fontWeight: '600' },
  processingSubText: { fontSize: 12, marginTop: 5 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  modalLabel: { fontSize: 13, marginBottom: 4, marginTop: 8 },
  modalInput: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 14, marginBottom: 8, minHeight: 42 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalSaveBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  denomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  denomLabel: { fontSize: 13, width: 45 },
  denomInput: { borderWidth: 1, borderRadius: 8, padding: 6, width: 70, textAlign: 'center' },
  denomTotal: { fontSize: 13, width: 90, textAlign: 'right' },
  infoText: { fontSize: 12, textAlign: 'center', marginBottom: 15 },
});

export default SettlementReport;