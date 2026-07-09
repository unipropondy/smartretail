const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const dayEndController = require('../controllers/dayEndController');

// ✅ Middleware to get outlet ID - FIXED
const getEffectiveOutletId = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        let outletId = null;
        
        console.log(`🔍 Getting outlet for ${userRole} ${userId}`);
        
        if (userRole === 'staff') {
            // ✅ Use async getPool()
            const { getPool, sql } = require('../config/db');
            const pool = await getPool();  // ✅ AWAIT
            
            if (!pool) {
                return res.status(500).json({ error: 'Database not connected' });
            }
            
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .query('SELECT OutletId FROM Users WHERE Id = @userId');
            
            if (result.recordset.length > 0 && result.recordset[0].OutletId) {
                outletId = result.recordset[0].OutletId;
                req.outletId = outletId;
                console.log(`👤 Staff ${userId} using outlet ${outletId}`);
            } else {
                return res.status(403).json({ error: 'Staff not assigned to any outlet' });
            }
        } 
        else if (userRole === 'owner') {
            outletId = req.headers['x-outlet-id'] || req.query.outletId;
            
            if (!outletId) {
                return res.status(400).json({ error: 'OUTLET_REQUIRED', message: 'Please select an outlet' });
            }
            
            outletId = parseInt(outletId);
            req.outletId = outletId;
            
            // ✅ Use async getPool()
            const { getPool, sql } = require('../config/db');
            const pool = await getPool();  // ✅ AWAIT
            
            if (!pool) {
                return res.status(500).json({ error: 'Database not connected' });
            }
            
            const result = await pool.request()
                .input('outletId', sql.Int, outletId)
                .input('ownerId', sql.Int, userId)
                .query('SELECT Id FROM Outlets WHERE Id = @outletId AND OwnerId = @ownerId');
            
            if (result.recordset.length === 0) {
                return res.status(403).json({ error: 'Access denied to this outlet' });
            }
            
            console.log(`👑 Owner ${userId} using outlet ${outletId}`);
        } 
        else if (userRole === 'admin') {
            outletId = req.query.outletId;
            if (!outletId) {
                return res.status(400).json({ error: 'Outlet ID required for admin' });
            }
            req.outletId = parseInt(outletId);
            console.log(`👑 Admin using outlet ${outletId}`);
        }
        
        if (!req.outletId) {
            return res.status(400).json({ error: 'Outlet ID required' });
        }
        
        next();
        
    } catch (err) {
        console.error('❌ Outlet middleware error:', err);
        res.status(500).json({ error: err.message });
    }
};

// ✅ Apply middleware
router.use(authenticateToken);
router.use(getEffectiveOutletId);

// ✅ Routes
router.get('/status', dayEndController.getDayEndStatus);
router.post('/end', dayEndController.performDayEnd);
router.get('/history', dayEndController.getDayEndHistory);
router.post('/start-new-day', dayEndController.startNewDay);

module.exports = router;