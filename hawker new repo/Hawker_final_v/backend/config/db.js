// backend/config/db.js - PRODUCTION VERSION with AUTO-RECONNECT
require('dotenv').config(); 
const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000,      // ✅ Reduced from 60s
    requestTimeout: 60000,
    cancelTimeout: 10000
  },
  pool: {
    max: 50,                    // ✅ Reduced from 100
    min: 5,                     // ✅ Reduced from 20
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 30000
  }
};

let pool = null;
let connecting = false;
let connectionPromise = null;
let monitoringInterval = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 20;

const poolConfig = config.pool;

let poolMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  idleConnections: 0,
  connectionWaitTime: 0,
  lastChecked: null
};

// ============================================
// MAIN CONNECT WITH AUTO-RECONNECT
// ============================================
const connectDB = async (isRetry = false) => {
    // If pool exists and is connected, return it
    if (pool && pool.connected !== false) {
        console.log('✅ Reusing existing connection pool');
        updatePoolMetrics();
        return pool;
    }
    
    if (connecting && connectionPromise) {
        console.log('⏳ Connection in progress, waiting...');
        return connectionPromise;
    }

    try {
        connecting = true;
        
        if (!isRetry) {
            console.log('🔄 Creating new connection pool...');
            reconnectAttempts = 0;
        } else {
            console.log(`🔄 Reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
        }
        
        console.log('📍 Server:', config.server);
        console.log('📍 Database:', config.database);
        
        connectionPromise = sql.connect(config);
        pool = await connectionPromise;
        
        // Mark as connected
        pool.connected = true;
        reconnectAttempts = 0;
        
        // Clear reconnect timer if any
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        
        console.log('✅ Connection pool created successfully');
        
        // Test connection
        const result = await pool.request().query('SELECT @@VERSION as version');
        console.log('📊 SQL Server Version:', result.recordset[0].version.substring(0, 50));
        
        startPoolMonitoring();
        
        // Handle pool errors
        pool.on('error', (err) => {
            console.error('❌ Pool error:', err.message);
            pool.connected = false;
            // Don't reset immediately, schedule reconnect
            scheduleReconnect();
        });
        
        return pool;
        
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
        resetPool();
        
        // Schedule reconnect if not retrying or within limits
        if (!isRetry || reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            scheduleReconnect();
        } else {
            console.error('❌ Max reconnection attempts reached. Manual restart required.');
        }
        
        throw err;
    } finally {
        connecting = false;
    }
};

// ============================================
// SCHEDULE RECONNECT
// ============================================
const scheduleReconnect = () => {
    if (reconnectTimer) {
        console.log('⚠️ Reconnect already scheduled');
        return;
    }
    
    const delay = Math.min(5000 * Math.pow(1.5, reconnectAttempts), 60000);
    console.log(`⏳ Scheduling reconnect in ${delay/1000} seconds (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
    
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        reconnectAttempts++;
        connectDB(true).catch(err => {
            console.error('Reconnect failed:', err.message);
        });
    }, delay);
};

// ============================================
// RESET POOL
// ============================================
const resetPool = () => {
    stopPoolMonitoring();
    
    if (pool) {
        try {
            if (pool.close) {
                pool.close().catch(e => console.log('Close error:', e.message));
            }
        } catch (e) {
            // Ignore
        }
        pool = null;
    }
    
    connecting = false;
    connectionPromise = null;
    console.log('🔄 Pool reset');
};

// ============================================
// UPDATE METRICS
// ============================================
const updatePoolMetrics = () => {
    if (pool && pool.connected !== false) {
        try {
            const internalPool = pool._pool || pool;
            poolMetrics = {
                totalConnections: internalPool.size || 0,
                activeConnections: (internalPool.size || 0) - (internalPool.available || 0),
                idleConnections: internalPool.available || 0,
                connectionWaitTime: internalPool.pending || 0,
                lastChecked: new Date().toISOString()
            };
        } catch (err) {
            // Silent fail
        }
    }
};

// ============================================
// MONITORING
// ============================================
const startPoolMonitoring = () => {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    
    console.log('📊 Starting pool monitoring (every 30s)');
    monitoringInterval = setInterval(() => {
        if (pool && pool.connected !== false) {
            updatePoolMetrics();
            
            console.log('📊 Pool Status:', {
                total: poolMetrics.totalConnections,
                active: poolMetrics.activeConnections,
                idle: poolMetrics.idleConnections,
                waiting: poolMetrics.connectionWaitTime,
                connected: true
            });

            if (poolMetrics.connectionWaitTime > 5) {
                console.warn('⚠️ High connection wait time:', poolMetrics.connectionWaitTime);
            }
            
            if (poolMetrics.activeConnections > poolConfig.max * 0.8) {
                console.warn('⚠️ Pool nearly full:', poolMetrics.activeConnections, '/', poolConfig.max);
            }
        } else {
            console.log('⚠️ Pool disconnected - waiting for reconnect');
        }
    }, 30000);
};

const stopPoolMonitoring = () => {
    if (monitoringInterval) {
        console.log('🛑 Stopping pool monitoring');
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
};

// ============================================
// GET POOL - AUTO-RECONNECT VERSION
// ============================================
const getPool = async () => {
    if (!pool || pool.connected === false) {
        console.log('⚠️ No active pool, attempting to connect...');
        await connectDB();
    }
    
    if (!pool || pool.connected === false) {
        throw new Error('Database not connected. Please check network.');
    }
    
    updatePoolMetrics();
    return pool;
};

// Sync version for backward compatibility
const getPoolSync = () => {
    if (!pool || pool.connected === false) {
        throw new Error('Database not connected. Call connectDB first.');
    }
    updatePoolMetrics();
    return pool;
};

const getPoolMetrics = () => {
    if (!pool) return { total: 0, active: 0, connected: false };
    return {
        total: poolMetrics.totalConnections,
        active: poolMetrics.activeConnections,
        idle: poolMetrics.idleConnections,
        waiting: poolMetrics.connectionWaitTime,
        connected: pool.connected !== false
    };
};

const testConnection = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            if (!pool || pool.connected === false) {
                await connectDB();
            }
            await pool.request().query('SELECT 1');
            return true;
        } catch (err) {
            console.log(`⚠️ Connection test failed (attempt ${i + 1}/${retries}):`, err.message);
            if (i === retries - 1) return false;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    return false;
};

const closePool = async () => {
    stopPoolMonitoring();
    
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    if (pool) {
        try {
            await pool.close();
            console.log('✅ Connection pool closed');
        } catch (err) {
            console.error('❌ Error closing pool:', err);
        }
        pool = null;
    }
};

// ============================================
// HEALTH CHECK
// ============================================
const checkHealth = async () => {
    try {
        if (!pool || pool.connected === false) {
            return { status: 'disconnected', timestamp: new Date().toISOString() };
        }
        await pool.request().query('SELECT 1');
        return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (err) {
        return { status: 'unhealthy', error: err.message, timestamp: new Date().toISOString() };
    }
};

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('📦 Received SIGINT, cleaning up...');
    stopPoolMonitoring();
    await closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('📦 Received SIGTERM, cleaning up...');
    stopPoolMonitoring();
    await closePool();
    process.exit(0);
});

module.exports = { 
    connectDB, 
    getPool,      // ✅ Use this (async) - will auto-reconnect
    getPoolSync,  // For backward compatibility
    sql, 
    testConnection,
    getPoolMetrics,
    closePool,
    checkHealth
};