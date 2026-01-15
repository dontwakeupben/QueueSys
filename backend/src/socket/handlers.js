/**
 * Socket.io Handler
 * Manages real-time connections and events
 */

const agentService = require('../services/agentService');
const dashboardService = require('../services/dashboardService');

const DEFAULT_SHOWFLAT_ID = 'sf-001';

function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        console.log(`🔌 Socket connected: ${socket.id}`);

        // Agent identifies themselves
        socket.on('AGENT_IDENTIFY', async (data) => {
            try {
                const { agentId } = data;
                console.log(`👤 Agent ${agentId} identified on socket ${socket.id}`);

                // Store agent ID on socket for later reference
                socket.agentId = agentId;

                // Join a room for this agent
                socket.join(`agent:${agentId}`);

                // Update agent's socket ID in database
                const result = await agentService.joinQueue(agentId, socket.id);

                // Send confirmation
                socket.emit('AGENT_IDENTIFIED', {
                    success: true,
                    agent: result.agent,
                });

                // Broadcast queue update
                const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);
                io.emit('QUEUE_UPDATED', dashboardState);

            } catch (error) {
                console.error('Error in AGENT_IDENTIFY:', error);
                socket.emit('ERROR', { message: error.message });
            }
        });

        // Agent goes online (joins queue)
        socket.on('AGENT_JOIN', async (data) => {
            try {
                const agentId = data?.agentId || socket.agentId;
                if (!agentId) {
                    socket.emit('ERROR', { message: 'Agent ID not set' });
                    return;
                }

                const result = await agentService.joinQueue(agentId, socket.id);
                socket.agentId = agentId;

                socket.emit('AGENT_JOINED', {
                    success: true,
                    agent: result.agent,
                });

                // Broadcast queue update
                const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);
                io.emit('QUEUE_UPDATED', dashboardState);

            } catch (error) {
                console.error('Error in AGENT_JOIN:', error);
                socket.emit('ERROR', { message: error.message });
            }
        });

        // Agent goes offline (leaves queue)
        socket.on('AGENT_LEAVE', async (data) => {
            try {
                const agentId = data?.agentId || socket.agentId;
                if (!agentId) {
                    socket.emit('ERROR', { message: 'Agent ID not set' });
                    return;
                }

                const result = await agentService.leaveQueue(agentId);

                socket.emit('AGENT_LEFT', {
                    success: true,
                    agent: result.agent,
                });

                // Broadcast queue update
                const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);
                io.emit('QUEUE_UPDATED', dashboardState);

            } catch (error) {
                console.error('Error in AGENT_LEAVE:', error);
                socket.emit('ERROR', { message: error.message });
            }
        });

        // Request dashboard state
        socket.on('GET_DASHBOARD', async (data) => {
            try {
                const showFlatId = data?.showFlatId || DEFAULT_SHOWFLAT_ID;
                const dashboardState = await dashboardService.getDashboardState(showFlatId);
                socket.emit('DASHBOARD_STATE', dashboardState);
            } catch (error) {
                console.error('Error in GET_DASHBOARD:', error);
                socket.emit('ERROR', { message: error.message });
            }
        });

        // Request public display data
        socket.on('GET_PUBLIC_DISPLAY', async (data) => {
            try {
                const showFlatId = data?.showFlatId || DEFAULT_SHOWFLAT_ID;
                const publicData = await dashboardService.getPublicDisplayData(showFlatId);
                socket.emit('PUBLIC_DISPLAY_DATA', publicData);
            } catch (error) {
                console.error('Error in GET_PUBLIC_DISPLAY:', error);
                socket.emit('ERROR', { message: error.message });
            }
        });

        // Handle disconnect - remove agent from queue
        socket.on('disconnect', async () => {
            console.log(`🔌 Socket disconnected: ${socket.id}`);

            try {
                const result = await agentService.handleDisconnect(socket.id);

                if (result) {
                    console.log(`👤 Agent ${result.agent.name} removed from queue due to disconnect`);

                    // Broadcast queue update
                    const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);
                    io.emit('QUEUE_UPDATED', dashboardState);
                }
            } catch (error) {
                console.error('Error handling disconnect:', error);
            }
        });
    });
}

module.exports = { setupSocketHandlers };
