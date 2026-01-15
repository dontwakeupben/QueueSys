/**
 * Allocation Service - Core Algorithm
 * 
 * Implements the hybrid queue algorithm:
 * 1. Round-Robin across Agencies (based on rotation_order and pointer_index)
 * 2. FIFO within Agency (based on AgentQueue.joined_at ASC)
 */

const prisma = require('../prisma');

// Store active timers for call attempts (in-memory)
const activeTimers = new Map(); // walkInId -> { timer, agentId, callAttemptId }

/**
 * Main allocation function - handles a new walk-in customer
 * Uses Prisma transaction with serializable isolation for concurrency safety
 */
async function allocateAgent(showFlatId, io) {
    // Use transaction with serializable isolation to prevent race conditions
    return await prisma.$transaction(async (tx) => {
        // Fetch ShowFlat with current state
        const showFlat = await tx.showFlat.findUnique({
            where: { id: showFlatId },
            include: {
                agencies: true,
            },
        });

        if (!showFlat) {
            throw new Error('ShowFlat not found');
        }

        // Parse rotation order
        const rotationOrder = showFlat.rotationOrder; // JSON array of agency codes
        if (!Array.isArray(rotationOrder) || rotationOrder.length === 0) {
            throw new Error('Invalid rotation order configuration');
        }

        // Create the walk-in record
        const walkIn = await tx.walkIn.create({
            data: {
                showFlatId: showFlatId,
                status: 'PENDING',
            },
        });

        // Try to find an available agent using round-robin across agencies
        const result = await findAvailableAgent(tx, showFlat, rotationOrder, walkIn.id);

        if (!result) {
            // No agents available in any agency
            await tx.walkIn.update({
                where: { id: walkIn.id },
                data: { status: 'FAILED' },
            });
            return { success: false, walkIn, error: 'No agents available' };
        }

        // Found an agent - update walk-in status and emit socket event
        await tx.walkIn.update({
            where: { id: walkIn.id },
            data: { status: 'CALLED' },
        });

        return {
            success: true,
            walkIn: { ...walkIn, status: 'CALLED' },
            agent: result.agent,
            agency: result.agency,
            callAttempt: result.callAttempt,
            timeoutSeconds: showFlat.timeoutSeconds,
        };
    }, {
        isolationLevel: 'Serializable', // Prevent race conditions
        timeout: 10000, // 10 second timeout
    });
}

/**
 * Find an available agent using round-robin + FIFO
 * Returns null if no agent is available
 */
async function findAvailableAgent(tx, showFlat, rotationOrder, walkInId) {
    let currentPointer = showFlat.pointerIndex;
    const totalAgencies = rotationOrder.length;
    let attempts = 0;

    // Try each agency in rotation order
    while (attempts < totalAgencies) {
        const targetAgencyCode = rotationOrder[currentPointer % totalAgencies];

        // Find the agency by code
        const agency = await tx.agency.findFirst({
            where: {
                code: targetAgencyCode,
                showFlatId: showFlat.id,
            },
        });

        if (agency) {
            // Get first agent in FIFO queue for this agency
            const queueEntry = await tx.agentQueue.findFirst({
                where: {
                    agencyId: agency.id,
                },
                orderBy: {
                    joinedAt: 'asc', // FIFO: oldest first
                },
                include: {
                    agent: true,
                },
            });

            if (queueEntry && queueEntry.agent) {
                // Found an available agent!
                // Create call attempt record
                const callAttempt = await tx.callAttempt.create({
                    data: {
                        walkInId: walkInId,
                        agencyId: agency.id,
                        agentId: queueEntry.agent.id,
                    },
                });

                // Update pointer to next agency for next walk-in
                await tx.showFlat.update({
                    where: { id: showFlat.id },
                    data: {
                        pointerIndex: (currentPointer + 1) % totalAgencies,
                    },
                });

                return {
                    agent: queueEntry.agent,
                    agency: agency,
                    callAttempt: callAttempt,
                };
            }
        }

        // No agent in this agency, try next
        currentPointer = (currentPointer + 1) % totalAgencies;
        attempts++;
    }

    // No agents available in any agency
    return null;
}

/**
 * Start the timeout timer for a call attempt
 */
function startCallTimer(walkInId, callAttemptId, agentId, timeoutSeconds, io, onTimeout) {
    // Cancel any existing timer for this walk-in
    cancelCallTimer(walkInId);

    const timer = setTimeout(async () => {
        activeTimers.delete(walkInId);
        await onTimeout(walkInId, callAttemptId, agentId, io);
    }, timeoutSeconds * 1000);

    activeTimers.set(walkInId, { timer, agentId, callAttemptId });
}

/**
 * Cancel the timeout timer for a walk-in
 */
function cancelCallTimer(walkInId) {
    const timerData = activeTimers.get(walkInId);
    if (timerData) {
        clearTimeout(timerData.timer);
        activeTimers.delete(walkInId);
    }
}

/**
 * Get active timer info for a walk-in
 */
function getActiveTimer(walkInId) {
    return activeTimers.get(walkInId);
}

/**
 * Handle timeout or decline - implements fail policy logic
 */
async function handleTimeoutOrDecline(walkInId, callAttemptId, agentId, result, io) {
    return await prisma.$transaction(async (tx) => {
        // Mark the call attempt
        await tx.callAttempt.update({
            where: { id: callAttemptId },
            data: {
                result: result, // 'TIMED_OUT' or 'DECLINED'
                respondedAt: new Date(),
            },
        });

        // Get the walk-in and its showFlat config
        const walkIn = await tx.walkIn.findUnique({
            where: { id: walkInId },
            include: {
                showFlat: {
                    include: { agencies: true },
                },
            },
        });

        if (!walkIn || walkIn.status !== 'CALLED') {
            return { success: false, error: 'Walk-in not in CALLED status' };
        }

        const showFlat = walkIn.showFlat;
        const rotationOrder = showFlat.rotationOrder;
        const failPolicy = showFlat.failPolicy;

        // Get the current agent's agency
        const currentAgent = await tx.agent.findUnique({
            where: { id: agentId },
            include: { agency: true },
        });

        if (!currentAgent) {
            return { success: false, error: 'Agent not found' };
        }

        let nextAgent = null;
        let nextAgency = null;

        if (failPolicy === 'SAME_AGENCY_THEN_NEXT') {
            // Try next agent in same agency first
            const nextInQueue = await tx.agentQueue.findFirst({
                where: {
                    agencyId: currentAgent.agencyId,
                    agentId: { not: agentId }, // Exclude current agent
                },
                orderBy: { joinedAt: 'asc' },
                include: { agent: true, agency: true },
            });

            if (nextInQueue) {
                nextAgent = nextInQueue.agent;
                nextAgency = nextInQueue.agency;
            }
        }

        // If no agent found in same agency (or SKIP_AGENCY policy), try other agencies
        if (!nextAgent) {
            // Find current agency position in rotation
            const currentAgencyIndex = rotationOrder.indexOf(currentAgent.agency.code);
            let pointer = (currentAgencyIndex + 1) % rotationOrder.length;
            let attempts = 0;

            while (attempts < rotationOrder.length - 1) {
                const targetCode = rotationOrder[pointer];
                const agency = await tx.agency.findFirst({
                    where: { code: targetCode, showFlatId: showFlat.id },
                });

                if (agency) {
                    const queueEntry = await tx.agentQueue.findFirst({
                        where: { agencyId: agency.id },
                        orderBy: { joinedAt: 'asc' },
                        include: { agent: true, agency: true },
                    });

                    if (queueEntry) {
                        nextAgent = queueEntry.agent;
                        nextAgency = queueEntry.agency;

                        // Update pointer for next walk-in
                        await tx.showFlat.update({
                            where: { id: showFlat.id },
                            data: { pointerIndex: (pointer + 1) % rotationOrder.length },
                        });
                        break;
                    }
                }

                pointer = (pointer + 1) % rotationOrder.length;
                attempts++;
            }
        }

        if (nextAgent && nextAgency) {
            // Create new call attempt
            const newCallAttempt = await tx.callAttempt.create({
                data: {
                    walkInId: walkInId,
                    agencyId: nextAgency.id,
                    agentId: nextAgent.id,
                },
            });

            return {
                success: true,
                retry: true,
                agent: nextAgent,
                agency: nextAgency,
                callAttempt: newCallAttempt,
                timeoutSeconds: showFlat.timeoutSeconds,
            };
        } else {
            // No agents available - mark walk-in as failed
            await tx.walkIn.update({
                where: { id: walkInId },
                data: { status: 'FAILED' },
            });

            return {
                success: false,
                retry: false,
                error: 'No agents available after retry',
            };
        }
    }, {
        isolationLevel: 'Serializable',
    });
}

/**
 * Agent accepts a walk-in
 */
async function acceptWalkIn(walkInId, agentId) {
    // Cancel the timer first
    cancelCallTimer(walkInId);

    return await prisma.$transaction(async (tx) => {
        // Verify the walk-in is in CALLED status
        const walkIn = await tx.walkIn.findUnique({
            where: { id: walkInId },
        });

        if (!walkIn || walkIn.status !== 'CALLED') {
            throw new Error('Walk-in is not in CALLED status');
        }

        // Find the pending call attempt for this agent
        const callAttempt = await tx.callAttempt.findFirst({
            where: {
                walkInId: walkInId,
                agentId: agentId,
                result: null, // Not yet resolved
            },
            orderBy: { calledAt: 'desc' },
        });

        if (!callAttempt) {
            throw new Error('No pending call attempt found for this agent');
        }

        // Update call attempt
        await tx.callAttempt.update({
            where: { id: callAttempt.id },
            data: {
                result: 'ACCEPTED',
                respondedAt: new Date(),
            },
        });

        // Update walk-in status
        const updatedWalkIn = await tx.walkIn.update({
            where: { id: walkInId },
            data: {
                status: 'ASSIGNED',
                assignedAgentId: agentId,
            },
        });

        // Remove agent from queue
        await tx.agentQueue.deleteMany({
            where: { agentId: agentId },
        });

        // Update agent status
        await tx.agent.update({
            where: { id: agentId },
            data: { status: 'UNAVAILABLE' },
        });

        // Get agent with agency for response
        const agent = await tx.agent.findUnique({
            where: { id: agentId },
            include: { agency: true },
        });

        return {
            success: true,
            walkIn: updatedWalkIn,
            agent: agent,
            agency: agent.agency,
        };
    });
}

module.exports = {
    allocateAgent,
    startCallTimer,
    cancelCallTimer,
    getActiveTimer,
    handleTimeoutOrDecline,
    acceptWalkIn,
};
