// backend/routes/settlementRoutes.js - FIXED VERSION

const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// 1️⃣ CHECK IF DAY IS SETTLED
// ============================================
router.get('/check', authenticateToken, async (req, res) => {
  try {
    let { outletId, date } = req.query;
    
    // ✅ FIX: Convert to integer
    outletId = parseInt(outletId);
    if (isNaN(outletId)) {
      return res.status(400).json({ error: 'Invalid outletId' });
    }
    
    console.log('📡 Check settlement:', { outletId, date });
    
    const pool = await getPool();
    const result = await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, date)
      .query(`SELECT Id, Status FROM settlement WHERE OutletId = @outletId AND SettlementDate = @settlementDate`);
    
    res.json({ 
      success: true, 
      settled: result.recordset.length > 0 && result.recordset[0]?.Status === 'COMPLETED',
      settlementId: result.recordset[0]?.Id || null
    });
  } catch (err) {
    console.error('Check error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 2️⃣ GET OPENING CASH
// ============================================
router.get('/opening-cash', authenticateToken, async (req, res) => {
  try {
    let { outletId, date } = req.query;
    
    // ✅ FIX: Convert to integer
    outletId = parseInt(outletId);
    if (isNaN(outletId)) {
      return res.status(400).json({ error: 'Invalid outletId' });
    }
    
    const pool = await getPool();
    const result = await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, date)
      .query(`SELECT OpeningCashJSON, OpeningCashTotal FROM settlement WHERE OutletId = @outletId AND SettlementDate = @settlementDate`);
    
    if (result.recordset.length === 0 || !result.recordset[0]?.OpeningCashJSON) {
      return res.json({ success: true, data: null });
    }
    
    const data = JSON.parse(result.recordset[0].OpeningCashJSON);
    res.json({ 
      success: true, 
      data: { 
        notes: data.notes || {}, 
        coins: data.coins || {}, 
        total: result.recordset[0].OpeningCashTotal || 0
      } 
    });
  } catch (err) {
    console.error('Get opening cash error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 3️⃣ SAVE OPENING CASH
// ============================================
router.post('/opening-cash', authenticateToken, async (req, res) => {
  try {
    let { outletId, settlementDate, notes, coins, total, cashierName } = req.body;
    
    // ✅ FIX: Convert to integer
    outletId = parseInt(outletId);
    if (isNaN(outletId)) {
      return res.status(400).json({ error: 'Invalid outletId' });
    }
    
    const openingCashJSON = JSON.stringify({ notes, coins });
    const pool = await getPool();
    
    await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, settlementDate)
      .input('openingCashJSON', sql.NVarChar, openingCashJSON)
      .input('openingCashTotal', sql.Decimal(10,2), total || 0)
      .input('cashierName', sql.NVarChar, cashierName || '')
      .query(`
        MERGE settlement AS target
        USING (SELECT @outletId as OutletId, @settlementDate as SettlementDate) AS source
        ON (target.OutletId = source.OutletId AND target.SettlementDate = source.SettlementDate)
        WHEN MATCHED THEN
          UPDATE SET OpeningCashJSON = @openingCashJSON, OpeningCashTotal = @openingCashTotal, CashierName = @cashierName, UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (OutletId, SettlementDate, CashierName, OpeningCashJSON, OpeningCashTotal, CreatedAt)
          VALUES (@outletId, @settlementDate, @cashierName, @openingCashJSON, @openingCashTotal, GETDATE());
      `);
    
    res.json({ success: true, message: 'Opening cash saved' });
  } catch (err) {
    console.error('Save opening cash error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 4️⃣ GET CASH OUTS
// ============================================
router.get('/cash-out', authenticateToken, async (req, res) => {
  try {
    let { outletId, date } = req.query;
    
    // ✅ FIX: Convert to integer
    outletId = parseInt(outletId);
    if (isNaN(outletId)) {
      return res.status(400).json({ error: 'Invalid outletId' });
    }
    
    const pool = await getPool();
    const result = await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, date)
      .query(`SELECT CashOutJSON, CashOutTotal FROM settlement WHERE OutletId = @outletId AND SettlementDate = @settlementDate`);
    
    if (result.recordset.length === 0 || !result.recordset[0]?.CashOutJSON) {
      return res.json({ success: true, data: [], total: 0 });
    }
    
    res.json({ 
      success: true, 
      data: JSON.parse(result.recordset[0].CashOutJSON), 
      total: result.recordset[0].CashOutTotal || 0
    });
  } catch (err) {
    console.error('Get cash out error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 5️⃣ SAVE CASH OUT
// ============================================
router.post('/cash-out', authenticateToken, async (req, res) => {
  try {
    let { outletId, settlementDate, amount, reason, recipient, cashierName } = req.body;
    
    // ✅ FIX: Convert to integer
    outletId = parseInt(outletId);
    if (isNaN(outletId)) {
      return res.status(400).json({ error: 'Invalid outletId' });
    }
    
    const pool = await getPool();
    
    // Get existing
    const existing = await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, settlementDate)
      .query(`SELECT CashOutJSON, CashOutTotal FROM settlement WHERE OutletId = @outletId AND SettlementDate = @settlementDate`);
    
    let cashOuts = [];
    let cashOutTotal = 0;
    
    if (existing.recordset.length > 0 && existing.recordset[0]?.CashOutJSON) {
      cashOuts = JSON.parse(existing.recordset[0].CashOutJSON);
      cashOutTotal = existing.recordset[0].CashOutTotal || 0;
    }
    
    // Add new
    const newId = Date.now();
    cashOuts.push({ id: newId, amount: parseFloat(amount), reason, recipient: recipient || '', date: new Date().toISOString() });
    cashOutTotal += parseFloat(amount);
    const cashOutJSON = JSON.stringify(cashOuts);
    
    await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, settlementDate)
      .input('cashOutJSON', sql.NVarChar, cashOutJSON)
      .input('cashOutTotal', sql.Decimal(10,2), cashOutTotal)
      .input('cashierName', sql.NVarChar, cashierName || '')
      .query(`
        MERGE settlement AS target
        USING (SELECT @outletId as OutletId, @settlementDate as SettlementDate) AS source
        ON (target.OutletId = source.OutletId AND target.SettlementDate = source.SettlementDate)
        WHEN MATCHED THEN
          UPDATE SET CashOutJSON = @cashOutJSON, CashOutTotal = @cashOutTotal, CashierName = @cashierName, UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (OutletId, SettlementDate, CashierName, CashOutJSON, CashOutTotal, CreatedAt)
          VALUES (@outletId, @settlementDate, @cashierName, @cashOutJSON, @cashOutTotal, GETDATE());
      `);
    
    res.json({ success: true, data: cashOuts, total: cashOutTotal });
  } catch (err) {
    console.error('Save cash out error:', err);
    res.status(500).json({ error: err.message });
  }
});
// ============================================
// 6️⃣ UPDATE CASH OUT (EDIT)
// ============================================
router.put('/cash-out/:id', authenticateToken, async (req, res) => {
  try {
    let { outletId, date } = req.query;
    const { id } = req.params;
    const { amount, reason, recipient } = req.body;
    
    // ✅ FIX: Convert to integer
    outletId = parseInt(outletId);
    if (isNaN(outletId)) {
      return res.status(400).json({ error: 'Invalid outletId' });
    }
    
    const pool = await getPool();
    
    // Get existing cash outs
    const existing = await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, date)
      .query(`SELECT CashOutJSON, CashOutTotal FROM settlement WHERE OutletId = @outletId AND SettlementDate = @settlementDate`);
    
    if (existing.recordset.length === 0 || !existing.recordset[0]?.CashOutJSON) {
      return res.status(404).json({ error: 'Settlement not found' });
    }
    
    let cashOuts = JSON.parse(existing.recordset[0].CashOutJSON);
    let found = false;
    let oldAmount = 0;
    
    cashOuts = cashOuts.map(item => {
      if (item.id.toString() === id) {
        found = true;
        oldAmount = item.amount;
        return { 
          ...item, 
          amount: parseFloat(amount), 
          reason: reason || item.reason,
          recipient: recipient || item.recipient 
        };
      }
      return item;
    });
    
    if (!found) {
      return res.status(404).json({ error: 'Cash out entry not found' });
    }
    
    // Recalculate total
    const cashOutTotal = cashOuts.reduce((sum, item) => sum + item.amount, 0);
    const cashOutJSON = JSON.stringify(cashOuts);
    
    await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, date)
      .input('cashOutJSON', sql.NVarChar, cashOutJSON)
      .input('cashOutTotal', sql.Decimal(10,2), cashOutTotal)
      .query(`
        UPDATE settlement 
        SET CashOutJSON = @cashOutJSON, CashOutTotal = @cashOutTotal, UpdatedAt = GETDATE()
        WHERE OutletId = @outletId AND SettlementDate = @settlementDate
      `);
    
    res.json({ success: true, message: 'Cash out updated successfully' });
  } catch (err) {
    console.error('Update cash out error:', err);
    res.status(500).json({ error: err.message });
  }
});
// ============================================
// 6️⃣ DELETE CASH OUT
// ============================================
router.delete('/cash-out/:id', authenticateToken, async (req, res) => {
  try {
    let { outletId, date } = req.query;
    const { id } = req.params;
    
    // ✅ FIX: Convert to integer
    outletId = parseInt(outletId);
    if (isNaN(outletId)) {
      return res.status(400).json({ error: 'Invalid outletId' });
    }
    
    const pool = await getPool();
    
    const existing = await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, date)
      .query(`SELECT CashOutJSON, CashOutTotal FROM settlement WHERE OutletId = @outletId AND SettlementDate = @settlementDate`);
    
    if (existing.recordset.length === 0 || !existing.recordset[0]?.CashOutJSON) {
      return res.json({ success: true });
    }
    
    let cashOuts = JSON.parse(existing.recordset[0].CashOutJSON);
    cashOuts = cashOuts.filter(item => item.id.toString() !== id);
    const cashOutTotal = cashOuts.reduce((sum, item) => sum + item.amount, 0);
    const cashOutJSON = JSON.stringify(cashOuts);
    
    await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, date)
      .input('cashOutJSON', sql.NVarChar, cashOutJSON)
      .input('cashOutTotal', sql.Decimal(10,2), cashOutTotal)
      .query(`UPDATE settlement SET CashOutJSON = @cashOutJSON, CashOutTotal = @cashOutTotal, UpdatedAt = GETDATE() WHERE OutletId = @outletId AND SettlementDate = @settlementDate`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete cash out error:', err);
    res.status(500).json({ error: err.message });
  }
});
// ============================================
// 10️⃣ GET SALES DATA FOR SETTLEMENT
// ============================================
router.get('/sales-data', authenticateToken, async (req, res) => {
    try {
        let { outletId, date } = req.query;
        
        outletId = parseInt(outletId);
        if (isNaN(outletId)) {
            return res.status(400).json({ error: 'Invalid outletId' });
        }
        
        console.log('📡 Getting sales data for settlement:', { outletId, date });
        
        const pool = await getPool();
        
        // ✅ Get sales for the date
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('startDate', sql.DateTime, startDate)
            .input('endDate', sql.DateTime, endDate)
            .query(`
                SELECT 
                    COUNT(*) as totalSales,
                    ISNULL(SUM(Total), 0) as totalRevenue,
                    ISNULL(SUM(DiscountAmount), 0) as totalDiscount,
                    -- ✅ Void sales
                    ISNULL(SUM(CASE WHEN Status = 'VOIDED' THEN Total ELSE 0 END), 0) as voidAmount,
                    -- ✅ Payment breakdown
                    ISNULL(SUM(CASE WHEN PaymentMethod = 'Cash' THEN Total ELSE 0 END), 0) as cashAmount,
                    ISNULL(SUM(CASE WHEN PaymentMethod = 'Card' THEN Total ELSE 0 END), 0) as cardAmount,
                    ISNULL(SUM(CASE WHEN PaymentMethod = 'UPI' THEN Total ELSE 0 END), 0) as upiAmount,
                    ISNULL(SUM(CASE WHEN PaymentMethod = 'PayNow' THEN Total ELSE 0 END), 0) as paynowAmount,
                    ISNULL(SUM(ValueCardAmount), 0) as valueCardAmount,
                    -- ✅ Net sales (after discount)
                    ISNULL(SUM(Total - ISNULL(DiscountAmount, 0)), 0) as netSales
                FROM Sales 
                WHERE OutletId = @outletId 
                  AND SaleDate >= @startDate AND SaleDate <= @endDate
                  AND (Status IS NULL OR Status != 'VOIDED')
            `);
        
        const data = result.recordset[0] || {
            totalSales: 0,
            totalRevenue: 0,
            totalDiscount: 0,
            voidAmount: 0,
            cashAmount: 0,
            cardAmount: 0,
            upiAmount: 0,
            paynowAmount: 0,
            valueCardAmount: 0,
            netSales: 0
        };
        
        console.log('✅ Settlement sales data:', data);
        
        res.json({
            success: true,
            data: {
                totalSales: data.totalSales || 0,
                totalRevenue: data.totalRevenue || 0,
                totalDiscount: data.totalDiscount || 0,
                voidAmount: data.voidAmount || 0,
                netSales: data.netSales || 0,
                paymentBreakdown: {
                    cash: data.cashAmount || 0,
                    card: data.cardAmount || 0,
                    upi: data.upiAmount || 0,
                    paynow: data.paynowAmount || 0,
                    valueCard: data.valueCardAmount || 0
                }
            }
        });
        
    } catch (err) {
        console.error('❌ Error getting sales data:', err);
        res.status(500).json({ error: err.message });
    }
});
// ============================================
// 7️⃣ GET PHYSICAL CASH
// ============================================
router.get('/physical-cash', authenticateToken, async (req, res) => {
  try {
    let { outletId, date } = req.query;
    
    // ✅ FIX: Convert to integer
    outletId = parseInt(outletId);
    if (isNaN(outletId)) {
      return res.status(400).json({ error: 'Invalid outletId' });
    }
    
    const pool = await getPool();
    const result = await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, date)
      .query(`SELECT PhysicalCashJSON, PhysicalCashTotal FROM settlement WHERE OutletId = @outletId AND SettlementDate = @settlementDate`);
    
    if (result.recordset.length === 0 || !result.recordset[0]?.PhysicalCashJSON) {
      return res.json({ success: true, data: null });
    }
    
    const data = JSON.parse(result.recordset[0].PhysicalCashJSON);
    res.json({ 
      success: true, 
      data: { 
        notes: data.notes || {}, 
        coins: data.coins || {}, 
        total: result.recordset[0].PhysicalCashTotal || 0
      } 
    });
  } catch (err) {
    console.error('Get physical cash error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 8️⃣ SAVE PHYSICAL CASH
// ============================================
router.post('/physical-cash', authenticateToken, async (req, res) => {
  try {
    let { outletId, settlementDate, notes, coins, total } = req.body;
    
    // ✅ FIX: Convert to integer
    outletId = parseInt(outletId);
    if (isNaN(outletId)) {
      return res.status(400).json({ error: 'Invalid outletId' });
    }
    
    const physicalCashJSON = JSON.stringify({ notes, coins });
    const pool = await getPool();
    
    await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, settlementDate)
      .input('physicalCashJSON', sql.NVarChar, physicalCashJSON)
      .input('physicalCashTotal', sql.Decimal(10,2), total || 0)
      .query(`
        MERGE settlement AS target
        USING (SELECT @outletId as OutletId, @settlementDate as SettlementDate) AS source
        ON (target.OutletId = source.OutletId AND target.SettlementDate = source.SettlementDate)
        WHEN MATCHED THEN
          UPDATE SET PhysicalCashJSON = @physicalCashJSON, PhysicalCashTotal = @physicalCashTotal, UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (OutletId, SettlementDate, PhysicalCashJSON, PhysicalCashTotal, CreatedAt)
          VALUES (@outletId, @settlementDate, @physicalCashJSON, @physicalCashTotal, GETDATE());
      `);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Save physical cash error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// 9️⃣ FINALIZE SETTLEMENT
// ============================================
router.post('/finalize', authenticateToken, async (req, res) => {
  try {
    let { outletId, settlementDate, cashierName, totalSales, totalDiscount, voidAmount, netSales,
            cashReceived, openingCash, manualCashOutTotal, expectedClosing, physicalCash,
            variance, varianceStatus, cashAmount, cardAmount, upiAmount, paynowAmount, valueCardAmount } = req.body;
    
    // ✅ FIX: Convert to integer
    outletId = parseInt(outletId);
    if (isNaN(outletId)) {
      return res.status(400).json({ error: 'Invalid outletId' });
    }
    
    const paymentBreakdownJSON = JSON.stringify({ 
      cash: cashAmount || 0, card: cardAmount || 0, upi: upiAmount || 0, 
      paynow: paynowAmount || 0, valuecard: valueCardAmount || 0 
    });
    
    const pool = await getPool();
    
    // Check if already settled
    const checkResult = await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, settlementDate)
      .query(`SELECT Id FROM settlement WHERE OutletId = @outletId AND SettlementDate = @settlementDate AND Status = 'COMPLETED'`);
    
    if (checkResult.recordset.length > 0) {
      return res.status(400).json({ error: 'Day already settled' });
    }
    
    await pool.request()
      .input('outletId', sql.Int, outletId)
      .input('settlementDate', sql.Date, settlementDate)
      .input('cashierName', sql.NVarChar, cashierName || '')
      .input('totalSales', sql.Decimal(10,2), totalSales || 0)
      .input('totalDiscount', sql.Decimal(10,2), totalDiscount || 0)
      .input('voidAmount', sql.Decimal(10,2), voidAmount || 0)
      .input('netSales', sql.Decimal(10,2), netSales || 0)
      .input('cashReceived', sql.Decimal(10,2), cashReceived || 0)
      .input('expectedClosing', sql.Decimal(10,2), expectedClosing || 0)
      .input('cashVariance', sql.Decimal(10,2), variance || 0)
      .input('varianceStatus', sql.NVarChar, varianceStatus || 'BALANCED')
      .input('paymentBreakdownJSON', sql.NVarChar, paymentBreakdownJSON)
      .input('status', sql.NVarChar, 'COMPLETED')
      .input('settledBy', sql.Int, req.user.id)
      .query(`
        UPDATE settlement 
        SET TotalSales = @totalSales,
            TotalDiscount = @totalDiscount,
            VoidAmount = @voidAmount,
            NetSales = @netSales,
            CashReceived = @cashReceived,
            ExpectedClosingCash = @expectedClosing,
            CashVariance = @cashVariance,
            VarianceStatus = @varianceStatus,
            PaymentBreakdownJSON = @paymentBreakdownJSON,
            Status = @status,
            SettledBy = @settledBy,
            SettledAt = GETDATE(),
            UpdatedAt = GETDATE()
        WHERE OutletId = @outletId AND SettlementDate = @settlementDate
      `);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error finalizing:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;