/**
 * Agent Service - Handles agent queue operations
 */

const prisma = require('../prisma');

/**
 * Agent joins the queue (goes online)
 */
async function joinQueue(agentId, socketId) {
    return await prisma.$transaction(async (tx) => {
        // Get the agent
        const agent = await tx.agent.findUnique({
            where: { id: agentId },
            include: { agency: true },
        });

        if (!agent) {
            throw new Error('Agent not found');
        }

        // Check if already in queue
        const existingEntry = await tx.agentQueue.findUnique({
            where: { agentId: agentId },
        });

        if (existingEntry) {
            // Already in queue, just update socket and status
            await tx.agent.update({
                where: { id: agentId },
                data: {
                    status: 'AVAILABLE',
                    socketId: socketId,
                },
            });

            return { agent, isNew: false };
        }

        // Add to queue
        await tx.agentQueue.create({
            data: {
                agentId: agentId,
                agencyId: agent.agencyId,
                joinedAt: new Date(),
            },
        });

        // Update agent status
        const updatedAgent = await tx.agent.update({
            where: { id: agentId },
            data: {
                status: 'AVAILABLE',
                socketId: socketId,
            },
            include: { agency: true },
        });

        return { agent: updatedAgent, isNew: true };
    });
}

/**
 * Agent leaves the queue (goes offline)
 */
async function leaveQueue(agentId) {
    return await prisma.$transaction(async (tx) => {
        // Remove from queue
        await tx.agentQueue.deleteMany({
            where: { agentId: agentId },
        });

        // Update agent status
        const agent = await tx.agent.update({
            where: { id: agentId },
            data: {
                status: 'OFFLINE',
                socketId: null,
            },
            include: { agency: true },
        });

        return { agent };
    });
}

/**
 * Handle socket disconnect - remove agent from queue
 */
async function handleDisconnect(socketId) {
    const agent = await prisma.agent.findFirst({
        where: { socketId: socketId },
    });

    if (agent) {
        return await leaveQueue(agent.id);
    }

    return null;
}

/**
 * Get all agents (with optional filtering)
 */
async function getAllAgents(showFlatId) {
    return await prisma.agent.findMany({
        where: showFlatId ? {
            agency: { showFlatId: showFlatId },
        } : undefined,
        include: {
            agency: true,
            agentQueue: true,
        },
        orderBy: [
            { agency: { code: 'asc' } },
            { name: 'asc' },
        ],
    });
}

/**
 * Get agent by ID
 */
async function getAgentById(agentId) {
    return await prisma.agent.findUnique({
        where: { id: agentId },
        include: {
            agency: true,
            agentQueue: true,
        },
    });
}

/**
 * Get agent by socket ID
 */
async function getAgentBySocketId(socketId) {
    return await prisma.agent.findFirst({
        where: { socketId: socketId },
        include: {
            agency: true,
        },
    });
}

module.exports = {
    joinQueue,
    leaveQueue,
    handleDisconnect,
    getAllAgents,
    getAgentById,
    getAgentBySocketId,
};
