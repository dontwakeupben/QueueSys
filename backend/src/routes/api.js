/**
 * API Routes for Queue System
 */

const express = require('express');
const router = express.Router();

const agentService = require('../services/agentService');
const allocationService = require('../services/allocationService');
const dashboardService = require('../services/dashboardService');

// Default ShowFlat ID for demo purposes
const DEFAULT_SHOWFLAT_ID = 'sf-001';

/**
 * POST /api/agent/join
 * Agent goes online - adds to queue
 */
router.post('/agent/join', async (req, res) => {
    try {
        const { agentId, socketId } = req.body;

        if (!agentId) {
            return res.status(400).json({ error: 'agentId is required' });
        }

        const result = await agentService.joinQueue(agentId, socketId || null);

        // Emit queue update via socket (will be done in socket handler)
        const io = req.app.get('io');
        if (io) {
            const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);
            io.emit('QUEUE_UPDATED', dashboardState);
        }

        res.json({
            success: true,
            agent: result.agent,
            isNew: result.isNew,
            message: result.isNew ? 'Joined queue' : 'Already in queue',
        });
    } catch (error) {
        console.error('Error in /agent/join:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agent/leave
 * Agent goes offline - removes from queue
 */
router.post('/agent/leave', async (req, res) => {
    try {
        const { agentId } = req.body;

        if (!agentId) {
            return res.status(400).json({ error: 'agentId is required' });
        }

        const result = await agentService.leaveQueue(agentId);

        // Emit queue update
        const io = req.app.get('io');
        if (io) {
            const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);
            io.emit('QUEUE_UPDATED', dashboardState);
        }

        res.json({
            success: true,
            agent: result.agent,
            message: 'Left queue',
        });
    } catch (error) {
        console.error('Error in /agent/leave:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agent/accept
 * Agent accepts a walk-in assignment
 */
router.post('/agent/accept', async (req, res) => {
    try {
        const { walkInId, agentId } = req.body;

        if (!walkInId || !agentId) {
            return res.status(400).json({ error: 'walkInId and agentId are required' });
        }

        const result = await allocationService.acceptWalkIn(walkInId, agentId);

        // Emit events
        const io = req.app.get('io');
        if (io) {
            // Notify all clients that call was accepted
            io.emit('AGENT_ACCEPTED', {
                walkInId: result.walkIn.id,
                agent: {
                    id: result.agent.id,
                    name: result.agent.name,
                },
                agency: {
                    code: result.agency.code,
                    name: result.agency.name,
                },
            });

            // Update queue state
            const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);
            io.emit('QUEUE_UPDATED', dashboardState);

            // Update public display
            const publicData = await dashboardService.getPublicDisplayData(DEFAULT_SHOWFLAT_ID);
            io.emit('PUBLIC_DISPLAY_UPDATED', publicData);
        }

        res.json({
            success: true,
            walkIn: result.walkIn,
            agent: result.agent,
            agency: result.agency,
        });
    } catch (error) {
        console.error('Error in /agent/accept:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agent/decline
 * Agent explicitly declines a walk-in
 */
router.post('/agent/decline', async (req, res) => {
    try {
        const { walkInId, agentId } = req.body;

        if (!walkInId || !agentId) {
            return res.status(400).json({ error: 'walkInId and agentId are required' });
        }

        // Get the active timer to find call attempt ID
        const timerData = allocationService.getActiveTimer(walkInId);
        if (!timerData) {
            return res.status(400).json({ error: 'No active call for this walk-in' });
        }

        // Cancel the timer
        allocationService.cancelCallTimer(walkInId);

        const io = req.app.get('io');

        // Handle the decline with retry logic
        const result = await allocationService.handleTimeoutOrDecline(
            walkInId,
            timerData.callAttemptId,
            agentId,
            'DECLINED',
            io
        );

        if (result.success && result.retry) {
            // Start new call to next agent
            const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);

            if (io) {
                // Notify the new agent
                if (result.agent.socketId) {
                    io.to(result.agent.socketId).emit('AGENT_CALLED', {
                        walkInId: walkInId,
                        timeoutSeconds: result.timeoutSeconds,
                    });
                }

                io.emit('QUEUE_UPDATED', dashboardState);
            }

            // Start new timer
            allocationService.startCallTimer(
                walkInId,
                result.callAttempt.id,
                result.agent.id,
                result.timeoutSeconds,
                io,
                handleTimeout
            );

            res.json({
                success: true,
                retry: true,
                nextAgent: result.agent.name,
                nextAgency: result.agency.code,
            });
        } else {
            // No more agents available
            if (io) {
                io.emit('TIMEOUT', {
                    walkInId: walkInId,
                    status: 'FAILED',
                    message: 'No agents available',
                });

                const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);
                io.emit('QUEUE_UPDATED', dashboardState);
            }

            res.json({
                success: false,
                retry: false,
                message: 'No agents available',
            });
        }
    } catch (error) {
        console.error('Error in /agent/decline:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/walkin/new
 * Front desk creates a new walk-in - triggers allocation algorithm
 */
router.post('/walkin/new', async (req, res) => {
    try {
        const showFlatId = req.body.showFlatId || DEFAULT_SHOWFLAT_ID;
        const customerName = req.body.customerName || 'Guest';
        const io = req.app.get('io');

        const result = await allocationService.allocateAgent(showFlatId, customerName, io);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error,
                walkIn: result.walkIn,
            });
        }

        // Emit AGENT_CALLED to the specific agent with customer info
        if (result.agent.socketId && io) {
            io.to(result.agent.socketId).emit('AGENT_CALLED', {
                walkInId: result.walkIn.id,
                customerName: result.walkIn.customerName,
                queueNumber: result.walkIn.queueNumber,
                timeoutSeconds: result.timeoutSeconds,
            });
        }

        // Update dashboard
        if (io) {
            const dashboardState = await dashboardService.getDashboardState(showFlatId);
            io.emit('QUEUE_UPDATED', dashboardState);

            // Update public display to show the customer being called
            const publicData = await dashboardService.getPublicDisplayData(showFlatId);
            io.emit('PUBLIC_DISPLAY_UPDATED', publicData);
        }

        // Start timeout timer
        allocationService.startCallTimer(
            result.walkIn.id,
            result.callAttempt.id,
            result.agent.id,
            result.timeoutSeconds,
            io,
            handleTimeout
        );

        res.json({
            success: true,
            walkIn: result.walkIn,
            agent: {
                id: result.agent.id,
                name: result.agent.name,
            },
            agency: {
                code: result.agency.code,
                name: result.agency.name,
            },
            timeoutSeconds: result.timeoutSeconds,
        });
    } catch (error) {
        console.error('Error in /walkin/new:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/dashboard
 * Get full dashboard state
 */
router.get('/dashboard', async (req, res) => {
    try {
        const showFlatId = req.query.showFlatId || DEFAULT_SHOWFLAT_ID;
        const state = await dashboardService.getDashboardState(showFlatId);
        res.json(state);
    } catch (error) {
        console.error('Error in /dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/public-display
 * Get public display data (for TV screen)
 */
router.get('/public-display', async (req, res) => {
    try {
        const showFlatId = req.query.showFlatId || DEFAULT_SHOWFLAT_ID;
        const data = await dashboardService.getPublicDisplayData(showFlatId);
        res.json(data);
    } catch (error) {
        console.error('Error in /public-display:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/agents
 * Get all agents
 */
router.get('/agents', async (req, res) => {
    try {
        const showFlatId = req.query.showFlatId || DEFAULT_SHOWFLAT_ID;
        const agents = await agentService.getAllAgents(showFlatId);
        res.json(agents);
    } catch (error) {
        console.error('Error in /agents:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Timeout handler - called when call timer expires
 */
async function handleTimeout(walkInId, callAttemptId, agentId, io) {
    try {
        console.log(`⏰ Timeout for walk-in ${walkInId}, agent ${agentId}`);

        const result = await allocationService.handleTimeoutOrDecline(
            walkInId,
            callAttemptId,
            agentId,
            'TIMED_OUT',
            io
        );

        if (result.success && result.retry) {
            // Start new call to next agent
            console.log(`🔄 Retrying with agent ${result.agent.name}`);

            if (result.agent.socketId && io) {
                io.to(result.agent.socketId).emit('AGENT_CALLED', {
                    walkInId: walkInId,
                    timeoutSeconds: result.timeoutSeconds,
                });
            }

            // Start new timer
            allocationService.startCallTimer(
                walkInId,
                result.callAttempt.id,
                result.agent.id,
                result.timeoutSeconds,
                io,
                handleTimeout
            );

            if (io) {
                const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);
                io.emit('QUEUE_UPDATED', dashboardState);
            }
        } else {
            // No more agents available
            console.log(`❌ No more agents available for walk-in ${walkInId}`);

            if (io) {
                io.emit('TIMEOUT', {
                    walkInId: walkInId,
                    status: 'FAILED',
                    message: 'No agents available after timeout',
                });

                const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);
                io.emit('QUEUE_UPDATED', dashboardState);

                // Update public display
                const publicData = await dashboardService.getPublicDisplayData(DEFAULT_SHOWFLAT_ID);
                io.emit('PUBLIC_DISPLAY_UPDATED', publicData);
            }
        }
    } catch (error) {
        console.error('Error in timeout handler:', error);
    }
}

/**
 * POST /api/walkin/no-show
 * Mark a walk-in as no-show (customer didn't show up after being assigned)
 */
router.post('/walkin/no-show', async (req, res) => {
    try {
        const { walkInId, agentId } = req.body;
        const prisma = require('../prisma');

        if (!walkInId) {
            return res.status(400).json({ error: 'walkInId is required' });
        }

        // Update walk-in status to NO_SHOW
        const walkIn = await prisma.walkIn.update({
            where: { id: walkInId },
            data: { status: 'NO_SHOW' },
        });

        // If agent provided, put them back in the queue
        if (agentId) {
            await agentService.joinQueue(agentId, null);
        }

        // Emit updates
        const io = req.app.get('io');
        if (io) {
            const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);
            io.emit('QUEUE_UPDATED', dashboardState);

            const publicData = await dashboardService.getPublicDisplayData(DEFAULT_SHOWFLAT_ID);
            io.emit('PUBLIC_DISPLAY_UPDATED', publicData);
        }

        res.json({
            success: true,
            walkIn: walkIn,
            message: 'Walk-in marked as no-show',
        });
    } catch (error) {
        console.error('Error in /walkin/no-show:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/agent/complete
 * Agent completes serving a customer (goes back online)
 */
router.post('/agent/complete', async (req, res) => {
    try {
        const { agentId, socketId } = req.body;

        if (!agentId) {
            return res.status(400).json({ error: 'agentId is required' });
        }

        // Put agent back in queue
        const result = await agentService.joinQueue(agentId, socketId || null);

        // Emit updates
        const io = req.app.get('io');
        if (io) {
            const dashboardState = await dashboardService.getDashboardState(DEFAULT_SHOWFLAT_ID);
            io.emit('QUEUE_UPDATED', dashboardState);
        }

        res.json({
            success: true,
            agent: result.agent,
            message: 'Agent is back online',
        });
    } catch (error) {
        console.error('Error in /agent/complete:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

