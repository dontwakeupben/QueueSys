/**
 * Live Show Flat Queue System - Backend Server
 * 
 * Real-time queue management with:
 * - Round-Robin across Agencies
 * - FIFO within Agency
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const apiRoutes = require('./src/routes/api');
const { setupSocketHandlers } = require('./src/socket/handlers');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// Store io instance on app for route access
app.set('io', io);

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', apiRoutes);

// Setup Socket handlers
setupSocketHandlers(io);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   🏢 Live Show Flat Queue System - Backend Server');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   📡 HTTP Server:  http://localhost:${PORT}`);
    console.log(`   🔌 Socket.io:    ws://localhost:${PORT}`);
    console.log(`   📊 Dashboard:    http://localhost:${PORT}/api/dashboard`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Closing server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
});
