require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const DatabaseManager = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database
const db = new DatabaseManager(process.env.DB_FILE || './iot_data.db');

// Store latest sensor values in memory for quick access
let latestData = {
    temperature: null,
    humidity: null,
    airQuality: null,
    lastUpdate: null
};

// Connect to MQTT Broker
const mqttClient = mqtt.connect(process.env.MQTT_BROKER, {
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || ''
});

mqttClient.on('connect', () => {
    console.log('✅ Connected to MQTT Broker');
    
    // Subscribe to all sensor topics
    mqttClient.subscribe(process.env.TOPIC_TEMPERATURE, (err) => {
        if (!err) console.log(`📡 Subscribed to ${process.env.TOPIC_TEMPERATURE}`);
    });
    
    mqttClient.subscribe(process.env.TOPIC_HUMIDITY, (err) => {
        if (!err) console.log(`📡 Subscribed to ${process.env.TOPIC_HUMIDITY}`);
    });
    
    mqttClient.subscribe(process.env.TOPIC_AIR_QUALITY, (err) => {
        if (!err) console.log(`📡 Subscribed to ${process.env.TOPIC_AIR_QUALITY}`);
    });
    
    mqttClient.subscribe(process.env.TOPIC_STATUS, (err) => {
        if (!err) console.log(`📡 Subscribed to ${process.env.TOPIC_STATUS}`);
    });
});

mqttClient.on('message', (topic, message) => {
    const value = message.toString();
    console.log(`📨 Received: ${topic} = ${value}`);
    
    // Update latest data based on topic
    if (topic === process.env.TOPIC_TEMPERATURE) {
        latestData.temperature = parseFloat(value);
    } else if (topic === process.env.TOPIC_HUMIDITY) {
        latestData.humidity = parseFloat(value);
    } else if (topic === process.env.TOPIC_AIR_QUALITY) {
        latestData.airQuality = parseFloat(value);
    } else if (topic === process.env.TOPIC_STATUS) {
        console.log(`ℹ️  Device Status: ${value}`);
    }
    
    latestData.lastUpdate = new Date();
    
    // Save to database when we have all three sensor values
    if (latestData.temperature !== null && 
        latestData.humidity !== null && 
        latestData.airQuality !== null) {
        
        db.insertSensorData(
            latestData.temperature,
            latestData.humidity,
            latestData.airQuality
        ).then(() => {
            console.log('💾 Data saved to database');
        }).catch((error) => {
            console.error('❌ Database error:', error);
        });
    }
});

mqttClient.on('error', (error) => {
    console.error('❌ MQTT Error:', error);
});

// ==================== REST API ENDPOINTS ====================

// Get latest sensor data
app.get('/api/latest', async (req, res) => {
    try {
        const dbData = await db.getLatestData();
        res.json({
            success: true,
            data: dbData || latestData,
            realtime: latestData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get recent sensor data (last N records)
app.get('/api/recent/:limit?', async (req, res) => {
    try {
        const limit = parseInt(req.params.limit) || 100;
        const data = await db.getRecentData(limit);
        res.json({
            success: true,
            count: data.length,
            data: data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get statistics for last N hours
app.get('/api/statistics/:hours?', async (req, res) => {
    try {
        const hours = parseInt(req.params.hours) || 24;
        const stats = await db.getStatistics(hours);
        res.json({
            success: true,
            period: `${hours} hours`,
            statistics: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get data by time range
app.get('/api/range', async (req, res) => {
    try {
        const { start, end } = req.query;
        
        if (!start || !end) {
            return res.status(400).json({
                success: false,
                error: 'Please provide start and end parameters'
            });
        }
        
        const data = await db.getDataByTimeRange(start, end);
        res.json({
            success: true,
            count: data.length,
            data: data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete old data
app.delete('/api/cleanup/:days?', async (req, res) => {
    try {
        const days = parseInt(req.params.days) || 30;
        const deleted = await db.deleteOldData(days);
        res.json({
            success: true,
            message: `Deleted ${deleted} records older than ${days} days`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'running',
        mqtt: mqttClient.connected ? 'connected' : 'disconnected',
        uptime: process.uptime()
    });
});

// Serve frontend (optional - if you want to serve from same server)
app.use(express.static('../frontend'));

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 IoT Backend Server running on http://localhost:${PORT}`);
    console.log(`📊 API Base URL: http://localhost:${PORT}/api`);
    console.log(`\nAvailable endpoints:`);
    console.log(`  GET  /api/latest          - Get latest sensor data`);
    console.log(`  GET  /api/recent/:limit   - Get recent N records`);
    console.log(`  GET  /api/statistics/:hours - Get statistics`);
    console.log(`  GET  /api/range?start=&end= - Get data by time range`);
    console.log(`  GET  /api/health          - Server health check`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    mqttClient.end();
    db.close();
    process.exit(0);
});
