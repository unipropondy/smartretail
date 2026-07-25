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
        let outletId = null;

        if (userRole === 'staff') {
            const pool = await getPool();
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query('SELECT OutletId FROM Users WHERE Id = @userId');

            if (result.recordset.length > 0 && result.recordset[0].OutletId) {
                outletId = result.recordset[0].OutletId;
            } else {
                return res.status(403).json({ error: 'Staff not assigned to any outlet' });
            }
        }
        else if (userRole === 'owner') {
            outletId = req.headers['x-outlet-id'] || req.query.outletId;
            if (!outletId) {
                return res.status(400).json({ error: 'OUTLET_REQUIRED', message: 'Please select an outlet' });
            }

            const pool = await getPool();
            const result = await pool.request()
                .input('outletId', sql.Int, outletId)
                .input('ownerId', sql.Int, userId)
                .query('SELECT Id FROM Outlets WHERE Id = @outletId AND OwnerId = @ownerId');

            if (result.recordset.length === 0) {
                return res.status(403).json({ error: 'Access denied to this outlet' });
            }
            outletId = parseInt(outletId);
        }
        else if (userRole === 'admin') {
            outletId = req.query.outletId;
            if (!outletId) {
                return res.status(400).json({ error: 'Outlet ID required' });
            }
            outletId = parseInt(outletId);
        }

        if (!outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }

        req.outletId = outletId;
        next();
    } catch (err) {
        console.error('❌ Error getting effective outlet ID:', err);
        res.status(500).json({ error: err.message });
    }
};

// Ensure Tables Exist
const ensureTableExists = async () => {
    try {
        const pool = await getPool();
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Staff' AND xtype='U')
            BEGIN
                CREATE TABLE Staff (
                    Id INT IDENTITY(1,1) PRIMARY KEY,
                    Name NVARCHAR(255) NOT NULL,
                    OutletId INT NOT NULL,
                    IsActive BIT DEFAULT 1,
                    CreatedAt DATETIME DEFAULT GETDATE()
                );
            END

            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='StaffSettings' AND xtype='U')
            BEGIN
                CREATE TABLE StaffSettings (
                    OutletId INT PRIMARY KEY,
                    IsStaffMandatory BIT DEFAULT 0
                );
            END
        `);
        console.log('✅ Staff & StaffSettings tables verified/created in database');
    } catch (err) {
        console.error('❌ Failed to verify/create Staff tables:', err);
    }
};

// Initialize Table Check
ensureTableExists();

// Apply Authentication Middlewares
router.use(authenticateToken);
router.use(getEffectiveOutletId);

// ============================================
// GET all active staff members
// ============================================
router.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('outletId', sql.Int, req.outletId)
            .query('SELECT Id, Name, IsActive FROM Staff WHERE OutletId = @outletId AND IsActive = 1 ORDER BY Name');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ADD a new staff member
// ============================================
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Staff name is required' });
        }

        const pool = await getPool();
        const result = await pool.request()
            .input('name', sql.NVarChar, name.trim())
            .input('outletId', sql.Int, req.outletId)
            .query('INSERT INTO Staff (Name, OutletId, IsActive) OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.IsActive VALUES (@name, @outletId, 1)');

        res.status(201).json(result.recordset[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// DELETE a staff member
// ============================================
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, id)
            .input('outletId', sql.Int, req.outletId)
            .query('DELETE FROM Staff WHERE Id = @id AND OutletId = @outletId');

        res.json({ success: true, message: 'Staff member deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// GET staff settings (Mandatory Toggle)
// ============================================
router.get('/settings/info', async (req, res) => {
    try {
        const pool = await getPool();
        
        // Ensure settings record exists for this outlet
        await pool.request()
            .input('outletId', sql.Int, req.outletId)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM StaffSettings WHERE OutletId = @outletId)
                BEGIN
                    INSERT INTO StaffSettings (OutletId, IsStaffMandatory) VALUES (@outletId, 0);
                END
            `);

        const result = await pool.request()
            .input('outletId', sql.Int, req.outletId)
            .query('SELECT IsStaffMandatory FROM StaffSettings WHERE OutletId = @outletId');

        const isMandatory = result.recordset.length > 0 ? (result.recordset[0].IsStaffMandatory === true || result.recordset[0].IsStaffMandatory === 1) : false;
        res.json({ isStaffMandatory: isMandatory });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// UPDATE staff settings (Mandatory Toggle)
// ============================================
router.post('/settings/info', async (req, res) => {
    try {
        const { isStaffMandatory } = req.body;
        const pool = await getPool();

        await pool.request()
            .input('outletId', sql.Int, req.outletId)
            .input('isStaffMandatory', sql.Bit, isStaffMandatory ? 1 : 0)
            .query(`
                IF EXISTS (SELECT 1 FROM StaffSettings WHERE OutletId = @outletId)
                BEGIN
                    UPDATE StaffSettings SET IsStaffMandatory = @isStaffMandatory WHERE OutletId = @outletId;
                END
                ELSE
                BEGIN
                    INSERT INTO StaffSettings (OutletId, IsStaffMandatory) VALUES (@outletId, @isStaffMandatory);
                END
            `);

        res.json({ success: true, isStaffMandatory: !!isStaffMandatory });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
