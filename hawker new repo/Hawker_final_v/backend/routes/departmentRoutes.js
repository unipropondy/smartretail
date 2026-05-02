const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

// ============================================
// MIDDLEWARE - Get effective OUTLET ID
// ============================================
const getEffectiveOutletId = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        if (userRole === 'staff') {
            const pool = getPool();
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query('SELECT OutletId FROM Users WHERE Id = @userId');
            
            if (result.recordset.length > 0 && result.recordset[0].OutletId) {
                req.outletId = result.recordset[0].OutletId;
            } else {
                return res.status(403).json({ error: 'Staff not assigned to any outlet' });
            }
        }
        else if (userRole === 'owner') {
            const outletId = req.headers['x-outlet-id'] || req.query.outletId;
            if (!outletId) {
                return res.status(400).json({ error: 'OUTLET_REQUIRED', message: 'Please select an outlet' });
            }
            
            const pool = getPool();
            const result = await pool.request()
                .input('outletId', sql.Int, outletId)
                .input('ownerId', sql.Int, userId)
                .query('SELECT Id FROM Outlets WHERE Id = @outletId AND OwnerId = @ownerId');
            
            if (result.recordset.length === 0) {
                return res.status(403).json({ error: 'Access denied to this outlet' });
            }
            
            req.outletId = parseInt(outletId);
        }
        else if (userRole === 'admin') {
            req.outletId = req.query.outletId ? parseInt(req.query.outletId) : null;
        }
        
        if (!req.outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        next();
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
};

// Apply middleware to all routes
router.use(authenticateToken);
router.use(getEffectiveOutletId);

// ============================================
// GET all departments
// ============================================
router.get('/', async (req, res) => {
    try {
        const outletId = req.outletId;
        console.log('📡 Fetching departments for outlet:', outletId); // ✅ Add log
        
        const pool = getPool();
        
        const result = await pool.request()
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT Id, Name, IsActive, DisplayOrder, OutletId
                FROM Departments
                WHERE OutletId = @outletId
                ORDER BY DisplayOrder, Name
            `);
        
        console.log('📦 Departments found:', result.recordset.length); // ✅ Add log
        res.json(result.recordset);
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});
// ============================================
// CREATE department
// ============================================
router.post('/', async (req, res) => {
    try {
        const { name, active, displayOrder } = req.body;
        const outletId = req.outletId;
        
        const pool = getPool();
        
        let order = displayOrder;
        if (order === undefined) {
            const maxOrder = await pool.request()
                .input('outletId', sql.Int, outletId)
                .query('SELECT ISNULL(MAX(DisplayOrder), -1) + 1 as NextOrder FROM Departments WHERE OutletId = @outletId');
            order = maxOrder.recordset[0].NextOrder;
        }
        
        const result = await pool.request()
            .input('name', sql.NVarChar, name)
            .input('isActive', sql.Bit, active !== undefined ? active : true)
            .input('outletId', sql.Int, outletId)
            .input('displayOrder', sql.Int, order)
            .query(`
                INSERT INTO Departments (Name, IsActive, OutletId, DisplayOrder)
                OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.IsActive, INSERTED.DisplayOrder
                VALUES (@name, @isActive, @outletId, @displayOrder)
            `);
        
        res.status(201).json(result.recordset[0]);
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// UPDATE department
// ============================================
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, active, displayOrder } = req.body;
        const outletId = req.outletId;
        
        const pool = getPool();
        
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name)
            .input('isActive', sql.Bit, active)
            .input('displayOrder', sql.Int, displayOrder)
            .input('outletId', sql.Int, outletId)
            .query(`
                UPDATE Departments
                SET Name = @name, IsActive = @isActive, DisplayOrder = @displayOrder
                WHERE Id = @id AND OutletId = @outletId
                
                SELECT Id, Name, IsActive, DisplayOrder
                FROM Departments
                WHERE Id = @id
            `);
        
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }
        
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// DELETE department
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const outletId = req.outletId;
        
        const pool = getPool();
        
        // First, move all categories under this department to NULL
        await pool.request()
            .input('departmentId', sql.Int, id)
            .input('outletId', sql.Int, outletId)
            .query(`
                UPDATE DishGroup
                SET DepartmentId = NULL
                WHERE DepartmentId = @departmentId AND OutletId = @outletId
            `);
        
        // Then delete the department
        const result = await pool.request()
            .input('id', sql.Int, id)
            .input('outletId', sql.Int, outletId)
            .query('DELETE FROM Departments WHERE Id = @id AND OutletId = @outletId');
        
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Department not found' });
        }
        
        res.json({ message: 'Department deleted successfully' });
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// UPDATE department order (drag & drop)
// ============================================
router.post('/update-order', async (req, res) => {
    try {
        const { departments } = req.body;
        const outletId = req.outletId;
        
        const pool = getPool();
        const transaction = pool.transaction();
        await transaction.begin();
        
        try {
            for (const dept of departments) {
                await transaction.request()
                    .input('id', sql.Int, dept.id)
                    .input('order', sql.Int, dept.order)
                    .input('outletId', sql.Int, outletId)
                    .query(`
                        UPDATE Departments
                        SET DisplayOrder = @order
                        WHERE Id = @id AND OutletId = @outletId
                    `);
            }
            await transaction.commit();
            res.json({ success: true });
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// GET categories by department
// ============================================
router.get('/:departmentId/categories', async (req, res) => {
    try {
        const { departmentId } = req.params;
        const outletId = req.outletId;
        
        const pool = getPool();
        
        const result = await pool.request()
            .input('departmentId', sql.Int, departmentId)
            .input('outletId', sql.Int, outletId)
            .query(`
                SELECT 
                    Id, Name, ItemCount, IsActive, DisplayOrder
                FROM DishGroup
                WHERE DepartmentId = @departmentId AND OutletId = @outletId
                ORDER BY DisplayOrder, Name
            `);
        
        res.json(result.recordset);
    } catch (err) {
        console.error('❌ Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;