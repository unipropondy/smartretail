// backend/controllers/salesController.js
const { getPool, sql } = require('../config/db');

// ============================================
// HELPER FUNCTION - Get effective OUTLET ID
// ============================================
const getEffectiveOutletId = async (req) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // For staff: get their outlet ID
    if (userRole === 'staff') {
        const pool = await getPool();
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT OutletId FROM Users WHERE Id = @userId');
        
        if (result.recordset.length > 0 && result.recordset[0].OutletId) {
            return result.recordset[0].OutletId;
        }
    }
    
    // For owner: get from body or query
    if (userRole === 'owner') {
        return req.body.outletId || req.query.outletId;
    }
    
    return null;
};
// ============================================
// CREATE sale (UPDATED)
// ============================================
const createSale = async (req, res) => {
    try {
        const { 
            total, 
            paymentMethod, 
            items, 
            cashPaid, 
            change,
            
            // ✅ NEW DISCOUNT FIELDS
            discountType,
            discountValue,
            discountAmount,
            originalTotal,
            
            // ✅✅✅ ADD VALUE CARD FIELD ✅✅✅
            valueCardUsed
        } = req.body;
        
        // ✅ Get outlet ID
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = await getPool();
        
        // ✅ GENERATE INVOICE NUMBER
        const invoiceNumber = await generateInvoiceNumber(pool, outletId);
        
        // Process items with value card info in JSON
        const itemsWithCategory = items.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            category: item.category || item.displayCategory || 'Uncategorized',
            displayCategory: item.displayCategory || item.category || 'Uncategorized',
            originalCategory: item.originalCategory || item.category
        }));
        
        // ✅✅✅ CREATE JSON WITH VALUE CARD INFO ✅✅✅
        const jsonData = {
            items: itemsWithCategory
        };
        
        // Add valueCardUsed if present
        if (valueCardUsed) {
            jsonData.valueCardUsed = {
                cardNumber: valueCardUsed.cardNumber,
                memberName: valueCardUsed.memberName,
                amount: valueCardUsed.amount
            };
            console.log(`💎 Value Card used: ${valueCardUsed.cardNumber} - ${valueCardUsed.memberName} - ₹${valueCardUsed.amount}`);
        }
        
        const itemsJson = JSON.stringify(jsonData);
        
        // ✅ Check if discount columns exist (for backward compatibility)
        const tableCheck = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME IN ('DiscountType', 'DiscountValue', 'DiscountAmount')
        `);
        
        const hasDiscountColumns = tableCheck.recordset.length >= 3;
        
        // ✅ Check if InvoiceNumber column exists
        const invoiceColumnCheck = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME = 'InvoiceNumber'
        `);
        
        const hasInvoiceColumn = invoiceColumnCheck.recordset.length > 0;
        
        let query = '';
        let request = pool.request()
            .input('total', sql.Decimal(10,2), total)
            .input('paymentMethod', sql.NVarChar, paymentMethod)
            .input('itemsJson', sql.NVarChar, itemsJson)
            .input('cashPaid', sql.Decimal(10,2), cashPaid || null)
            .input('changeAmount', sql.Decimal(10,2), change || null)
            .input('outletId', sql.Int, outletId);
        
        // ✅ Add invoice number if column exists
        if (hasInvoiceColumn) {
            request = request.input('invoiceNumber', sql.NVarChar, invoiceNumber);
        }
        
        if (hasDiscountColumns) {
            // ✅ With discount columns
            request = request
                .input('discountType', sql.NVarChar, discountType || null)
                .input('discountValue', sql.Decimal(10,2), discountValue || null)
                .input('discountAmount', sql.Decimal(10,2), discountAmount || null);
            
            if (hasInvoiceColumn) {
                query = `
                    INSERT INTO Sales (
                        Total, PaymentMethod, ItemsJson, 
                        CashPaid, ChangeAmount, OutletId,
                        DiscountType, DiscountValue, DiscountAmount,
                        InvoiceNumber, Status
                    )
                    OUTPUT INSERTED.Id, INSERTED.Total, INSERTED.PaymentMethod, 
                           INSERTED.SaleDate, INSERTED.DiscountType, 
                           INSERTED.DiscountValue, INSERTED.DiscountAmount,
                           INSERTED.InvoiceNumber
                    VALUES (
                        @total, @paymentMethod, @itemsJson,
                        @cashPaid, @changeAmount, @outletId,
                        @discountType, @discountValue, @discountAmount,
                        @invoiceNumber, 'COMPLETED'
                    )
                `;
            } else {
                query = `
                    INSERT INTO Sales (
                        Total, PaymentMethod, ItemsJson, 
                        CashPaid, ChangeAmount, OutletId,
                        DiscountType, DiscountValue, DiscountAmount,
                        Status
                    )
                    OUTPUT INSERTED.Id, INSERTED.Total, INSERTED.PaymentMethod, 
                           INSERTED.SaleDate, INSERTED.DiscountType, 
                           INSERTED.DiscountValue, INSERTED.DiscountAmount
                    VALUES (
                        @total, @paymentMethod, @itemsJson,
                        @cashPaid, @changeAmount, @outletId,
                        @discountType, @discountValue, @discountAmount,
                        'COMPLETED'
                    )
                `;
            }
        } else {
            // ✅ Without discount columns (fallback)
            if (hasInvoiceColumn) {
                query = `
                    INSERT INTO Sales (
                        Total, PaymentMethod, ItemsJson, 
                        CashPaid, ChangeAmount, OutletId,
                        InvoiceNumber, Status
                    )
                    OUTPUT INSERTED.Id, INSERTED.Total, INSERTED.PaymentMethod, 
                           INSERTED.SaleDate, INSERTED.InvoiceNumber
                    VALUES (
                        @total, @paymentMethod, @itemsJson,
                        @cashPaid, @changeAmount, @outletId,
                        @invoiceNumber, 'COMPLETED'
                    )
                `;
            } else {
                query = `
                    INSERT INTO Sales (
                        Total, PaymentMethod, ItemsJson, 
                        CashPaid, ChangeAmount, OutletId,
                        Status
                    )
                    OUTPUT INSERTED.Id, INSERTED.Total, INSERTED.PaymentMethod, INSERTED.SaleDate
                    VALUES (
                        @total, @paymentMethod, @itemsJson,
                        @cashPaid, @changeAmount, @outletId,
                        'COMPLETED'
                    )
                `;
            }
        }
        
        const result = await request.query(query);

        // ✅ Build response with discount info and value card info
        const newSale = {
            id: result.recordset[0].Id,
            total: result.recordset[0].Total,
            paymentMethod: result.recordset[0].PaymentMethod,
            date: result.recordset[0].SaleDate,
            items: itemsWithCategory
        };
        
        // ✅ Add invoice number if available
        if (hasInvoiceColumn && result.recordset[0].InvoiceNumber) {
            newSale.invoiceNumber = result.recordset[0].InvoiceNumber;
        } else {
            // Fallback invoice number
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            newSale.invoiceNumber = `${year}${month}${day}-${newSale.id}`;
        }
        
        // ✅ Add discount info if present
        if (hasDiscountColumns && discountAmount) {
            newSale.discount = {
                type: discountType,
                value: discountValue,
                amount: discountAmount
            };
            console.log(`💰 Discount applied: ${discountType === 'percentage' ? discountValue + '%' : '$' + discountValue} = $${discountAmount}`);
        }
        
        // ✅✅✅ Add value card info to response if present ✅✅✅
        if (valueCardUsed) {
            newSale.valueCard = {
                cardNumber: valueCardUsed.cardNumber,
                memberName: valueCardUsed.memberName,
                amount: valueCardUsed.amount
            };
            console.log(`💎 Value Card in response: ${valueCardUsed.cardNumber} - ₹${valueCardUsed.amount}`);
        }
        
        console.log(`✅ ${req.user.role} ${req.user.id} created sale for outlet ${outletId} - Invoice: ${newSale.invoiceNumber}${discountAmount ? ' with discount' : ''}${valueCardUsed ? ' with value card' : ''}`);
        res.status(201).json(newSale);
        
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
};
const voidSale = async (req, res) => {
    try {
        const { saleId, password, reason } = req.body;
        const outletId = req.outletId;
        const userId = req.user.id;
        
        if (!saleId || !password) {
            return res.status(400).json({ error: 'Sale ID and password required' });
        }
        
        const pool = await getPool();

        // 1️⃣ Get the sale with ItemsJson
        const saleResult = await pool.request()
            .input('saleId', sql.Int, saleId)
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT s.*, s.ItemsJson
                FROM Sales s
                WHERE s.Id = @saleId AND s.OutletId = @outletId
            `);
        
        if (saleResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Sale not found' });
        }
        
        const sale = saleResult.recordset[0];
        
        // 2️⃣ Check if already voided
        if (sale.Status === 'VOIDED') {
            return res.status(400).json({ error: 'Sale already voided' });
        }
        
        // 3️⃣ Get outlet's void password
        const outletResult = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    o.VoidPassword,
                    o.VoidPasswordEnabled,
                    o.OutletName
                FROM Outlets o
                WHERE o.Id = @outletId
            `);
        
        if (outletResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Outlet not found' });
        }
        
        const outlet = outletResult.recordset[0];
        
        // 4️⃣ Check if void password is enabled
        if (!outlet.VoidPasswordEnabled || !outlet.VoidPassword) {
            return res.status(403).json({ error: 'Void password not configured. Please contact owner.' });
        }
        
        // 5️⃣ Verify password
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, outlet.VoidPassword);
        
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid void password' });
        }
        
        // Start transaction
        const transaction = pool.transaction();
        await transaction.begin();
        
      try {
    // 6️⃣ Check for value card usage - FIXED
// 6️⃣ Check for value card usage - FIXED FOR ARRAY FORMAT
let valueCardNumber = null;
let valueCardAmount = 0;
let itemsList = [];

try {
    let itemsJsonData = sale.ItemsJson;
    let parsedData = null;
    
    console.log('🔍 ItemsJson type:', typeof itemsJsonData);
    console.log('🔍 Is array:', Array.isArray(itemsJsonData));
    
    // Handle different formats
    if (Array.isArray(itemsJsonData) && itemsJsonData.length > 0) {
        // It's an array of JSON strings - take the first valid one
        for (let i = 0; i < itemsJsonData.length; i++) {
            try {
                const itemStr = itemsJsonData[i];
                if (typeof itemStr === 'string') {
                    const parsed = JSON.parse(itemStr);
                    if (parsed && parsed.items) {
                        parsedData = parsed;
                        console.log('✅ Found valid JSON at index', i);
                        break;
                    }
                } else if (typeof itemStr === 'object') {
                    parsedData = itemStr;
                    console.log('✅ Found object at index', i);
                    break;
                }
            } catch(e) {}
        }
    } 
    else if (typeof itemsJsonData === 'object' && itemsJsonData !== null) {
        parsedData = itemsJsonData;
    }
    else if (typeof itemsJsonData === 'string') {
        parsedData = JSON.parse(itemsJsonData);
    }
    
    if (parsedData) {
        // Extract items
        if (parsedData.items && Array.isArray(parsedData.items)) {
            itemsList = parsedData.items;
        }
        
        // Extract value card
        if (parsedData.valueCardUsed && parsedData.valueCardUsed.amount) {
            valueCardNumber = parsedData.valueCardUsed.cardNumber;
            valueCardAmount = parseFloat(parsedData.valueCardUsed.amount);
        }
    }
    
    console.log('💰 Value card:', { valueCardNumber, valueCardAmount, itemsCount: itemsList.length });
    
} catch (e) {
    console.log('⚠️ Parse error:', e.message);
}
            
            // 7️⃣ Refund if value card was used
            let refundAmount = 0;
            if (valueCardNumber && valueCardAmount > 0) {
                const cardResult = await transaction.request()
                    .input('cardNumber', sql.NVarChar, valueCardNumber)
                    .input('outletId', sql.Int, outletId)
                    .query(`
                        SELECT vc.*, m.Name as MemberName
                        FROM ValueCards vc
                        JOIN Members m ON vc.MemberId = m.Id
                        WHERE vc.CardNumber = @cardNumber AND vc.OutletId = @outletId AND vc.Status = 'ACTIVE'
                    `);
                
                if (cardResult.recordset.length > 0) {
                    const card = cardResult.recordset[0];
                    const oldBalance = card.Balance;
                    const newBalance = oldBalance + valueCardAmount;
                    refundAmount = valueCardAmount;
                    
                    // Record REFUND transaction
                    await transaction.request()
                        .input('cardId', sql.Int, card.Id)
                        .input('saleId', sql.Int, saleId)
                        .input('outletId', sql.Int, outletId)
                        .input('amount', sql.Decimal(10,2), valueCardAmount)
                        .input('transactionType', sql.NVarChar, 'REFUND')
                        .input('description', sql.NVarChar, reason || `Refund for voided sale #${sale.InvoiceNumber || saleId}`)
                        .input('cashierId', sql.Int, userId)
                        .input('balanceBefore', sql.Decimal(10,2), oldBalance)
                        .input('balanceAfter', sql.Decimal(10,2), newBalance)
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
                        .input('balance', sql.Decimal(10,2), newBalance)
                        .query('UPDATE ValueCards SET Balance = @balance WHERE Id = @cardId');
                    
                    console.log(`✅ Refunded ₹${valueCardAmount} to card ${valueCardNumber}`);
                }
            }
            
            // 8️⃣ Void the sale
            await transaction.request()
                .input('saleId', sql.Int, saleId)
                .input('voidedBy', sql.Int, userId)
                .input('voidReason', sql.NVarChar, reason || 'Voided by user')
                .query(`
                    UPDATE Sales 
                    SET Status = 'VOIDED',
                        VoidedBy = @voidedBy,
                        VoidedAt = GETDATE(),
                        VoidReason = @voidReason
                    WHERE Id = @saleId
                `);
            
            await transaction.commit();
            
            console.log(`✅ Sale ${saleId} voided${refundAmount > 0 ? ` - Refunded ₹${refundAmount}` : ''}`);
            res.json({ 
                success: true, 
                message: refundAmount > 0 ? `Sale voided and ₹${refundAmount} refunded to value card` : 'Sale voided successfully',
                refundAmount
            });
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        
    } catch (err) {
        console.error('❌ Void error:', err);
        res.status(500).json({ error: err.message });
    }
};
// ============================================
// GET sales (UPDATED)
// ============================================
const getSales = async (req, res) => {
    try {
        const { filter, startDate, endDate, status } = req.query;
        
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = await getPool();

        // ✅ Check if discount columns exist
        const checkColumns = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME IN ('DiscountType', 'DiscountValue', 'DiscountAmount', 'InvoiceNumber')
        `);
        
        const hasDiscountColumns = checkColumns.recordset.some(c => ['DiscountType', 'DiscountValue', 'DiscountAmount'].includes(c.COLUMN_NAME));
        const hasInvoiceColumn = checkColumns.recordset.some(c => c.COLUMN_NAME === 'InvoiceNumber');
        
        // ✅ Check if void columns exist
        const checkVoidColumns = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME IN ('Status', 'VoidedBy', 'VoidedAt', 'VoidReason')
        `);
        
        const hasVoidColumns = checkVoidColumns.recordset.length >= 2;
        
        // ✅ Build query with all columns
        let query = `
            SELECT Id, Total, PaymentMethod, SaleDate, 
                   CAST(ItemsJson AS NVARCHAR(MAX)) as ItemsJson,
                   CashPaid, ChangeAmount
        `;
        
        // ✅ ADD INVOICE NUMBER
        if (hasInvoiceColumn) {
            query += `, InvoiceNumber`;
        } else {
            query += `, NULL as InvoiceNumber`;
        }
        
        // Add discount columns if they exist
        if (hasDiscountColumns) {
            query += `, DiscountType, DiscountValue, DiscountAmount`;
        }
        
        // Add void columns if they exist
        if (hasVoidColumns) {
            query += `, Status, VoidedBy, VoidedAt, VoidReason`;
        } else {
            query += `, 'COMPLETED' as Status, NULL as VoidedBy, NULL as VoidedAt, NULL as VoidReason`;
        }
        
        // ✅ ADD Value Card fields
        query += `
            , JSON_VALUE(ItemsJson, '$.valueCardUsed.cardNumber') as ValueCardNumber
            , JSON_VALUE(ItemsJson, '$.valueCardUsed.memberName') as ValueCardMember
            , CAST(JSON_VALUE(ItemsJson, '$.valueCardUsed.amount') AS DECIMAL(10,2)) as ValueCardAmount
        `;
        
        query += `
            FROM Sales WITH (NOLOCK) 
            WHERE OutletId = @outletId
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);

        // Filter by status
        if (status === 'voided') {
            query += ' AND Status = \'VOIDED\'';
        } else if (status === 'completed') {
            query += ' AND (Status IS NULL OR Status = \'COMPLETED\' OR Status != \'VOIDED\')';
        } else {
            if (hasVoidColumns) {
                query += ' AND (Status IS NULL OR Status != \'VOIDED\')';
            }
        }

        // Date filters
        if (filter === 'today') {
            query += ' AND CAST(SaleDate AS DATE) = CAST(GETDATE() AS DATE)';
        } 
        else if (filter === 'week') {
            query += ' AND SaleDate >= DATEADD(day, -7, GETDATE())';
        } 
        else if (filter === 'month') {
            query += ' AND SaleDate >= DATEADD(month, -1, GETDATE())';
        } 
        else if (filter === 'custom' && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            
            query += ' AND SaleDate >= @startDate AND SaleDate <= @endDate';
            request.input('startDate', sql.DateTime, start);
            request.input('endDate', sql.DateTime, end);
        }

        query += ' ORDER BY SaleDate DESC';
        
        const result = await request.query(query);
        
        // ✅ Parse JSON with proper format handling (new format with {items, valueCardUsed})
        const formattedSales = result.recordset.map(sale => {
            let items = [];
            let valueCardInfo = null;
            
            try {
                const parsed = JSON.parse(sale.ItemsJson || '{}');
                
                // Check if new format (has items array)
                if (parsed.items && Array.isArray(parsed.items)) {
                    items = parsed.items;
                    valueCardInfo = parsed.valueCardUsed || null;
                } 
                // Check if old format (array directly)
                else if (Array.isArray(parsed)) {
                    items = parsed;
                }
                // Empty or invalid
                else {
                    items = [];
                }
            } catch (e) {
                console.log('Error parsing ItemsJson for sale:', sale.Id, e.message);
                items = [];
            }
            let singaporeDate = sale.SaleDate;
        if (sale.SaleDate) {
            const dbDate = new Date(sale.SaleDate);
            // Subtract 8 hours (8 * 60 * 60 * 1000 = 28,800,000 ms)
            singaporeDate = new Date(dbDate.getTime() - (8 * 60 * 60 * 1000));
            console.log('📅 UTC DB:', dbDate.toISOString());
            console.log('📅 Singapore (UTC-8):', singaporeDate.toLocaleString());
        }
            // Use valueCard from parsed JSON if available, otherwise from SQL extraction
            if (!valueCardInfo && sale.ValueCardAmount && sale.ValueCardAmount > 0) {
                valueCardInfo = {
                    cardNumber: sale.ValueCardNumber,
                    memberName: sale.ValueCardMember,
                    amount: sale.ValueCardAmount
                };
            }
            
            const discount = (hasDiscountColumns && sale.DiscountAmount) ? {
                type: sale.DiscountType,
                value: sale.DiscountValue,
                amount: sale.DiscountAmount
            } : null;
            
            return {
                id: sale.Id,
                total: sale.Total,
                paymentMethod: sale.PaymentMethod,
                date: singaporeDate,
                invoiceNumber: sale.InvoiceNumber || '',
                items: items,
                cashPaid: sale.CashPaid,
                change: sale.ChangeAmount,
                discount: discount,
                status: sale.Status || 'COMPLETED',
                voidReason: sale.VoidReason,
                voidedAt: sale.VoidedAt,
                voidedBy: sale.VoidedBy,
                valueCard: valueCardInfo
            };
        });

        console.log(`✅ ${req.user.role} ${req.user.id} fetched ${formattedSales.length} sales (${status || 'completed'}) for outlet ${outletId}`);
        res.json(formattedSales);
        
    } catch (err) {
        console.error('Error getting sales:', err);
        res.status(500).json({ error: err.message });
    }
};
// ============================================
// GET sales summary with DISCOUNT (UPDATED)
// ============================================
const getSalesSummary = async (req, res) => {
    try {
        const { filter, startDate, endDate, status } = req.query;
        
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = await getPool();
        
        // ✅ Check if discount columns exist
        const checkColumns = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME IN ('DiscountType', 'DiscountValue', 'DiscountAmount')
        `);
        
        const hasDiscountColumns = checkColumns.recordset.length >= 3;
        
        // ✅ Check if Status column exists (for void support)
        const checkStatusColumn = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME = 'Status'
        `);
        
        const hasStatusColumn = checkStatusColumn.recordset.length > 0;
        
        // ✅ Build query with discount calculations and value card - FIXED JSON PARSING
        let query = `
            WITH SalesWithDetails AS (
                SELECT 
                    Id,
                    Total,
                    PaymentMethod,
                    -- ✅ Handle both old and new JSON formats
                    CASE 
                        -- Check if new format (has $.items)
                        WHEN ISJSON(ItemsJson) = 1 AND JSON_VALUE(ItemsJson, '$.items') IS NOT NULL
                        THEN (
                            SELECT ISNULL(SUM(TRY_CAST(JSON_VALUE(value, '$.quantity') AS INT)), 0)
                            FROM OPENJSON(ItemsJson, '$.items')
                        )
                        -- Old format (array directly)
                        ELSE (
                            SELECT ISNULL(SUM(TRY_CAST(JSON_VALUE(value, '$.quantity') AS INT)), 0)
                            FROM OPENJSON(ItemsJson)
                        )
                    END as ItemCount
        `;
        
        // Add discount fields if they exist
        if (hasDiscountColumns) {
            query += `,
                    DiscountAmount,
                    DiscountType,
                    DiscountValue,
                    CASE WHEN DiscountAmount > 0 THEN 1 ELSE 0 END as HasDiscount
            `;
        }
        
        // Add Status if exists
        if (hasStatusColumn) {
            query += `,
                    Status
            `;
        }
        
        // ✅ ADD Value Card fields - Handle both formats
        query += `
                , COALESCE(
                    CAST(JSON_VALUE(ItemsJson, '$.valueCardUsed.amount') AS DECIMAL(10,2)),
                    CAST(JSON_VALUE(ItemsJson, '$.valueCardUsed.amount') AS DECIMAL(10,2)),
                    0
                ) as ValueCardAmount
                , JSON_VALUE(ItemsJson, '$.valueCardUsed.cardNumber') as ValueCardNumber
                , JSON_VALUE(ItemsJson, '$.valueCardUsed.memberName') as ValueCardMember
        `;
        
        query += `
                FROM Sales WITH (NOLOCK)
                WHERE OutletId = @outletId
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);

        // ✅ FILTER BY STATUS (VOIDED or COMPLETED)
        if (hasStatusColumn) {
            if (status === 'voided') {
                query += ' AND Status = \'VOIDED\'';
            } else if (status === 'completed') {
                query += ' AND (Status IS NULL OR Status = \'COMPLETED\' OR Status != \'VOIDED\')';
            } else {
                query += ' AND (Status IS NULL OR Status != \'VOIDED\')';
            }
        }

        // Date filters
        if (filter === 'today') {
            query += ' AND CAST(SaleDate AS DATE) = CAST(GETDATE() AS DATE)';
        } 
        else if (filter === 'week') {
            query += ' AND SaleDate >= DATEADD(day, -7, GETDATE())';
        } 
        else if (filter === 'month') {
            query += ' AND SaleDate >= DATEADD(month, -1, GETDATE())';
        } 
        else if (filter === 'custom' && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            
            query += ' AND SaleDate >= @startDate AND SaleDate <= @endDate';
            request.input('startDate', sql.DateTime, start);
            request.input('endDate', sql.DateTime, end);
        }

        query += `
            )
            SELECT 
                COUNT(*) as totalSales,
                ISNULL(SUM(Total), 0) as totalRevenue,
                ISNULL(SUM(ItemCount), 0) as totalItems,
                PaymentMethod
        `;
        
        // Add discount aggregates if columns exist
        if (hasDiscountColumns) {
            query += `,
                ISNULL(SUM(DiscountAmount), 0) as totalDiscount,
                SUM(CASE WHEN DiscountAmount > 0 THEN 1 ELSE 0 END) as discountedSales
            `;
        } else {
            query += `,
                0 as totalDiscount,
                0 as discountedSales
            `;
        }
        
        // ✅ ADD Value Card aggregates
        query += `,
                ISNULL(SUM(ValueCardAmount), 0) as totalValueCardAmount,
                SUM(CASE WHEN ValueCardAmount > 0 THEN 1 ELSE 0 END) as valueCardTransactions
        `;
        
        query += `
            FROM SalesWithDetails
            GROUP BY PaymentMethod
        `;
        
        const result = await request.query(query);
        
        // Calculate totals
        let totalRevenue = 0;
        let totalItems = 0;
        let totalSales = 0;
        let totalDiscount = 0;
        let discountedSales = 0;
        let totalValueCardAmount = 0;
        let valueCardTransactions = 0;
        const paymentBreakdown = {};
        
        result.recordset.forEach(row => {
            totalRevenue += row.totalRevenue;
            totalItems += parseInt(row.totalItems || 0);
            totalSales += row.totalSales;
            totalDiscount += row.totalDiscount || 0;
            discountedSales += row.discountedSales || 0;
            totalValueCardAmount += row.totalValueCardAmount || 0;
            valueCardTransactions += row.valueCardTransactions || 0;
            paymentBreakdown[row.PaymentMethod] = row.totalRevenue;
        });

        // ✅ Add value card to payment breakdown
        if (totalValueCardAmount > 0) {
            paymentBreakdown['Value Card'] = totalValueCardAmount;
        }

        console.log(`✅ Summary for outlet ${outletId} (${status || 'completed'}):`, { 
            totalSales, 
            totalRevenue, 
            totalItems, 
            totalDiscount,
            discountedSales,
            discountPercent: totalSales > 0 ? ((discountedSales / totalSales) * 100).toFixed(1) : 0,
            totalValueCardAmount,
            valueCardTransactions
        });

        res.json({
            totalSales,
            totalRevenue,
            totalItems,
            totalDiscount,
            discountedSales,
            paymentBreakdown,
            totalValueCardAmount,
            valueCardTransactions
        });
        
    } catch (err) {
        console.error('❌ Error getting sales summary:', err);
        res.status(500).json({ error: err.message });
    }
};
// ============================================
// GET sales by category (UPDATED)
// ============================================
// ============================================
// GET sales by category with DISCOUNT (UPDATED)
// ============================================
const getSalesByCategory = async (req, res) => {
    try {
        const { filter, startDate, endDate, status } = req.query;
        
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = await getPool();
        
        // ✅ Check if invoice column exists
        const checkInvoiceColumn = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME = 'InvoiceNumber'
        `);
        
        const hasInvoiceColumn = checkInvoiceColumn.recordset.length > 0;
        
        // ✅ Check if discount columns exist
        const checkColumns = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME IN ('DiscountType', 'DiscountValue', 'DiscountAmount')
        `);
        
        const hasDiscountColumns = checkColumns.recordset.length >= 3;
        
        // ✅ Check if Status column exists
        const checkStatusColumn = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME = 'Status'
        `);
        
        const hasStatusColumn = checkStatusColumn.recordset.length > 0;
        
        // ✅ Build query - include InvoiceNumber
        let query = `
            SELECT Id, Total, CAST(ItemsJson AS NVARCHAR(MAX)) as ItemsJson, SaleDate
        `;
        
        if (hasInvoiceColumn) {
            query += `, InvoiceNumber`;
        }
        
        if (hasDiscountColumns) {
            query += `, DiscountType, DiscountValue, DiscountAmount`;
        }
        
        if (hasStatusColumn) {
            query += `, Status`;
        }
        
        // ✅ Add Value Card fields
        query += `
            , JSON_VALUE(ItemsJson, '$.valueCardUsed.cardNumber') as ValueCardNumber
            , JSON_VALUE(ItemsJson, '$.valueCardUsed.memberName') as ValueCardMember
            , CAST(JSON_VALUE(ItemsJson, '$.valueCardUsed.amount') AS DECIMAL(10,2)) as ValueCardAmount
        `;
        
        query += `
            FROM Sales WITH (NOLOCK) 
            WHERE OutletId = @outletId
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);

        // Filter by status
        if (hasStatusColumn) {
            if (status === 'voided') {
                query += ' AND Status = \'VOIDED\'';
            } else {
                query += ' AND (Status IS NULL OR Status = \'COMPLETED\' OR Status != \'VOIDED\')';
            }
        }

        // Date filters
        if (filter === 'today') {
            query += ' AND CAST(SaleDate AS DATE) = CAST(GETDATE() AS DATE)';
        } 
        else if (filter === 'week') {
            query += ' AND SaleDate >= DATEADD(day, -7, GETDATE())';
        } 
        else if (filter === 'month') {
            query += ' AND SaleDate >= DATEADD(month, -1, GETDATE())';
        } 
        else if (filter === 'custom' && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            
            query += ' AND SaleDate >= @startDate AND SaleDate <= @endDate';
            request.input('startDate', sql.DateTime, start);
            request.input('endDate', sql.DateTime, end);
        }

        const result = await request.query(query);
        
        // ✅ Process data - FIXED JSON PARSING
        const categoryMap = new Map();
        const transactionSet = new Set();
        let totalDiscountAmount = 0;
        let discountedTransactionCount = 0;
        let totalValueCardAmount = 0;
        let valueCardTransactionCount = 0;
        
        result.recordset.forEach(sale => {
            transactionSet.add(sale.Id);
            
            // Track discount
            if (hasDiscountColumns && sale.DiscountAmount && sale.DiscountAmount > 0) {
                totalDiscountAmount += sale.DiscountAmount;
                discountedTransactionCount++;
            }
            
            // Track Value Card
            if (sale.ValueCardAmount && sale.ValueCardAmount > 0) {
                totalValueCardAmount += parseFloat(sale.ValueCardAmount);
                valueCardTransactionCount++;
            }
            
            try {
                // ✅ FIXED: Parse ItemsJson properly - handle both formats
                let parsedData = null;
                try {
                    parsedData = JSON.parse(sale.ItemsJson || '{}');
                } catch (e) {
                    console.log('Parse error for sale:', sale.Id);
                    return;
                }
                
                // Extract items based on format
                let itemsList = [];
                if (parsedData.items && Array.isArray(parsedData.items)) {
                    // New format: { items: [...], valueCardUsed: {...} }
                    itemsList = parsedData.items;
                } else if (Array.isArray(parsedData)) {
                    // Old format: [...] directly
                    itemsList = parsedData;
                } else {
                    itemsList = [];
                }
                
                if (itemsList.length === 0) return;
                
                let totalFromItems = 0;
                itemsList.forEach(item => {
                    totalFromItems += (item.price || 0) * (item.quantity || 1);
                });
                
                const discountFactor = totalFromItems > 0 ? sale.Total / totalFromItems : 1;
                
                itemsList.forEach(item => {
                    const categoryName = item.displayCategory || item.category || item.originalCategory || 'Uncategorized';
                    const originalRevenue = (item.price || 0) * (item.quantity || 1);
                    const discountedRevenue = originalRevenue * discountFactor;
                    
                    if (!categoryMap.has(categoryName)) {
                        categoryMap.set(categoryName, {
                            name: categoryName,
                            totalRevenue: 0,
                            totalQuantity: 0,
                            items: new Map(),
                            transactions: new Map(),
                            discountAmount: 0,
                            discountedCount: 0,
                            valueCardAmount: 0
                        });
                    }
                    
                    const category = categoryMap.get(categoryName);
                    
                    category.totalRevenue += discountedRevenue;
                    category.totalQuantity += (item.quantity || 1);
                    
                    // Store transaction
                    if (!category.transactions.has(sale.Id)) {
                        category.transactions.set(sale.Id, {
                            id: sale.Id,
                            invoiceNumber: sale.InvoiceNumber || '',
                            date: sale.SaleDate,
                            total: sale.Total,
                            discount: hasDiscountColumns && sale.DiscountAmount ? {
                                type: sale.DiscountType,
                                value: sale.DiscountValue,
                                amount: sale.DiscountAmount
                            } : null,
                            valueCard: sale.ValueCardAmount ? {
                                cardNumber: sale.ValueCardNumber,
                                memberName: sale.ValueCardMember,
                                amount: sale.ValueCardAmount
                            } : null
                        });
                    }
                    
                    if (hasDiscountColumns && sale.DiscountAmount > 0) {
                        category.discountAmount += sale.DiscountAmount;
                        category.discountedCount++;
                    }
                    
                    if (sale.ValueCardAmount && sale.ValueCardAmount > 0) {
                        category.valueCardAmount += parseFloat(sale.ValueCardAmount);
                    }
                    
                    const itemName = item.name;
                    if (!category.items.has(itemName)) {
                        category.items.set(itemName, {
                            name: itemName,
                            quantity: 0,
                            revenue: 0,
                            price: item.price || 0,
                            transactions: new Set(),
                            discountAmount: 0,
                            discountedCount: 0,
                            valueCardAmount: 0
                        });
                    }
                    
                    const catItem = category.items.get(itemName);
                    catItem.revenue += discountedRevenue;
                    catItem.quantity += (item.quantity || 1);
                    catItem.transactions.add(sale.Id);
                    
                    if (hasDiscountColumns && sale.DiscountAmount > 0) {
                        catItem.discountAmount += sale.DiscountAmount;
                        catItem.discountedCount++;
                    }
                    
                    if (sale.ValueCardAmount && sale.ValueCardAmount > 0) {
                        catItem.valueCardAmount += parseFloat(sale.ValueCardAmount);
                    }
                });
                
            } catch (e) {
                console.log('Error parsing items for sale:', sale.Id, e.message);
            }
        });
        
        // Format response
        const formattedCategories = [];
        let totalRevenue = 0;
        let totalItems = 0;
        
        for (const [catName, catData] of categoryMap) {
            const itemsList = Array.from(catData.items.values()).map(item => ({
                name: item.name,
                quantity: item.quantity,
                revenue: Math.round(item.revenue * 100) / 100,
                price: item.price,
                transactionCount: item.transactions.size,
                discountAmount: item.discountAmount || 0,
                discountedCount: item.discountedCount || 0,
                valueCardAmount: item.valueCardAmount || 0
            })).sort((a, b) => b.revenue - a.revenue);
            
            const transactionsList = Array.from(catData.transactions.values()).map(trans => ({
                saleId: trans.id,
                invoiceNumber: trans.invoiceNumber,
                date: trans.date,
                total: trans.total,
                discount: trans.discount,
                valueCard: trans.valueCard
            })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            formattedCategories.push({
                name: catName,
                totalRevenue: Math.round(catData.totalRevenue * 100) / 100,
                totalQuantity: catData.totalQuantity,
                totalTransactions: catData.transactions.size,
                discountAmount: catData.discountAmount || 0,
                discountedCount: catData.discountedCount || 0,
                valueCardAmount: catData.valueCardAmount || 0,
                items: itemsList,
                transactions: transactionsList,
                itemCount: itemsList.length
            });
            
            totalRevenue += catData.totalRevenue;
            totalItems += catData.totalQuantity;
        }
        
        formattedCategories.sort((a, b) => b.totalRevenue - a.totalRevenue);
        
        console.log(`✅ Category summary for outlet ${outletId} (${status || 'completed'}):`, {
            totalCategories: formattedCategories.length,
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            totalTransactions: transactionSet.size,
            totalItems,
            totalDiscount: totalDiscountAmount,
            discountedTransactions: discountedTransactionCount,
            totalValueCardAmount,
            valueCardTransactionCount
        });
        
        res.json({
            success: true,
            summary: {
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalTransactions: transactionSet.size,
                totalCategories: formattedCategories.length,
                totalItems,
                totalDiscount: totalDiscountAmount,
                discountedTransactions: discountedTransactionCount,
                totalValueCardAmount,
                valueCardTransactionCount
            },
            categories: formattedCategories,
            dateRange: {
                filter,
                startDate: startDate || null,
                endDate: endDate || null,
                status: status || 'completed'
            }
        });
        
    } catch (err) {
        console.error('❌ Error in category sales:', err);
        res.status(500).json({ error: err.message });
    }
};
const generateInvoiceNumber = async (pool, outletId) => {
    try {
        // Get today's date in YYYYMMDD format (Singapore time)
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayPrefix = `${year}${month}${day}`;
        
        // Get the latest invoice number for today
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .input('datePrefix', sql.NVarChar, `${todayPrefix}%`)
            .query(`
                SELECT TOP 1 InvoiceNumber 
                FROM Sales 
                WHERE OutletId = @outletId 
                AND InvoiceNumber LIKE @datePrefix
                ORDER BY Id DESC
            `);
        
        let nextNumber = 1;
        
        if (result.recordset.length > 0 && result.recordset[0].InvoiceNumber) {
            // Extract the numeric part after '-'
            const lastNumber = parseInt(result.recordset[0].InvoiceNumber.split('-')[1]);
            nextNumber = lastNumber + 1;
        }
        
        // Format: YYYYMMDD-0001 (4 digits)
        const invoiceNumber = `${todayPrefix}-${String(nextNumber).padStart(4, '0')}`;
        
        console.log(`📄 Generated invoice number: ${invoiceNumber}`);
        return invoiceNumber;
        
    } catch (error) {
        console.error('❌ Error generating invoice number:', error);
        // Fallback: use timestamp
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayPrefix = `${year}${month}${day}`;
        return `${todayPrefix}-${Date.now()}`;
    }
};


// ============================================
// GET category items with DISCOUNT (UPDATED)
// ============================================
const getCategoryItems = async (req, res) => {
    try {
        const { category } = req.params;
        const { filter, startDate, endDate, status } = req.query;
        
        const outletId = req.outletId;
        
        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        const pool = await getPool();
        
        // ✅ Check if invoice column exists
        const checkInvoiceColumn = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME = 'InvoiceNumber'
        `);
        
        const hasInvoiceColumn = checkInvoiceColumn.recordset.length > 0;
        
        // ✅ Check if discount columns exist
        const checkColumns = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME IN ('DiscountType', 'DiscountValue', 'DiscountAmount')
        `);
        
        const hasDiscountColumns = checkColumns.recordset.length >= 3;
        
        // ✅ Check if Status column exists
        const checkStatusColumn = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'Sales' 
            AND COLUMN_NAME = 'Status'
        `);
        
        const hasStatusColumn = checkStatusColumn.recordset.length > 0;
        
        let query = `
            SELECT Id, SaleDate, CAST(ItemsJson AS NVARCHAR(MAX)) as ItemsJson 
        `;
        
        // ✅ ADD INVOICE NUMBER
        if (hasInvoiceColumn) {
            query += `, InvoiceNumber`;
        }
        
        if (hasDiscountColumns) {
            query += `, DiscountType, DiscountValue, DiscountAmount`;
        }
        
        if (hasStatusColumn) {
            query += `, Status`;
        }
        
        // ✅✅✅ ADD VALUE CARD FIELDS ✅✅✅
        query += `
            , JSON_VALUE(ItemsJson, '$.valueCardUsed.cardNumber') as ValueCardNumber
            , JSON_VALUE(ItemsJson, '$.valueCardUsed.memberName') as ValueCardMember
            , CAST(JSON_VALUE(ItemsJson, '$.valueCardUsed.amount') AS DECIMAL(10,2)) as ValueCardAmount
        `;
        
        query += `
            FROM Sales WITH (NOLOCK) 
            WHERE OutletId = @outletId
        `;
        
        const request = pool.request();
        request.input('outletId', sql.Int, outletId);

        // Filter by status
        if (hasStatusColumn) {
            if (status === 'voided') {
                query += ' AND Status = \'VOIDED\'';
            } else if (status === 'completed') {
                query += ' AND (Status IS NULL OR Status = \'COMPLETED\' OR Status != \'VOIDED\')';
            } else {
                query += ' AND (Status IS NULL OR Status != \'VOIDED\')';
            }
        }

        // Date filters
        if (filter === 'today') {
            query += ' AND CAST(SaleDate AS DATE) = CAST(GETDATE() AS DATE)';
        } 
        else if (filter === 'week') {
            query += ' AND SaleDate >= DATEADD(day, -7, GETDATE())';
        } 
        else if (filter === 'month') {
            query += ' AND SaleDate >= DATEADD(month, -1, GETDATE())';
        } 
        else if (filter === 'custom' && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            
            query += ' AND SaleDate >= @startDate AND SaleDate <= @endDate';
            request.input('startDate', sql.DateTime, start);
            request.input('endDate', sql.DateTime, end);
        }

        const result = await request.query(query);
        
        // Process items
        const itemMap = new Map();
        const transactions = [];
        let totalDiscountForCategory = 0;
        let discountedTransactionCount = 0;
        let totalValueCardForCategory = 0;
        let valueCardTransactionCount = 0;
        
        result.recordset.forEach(sale => {
            const hasDiscount = hasDiscountColumns && sale.DiscountAmount && sale.DiscountAmount > 0;
            const hasValueCard = sale.ValueCardAmount && sale.ValueCardAmount > 0;
            
            if (hasValueCard) {
                totalValueCardForCategory += parseFloat(sale.ValueCardAmount);
                valueCardTransactionCount++;
            }
            
            try {
                // ✅ Parse ItemsJson - handle both formats
                let parsedData = null;
                try {
                    parsedData = JSON.parse(sale.ItemsJson || '{}');
                } catch (e) {
                    console.log('Parse error for sale:', sale.Id);
                    return;
                }
                
                // Extract items based on format
                let itemsList = [];
                if (parsedData.items && Array.isArray(parsedData.items)) {
                    itemsList = parsedData.items;
                } else if (Array.isArray(parsedData)) {
                    itemsList = parsedData;
                } else {
                    itemsList = [];
                }
                
                if (itemsList.length === 0) return;
                
                itemsList.forEach(item => {
                    const itemCategory = item.displayCategory || item.category || item.originalCategory || 'Uncategorized';
                    
                    if (itemCategory === category) {
                        const itemName = item.name;
                        const quantity = item.quantity || 1;
                        const price = item.price || 0;
                        const revenue = price * quantity;
                        
                        if (!itemMap.has(itemName)) {
                            itemMap.set(itemName, {
                                name: itemName,
                                quantity: 0,
                                revenue: 0,
                                price: price,
                                transactions: new Set(),
                                discountAmount: 0,
                                discountedCount: 0,
                                valueCardAmount: 0,
                                status: sale.Status || 'COMPLETED'
                            });
                        }
                        
                        const catItem = itemMap.get(itemName);
                        catItem.quantity += quantity;
                        catItem.revenue += revenue;
                        catItem.transactions.add(sale.Id);
                        
                        if (hasDiscount) {
                            const discountPerItem = (sale.DiscountAmount * revenue) / sale.Total;
                            catItem.discountAmount += discountPerItem;
                            catItem.discountedCount++;
                            totalDiscountForCategory += discountPerItem;
                        }
                        
                        if (hasValueCard) {
                            const valueCardPerItem = (sale.ValueCardAmount * revenue) / sale.Total;
                            catItem.valueCardAmount += valueCardPerItem;
                        }
                        
                        // ✅ Add transaction with INVOICE NUMBER, DISCOUNT, AND VALUE CARD
                        transactions.push({
                            saleId: sale.Id,
                            invoiceNumber: sale.InvoiceNumber || '',
                            saleDate: sale.SaleDate,
                            name: itemName,
                            quantity: quantity,
                            price: price,
                            total: revenue,
                            status: sale.Status || 'COMPLETED',
                            discount: hasDiscount ? {
                                type: sale.DiscountType,
                                value: sale.DiscountValue,
                                amount: (sale.DiscountAmount * revenue) / sale.Total
                            } : null,
                            valueCard: hasValueCard ? {
                                cardNumber: sale.ValueCardNumber,
                                memberName: sale.ValueCardMember,
                                amount: (sale.ValueCardAmount * revenue) / sale.Total
                            } : null
                        });
                    }
                });
                
                if (hasDiscount) {
                    discountedTransactionCount++;
                }
                
            } catch (e) {
                console.log('Error parsing items for sale:', sale.Id, e.message);
            }
        });
        
        const itemsList = Array.from(itemMap.values())
            .map(item => ({
                ...item,
                transactionCount: item.transactions.size,
                discountAmount: item.discountAmount || 0,
                discountedCount: item.discountedCount || 0,
                valueCardAmount: item.valueCardAmount || 0
            }))
            .sort((a, b) => b.revenue - a.revenue);
        
        const totalRevenue = itemsList.reduce((sum, item) => sum + item.revenue, 0);
        const totalQuantity = itemsList.reduce((sum, item) => sum + item.quantity, 0);
        
        console.log(`✅ Category items for "${category}" (${status || 'completed'}):`, {
            totalRevenue,
            totalItems: itemsList.length,
            totalDiscount: totalDiscountForCategory,
            discountedTransactions: discountedTransactionCount,
            totalValueCard: totalValueCardForCategory,
            valueCardTransactions: valueCardTransactionCount
        });
        
        res.json({
            success: true,
            category,
            totalRevenue,
            totalQuantity,
            totalItems: itemsList.length,
            totalDiscount: totalDiscountForCategory,
            discountedTransactions: discountedTransactionCount,
            totalValueCardAmount: totalValueCardForCategory,
            valueCardTransactionCount: valueCardTransactionCount,
            items: itemsList,
            transactions: transactions.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
        });
        
    } catch (err) {
        console.error('❌ Error in category items:', err);
        res.status(500).json({ error: err.message });
    }
};
module.exports = {
    createSale,
    getSales,
    getSalesSummary,
    getSalesByCategory,
    getCategoryItems,
    voidSale
};