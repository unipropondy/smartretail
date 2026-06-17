const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// Helper function to get outlet ID
const getOutletId = async (req) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    if (userRole === 'staff') {
        const pool = await getPool();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT OutletId FROM Users WHERE Id = @userId');
        return result.recordset[0]?.OutletId;
    }
    
    if (userRole === 'owner') {
        return req.headers['x-outlet-id'] || req.query.outletId;
    }
    
    if (userRole === 'admin') {
        return req.query.outletId;
    }
    
    return null;
};

// ========== MEMBER ROUTES ==========

// GET all members
router.get('/members', authenticateToken, async (req, res) => {
    try {
        const outletId = await getOutletId(req);
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const { search } = req.query;
        const pool = await getPool();
        
        let query = `
            SELECT 
                m.Id, m.Name, m.Mobile, m.Address, m.Email,
                m.JoinedDate, m.IsActive, 
                ISNULL(m.TotalSpent, 0) as TotalSpent,
                ISNULL(m.TotalVisits, 0) as TotalVisits,
                m.LastVisitDate,
                ISNULL((
                    SELECT TOP 1 Balance 
                    FROM ValueCards 
                    WHERE MemberId = m.Id AND Status = 'ACTIVE' 
                    ORDER BY Id DESC
                ), 0) as CurrentBalance
            FROM Members m
            WHERE m.OutletId = @outletId AND m.IsActive = 1
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);
        
        if (search) {
            query += ` AND (m.Name LIKE @search OR m.Mobile LIKE @search)`;
            request.input('search', sql.NVarChar, `%${search}%`);
        }
        
        query += ` ORDER BY m.Name`;
        
        const result = await request.query(query);
        res.json(result.recordset);
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// CREATE new member
router.post('/members', authenticateToken, async (req, res) => {
    try {
        const outletId = await getOutletId(req);
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const { name, mobile, address, email, notes } = req.body;
        
        if (!name || !mobile) {
            return res.status(400).json({ error: 'Name and mobile are required' });
        }
        
        // ✅ ADD MOBILE VALIDATION - Support 8 to 15 digits (Singapore, India, etc.)
        const mobileRegex = /^\d{8,15}$/;
        if (!mobileRegex.test(mobile)) {
            return res.status(400).json({ error: 'Please enter valid mobile number (8-15 digits)' });
        }
        
        const pool = await getPool();
        
        const existing = await pool.request()
            .input('mobile', sql.NVarChar, mobile)
            .input('outletId', sql.Int, outletId)
            .query('SELECT Id FROM Members WHERE Mobile = @mobile AND OutletId = @outletId');
        
        if (existing.recordset.length > 0) {
            return res.status(400).json({ error: 'Member with this mobile already exists' });
        }
        
        const result = await pool.request()
            .input('name', sql.NVarChar, name)
            .input('mobile', sql.NVarChar, mobile)
            .input('address', sql.NVarChar, address || '')
            .input('email', sql.NVarChar, email || '')
            .input('notes', sql.NVarChar, notes || '')
            .input('outletId', sql.Int, outletId)
            .input('createdBy', sql.Int, req.user.id)
            .query(`
                INSERT INTO Members (Name, Mobile, Address, Email, Notes, OutletId, CreatedBy)
                OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Mobile, INSERTED.Address, INSERTED.JoinedDate
                VALUES (@name, @mobile, @address, @email, @notes, @outletId, @createdBy)
            `);
        
        res.status(201).json({
            success: true,
            member: result.recordset[0],
            message: 'Member added successfully'
        });
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ========== VALUE CARD ROUTES ==========

// GET all value cards
router.get('/value-cards', authenticateToken, async (req, res) => {
    try {
        const outletId = await getOutletId(req);
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = await getPool();
        
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    vc.*,
                    m.Name as MemberName,
                    m.Mobile as MemberMobile
                FROM ValueCards vc
                JOIN Members m ON vc.MemberId = m.Id
                WHERE vc.OutletId = @outletId
                ORDER BY vc.Id DESC
            `);
        
        res.json(result.recordset);
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// CREATE value card
// CREATE value card - Balance = Service Value only
// CREATE value card with sequential number
// CREATE value card with PER OUTLET sequential number
// CREATE value card with sequential number - FIXED
// CREATE value card with DATE-based sequential number
router.post('/value-cards', authenticateToken, async (req, res) => {
    try {
        const outletId = await getOutletId(req);
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const { memberId, cardValue, serviceValue, notes } = req.body;
        
        if (!memberId) {
            return res.status(400).json({ error: 'Member ID required' });
        }
        
        const pool = await getPool();
        
        // Verify member belongs to outlet
        const memberCheck = await pool.request()
            .input('memberId', sql.Int, memberId)
            .input('outletId', sql.Int, outletId)
            .query('SELECT Id FROM Members WHERE Id = @memberId AND OutletId = @outletId');
        
        if (memberCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Member not found' });
        }
        
        // ✅ Generate date prefix (YYYYMMDD) based on Singapore time
        const now = new Date();
        // Convert to Singapore time (UTC+8)
        const singaporeTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        const year = singaporeTime.getUTCFullYear();
        const month = String(singaporeTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(singaporeTime.getUTCDate()).padStart(2, '0');
        const datePrefix = `${year}${month}${day}`;
        
        // ✅ Get today's max sequence number for this outlet
        const lastCardResult = await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('datePrefix', sql.NVarChar, `VC${datePrefix}-%`)
            .query(`
                SELECT TOP 1 CardNumber 
                FROM ValueCards 
                WHERE OutletId = @outletId 
                AND CardNumber LIKE @datePrefix
                ORDER BY CardNumber DESC
            `);
        
        let nextSequence = 1;
        if (lastCardResult.recordset.length > 0) {
            const lastCard = lastCardResult.recordset[0].CardNumber;
            // Extract sequence number after '-'
            const match = lastCard.match(/-(\d+)$/);
            if (match) {
                nextSequence = parseInt(match[1]) + 1;
            }
        }
        
        // Format as VC20260503-0001
        const cardNumber = `VC${datePrefix}-${nextSequence.toString().padStart(4, '0')}`;
        
        console.log('📇 Generated card number:', cardNumber);
        
        const cardVal = parseFloat(cardValue) || 0;
        const serviceVal = parseFloat(serviceValue) || 0;
        const balance = serviceVal;
        const totalValue = serviceVal;
        
        const result = await pool.request()
            .input('memberId', sql.Int, memberId)
            .input('outletId', sql.Int, outletId)
            .input('cardNumber', sql.NVarChar, cardNumber)
            .input('cardValue', sql.Decimal(10,2), cardVal)
            .input('serviceValue', sql.Decimal(10,2), serviceVal)
            .input('totalValue', sql.Decimal(10,2), totalValue)
            .input('balance', sql.Decimal(10,2), balance)
            .input('notes', sql.NVarChar, notes || '')
            .input('createdBy', sql.Int, req.user.id)
            .query(`
                INSERT INTO ValueCards (MemberId, OutletId, CardNumber, CardValue, ServiceValue, 
                                        TotalValue, Balance, Notes, CreatedBy)
                OUTPUT INSERTED.Id, INSERTED.CardNumber, INSERTED.CardValue, 
                       INSERTED.ServiceValue, INSERTED.TotalValue, INSERTED.Balance
                VALUES (@memberId, @outletId, @cardNumber, @cardValue, @serviceValue,
                        @totalValue, @balance, @notes, @createdBy)
            `);
        
        res.status(201).json({
            success: true,
            card: result.recordset[0],
            message: 'Value card created successfully'
        });
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
}); 
// ============================================
// USE VALUE CARD FOR PAYMENT
// ============================================
// POST /value-cards/use - FIXED
router.post('/value-cards/use', authenticateToken, async (req, res) => {
    try {
        const outletId = await getOutletId(req);
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const { cardNumber, amount, saleId, items, description } = req.body;
        
        if (!cardNumber || !amount || amount <= 0) {
            return res.status(400).json({ error: 'Card number and valid amount required' });
        }
        
        const pool = await getPool();
        
        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();
        
        try {
            // Get card details - USE @amount in query
            const cardResult = await transaction.request()
                .input('cardNumber', sql.NVarChar, cardNumber)
                .input('outletId', sql.Int, outletId)
                .input('amount', sql.Decimal(10,2), amount)  // ✅ ADD THIS LINE
                .query(`
                    SELECT vc.*, m.Name as MemberName, m.Mobile
                    FROM ValueCards vc
                    JOIN Members m ON vc.MemberId = m.Id
                    WHERE vc.CardNumber = @cardNumber 
                      AND vc.OutletId = @outletId 
                      AND vc.Status = 'ACTIVE'
                      AND vc.Balance >= @amount
                `);
            
            if (cardResult.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({ 
                    error: 'Active value card not found or insufficient balance',
                    cardNumber: cardNumber
                });
            }
            
            const card = cardResult.recordset[0];
            const balanceBefore = card.Balance;
            const balanceAfter = balanceBefore - amount;
            
            // Build items description
            let itemsDesc = '';
            if (items && items.length > 0) {
                itemsDesc = items.map(item => `${item.name} x${item.quantity}`).join(', ');
            }
            
            // Record transaction
            await transaction.request()
                .input('cardId', sql.Int, card.Id)
                .input('saleId', sql.Int, saleId || null)
                .input('outletId', sql.Int, outletId)
                .input('amount', sql.Decimal(10,2), amount)
                .input('transactionType', sql.NVarChar, 'PURCHASE')
                .input('description', sql.NVarChar, description || `Purchase of ₹${amount} - ${itemsDesc}`)
                .input('cashierId', sql.Int, req.user.id)
                .input('balanceBefore', sql.Decimal(10,2), balanceBefore)
                .input('balanceAfter', sql.Decimal(10,2), balanceAfter)
                .query(`
                    INSERT INTO ValueCardTransactions (
                        CardId, SaleId, OutletId, Amount, TransactionType,
                        Description, CashierId, BalanceBefore, BalanceAfter
                    )
                    VALUES (
                        @cardId, @saleId, @outletId, @amount, @transactionType,
                        @description, @cashierId, @balanceBefore, @balanceAfter
                    )
                `);
            
            // Update card balance
            await transaction.request()
                .input('cardId', sql.Int, card.Id)
                .input('balance', sql.Decimal(10,2), balanceAfter)
                .query('UPDATE ValueCards SET Balance = @balance WHERE Id = @cardId');
            
            // Update member total spent
            await transaction.request()
                .input('memberId', sql.Int, card.MemberId)
                .input('amount', sql.Decimal(10,2), amount)
                .query(`
                    UPDATE Members 
                    SET TotalSpent = ISNULL(TotalSpent, 0) + @amount,
                        TotalVisits = ISNULL(TotalVisits, 0) + 1,
                        LastVisitDate = GETDATE()
                    WHERE Id = @memberId
                `);
            
            await transaction.commit();
            
            res.json({
                success: true,
                message: `₹${amount} deducted from card`,
                data: {
                    cardId: card.Id,
                    cardNumber: card.CardNumber,
                    memberName: card.MemberName,
                    memberMobile: card.MemberMobile,
                    amountUsed: amount,
                    balanceBefore,
                    balanceAfter
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});
router.get('/value-cards/member/:cardNumber', authenticateToken, async (req, res) => {
    try {
        const outletId = await getOutletId(req);
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const { cardNumber } = req.params;
        const pool = await getPool();
        
        const result = await pool.request()
            .input('cardNumber', sql.NVarChar, cardNumber)
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    vc.Id, vc.CardNumber, vc.Balance, vc.CardValue, vc.ServiceValue,
                    m.Id as MemberId, m.Name as MemberName, m.Mobile as MemberMobile,
                    m.TotalSpent, m.TotalVisits
                FROM ValueCards vc
                JOIN Members m ON vc.MemberId = m.Id
                WHERE vc.CardNumber = @cardNumber 
                  AND vc.OutletId = @outletId 
                  AND vc.Status = 'ACTIVE'
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Card not found or inactive' });
        }
        
        res.json(result.recordset[0]);
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// TOP-UP VALUE CARD
// ============================================
router.post('/value-cards/topup', authenticateToken, async (req, res) => {
    try {
        const outletId = await getOutletId(req);
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const { cardId, topupAmount, notes } = req.body;
        
        if (!cardId || !topupAmount || topupAmount <= 0) {
            return res.status(400).json({ error: 'Card ID and valid topup amount required' });
        }
        
        const pool = await getPool();
        
        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();
        
        try {
            // Get current card
            const cardResult = await transaction.request()
                .input('cardId', sql.Int, cardId)
                .input('outletId', sql.Int, outletId)
                .query(`
                    SELECT vc.*, m.Name as MemberName
                    FROM ValueCards vc
                    JOIN Members m ON vc.MemberId = m.Id
                    WHERE vc.Id = @cardId AND vc.OutletId = @outletId AND vc.Status = 'ACTIVE'
                `);
            
            if (cardResult.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({ error: 'Active value card not found' });
            }
            
            const card = cardResult.recordset[0];
            const oldBalance = card.Balance;
            const newBalance = oldBalance + parseFloat(topupAmount);
            
            // Record transaction (TOPUP type)
            await transaction.request()
                .input('cardId', sql.Int, cardId)
                .input('outletId', sql.Int, outletId)
                .input('amount', sql.Decimal(10,2), topupAmount)
                .input('transactionType', sql.NVarChar, 'TOPUP')
                .input('description', sql.NVarChar, notes || `Top-up of ₹${topupAmount}`)
                .input('cashierId', sql.Int, req.user.id)
                .input('balanceBefore', sql.Decimal(10,2), oldBalance)
                .input('balanceAfter', sql.Decimal(10,2), newBalance)
                .query(`
                    INSERT INTO ValueCardTransactions (CardId, OutletId, Amount, TransactionType, 
                                                        Description, CashierId, BalanceBefore, BalanceAfter)
                    VALUES (@cardId, @outletId, @amount, @transactionType, 
                            @description, @cashierId, @balanceBefore, @balanceAfter)
                `);
            
            // Update card balance
            await transaction.request()
                .input('cardId', sql.Int, cardId)
                .input('balance', sql.Decimal(10,2), newBalance)
                .input('totalValue', sql.Decimal(10,2), newBalance)  // Update total value too
                .query(`
                    UPDATE ValueCards 
                    SET Balance = @balance, TotalValue = @totalValue
                    WHERE Id = @cardId
                `);
            
            await transaction.commit();
            
            res.json({
                success: true,
                message: `₹${topupAmount} added successfully`,
                data: {
                    cardId: card.Id,
                    cardNumber: card.CardNumber,
                    memberName: card.MemberName,
                    oldBalance,
                    topupAmount,
                    newBalance
                }
            });
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});
// GET value card transactions
router.get('/value-cards/:cardId/transactions', authenticateToken, async (req, res) => {
    try {
        const outletId = await getOutletId(req);
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const { cardId } = req.params;
        const pool = await getPool();
        
        const result = await pool.request()
            .input('cardId', sql.Int, cardId)
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    t.Id, 
                    t.Amount, 
                    t.TransactionType, 
                    t.Description,
                    t.TransactionDate, 
                    t.BalanceBefore, 
                    t.BalanceAfter,
                    t.CashierId, 
                    u.Username as CashierName,
                    s.InvoiceNumber, 
                    s.Total as SaleTotal,
                    s.ItemsJson  -- ✅ GET ITEMS JSON
                FROM ValueCardTransactions t
                LEFT JOIN Users u ON t.CashierId = u.Id
                LEFT JOIN Sales s ON t.SaleId = s.Id
                WHERE t.CardId = @cardId AND t.OutletId = @outletId
                ORDER BY t.TransactionDate DESC
            `);
        
        // ✅ Parse items from each transaction
        const formattedTransactions = result.recordset.map(trans => {
            let items = [];
            try {
                const saleData = JSON.parse(trans.ItemsJson || '{}');
                if (saleData.items && Array.isArray(saleData.items)) {
                    items = saleData.items;
                } else if (Array.isArray(saleData)) {
                    items = saleData;
                }
            } catch (e) {
                console.log('Parse error:', e);
            }
            
            return {
                Id: trans.Id,
                Amount: trans.Amount,
                TransactionType: trans.TransactionType,
                Description: trans.Description,
                TransactionDate: trans.TransactionDate,
                BalanceBefore: trans.BalanceBefore,
                BalanceAfter: trans.BalanceAfter,
                CashierName: trans.CashierName,
                InvoiceNumber: trans.InvoiceNumber,
                SaleTotal: trans.SaleTotal,
                Items: items  // ✅ ADD ITEMS LIST
            };
        });
        
        res.json(formattedTransactions);
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;