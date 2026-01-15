/**
 * Dashboard Service - Provides queue state data
 */

const prisma = require('../prisma');

/**
 * Get full dashboard state
 */
async function getDashboardState(showFlatId) {
    // Get ShowFlat with agencies and their queues
    const showFlat = await prisma.showFlat.findUnique({
        where: { id: showFlatId },
        include: {
            agencies: {
                include: {
                    agents: {
                        include: {
                            agentQueue: true,
                        },
                        orderBy: { name: 'asc' },
                    },
                },
                orderBy: { code: 'asc' },
            },
        },
    });

    if (!showFlat) {
        throw new Error('ShowFlat not found');
    }

    // Parse rotation order
    const rotationOrder = showFlat.rotationOrder;
    const currentAgencyCode = rotationOrder[showFlat.pointerIndex % rotationOrder.length];

    // Build agency queue state
    const agencyQueues = showFlat.agencies.map(agency => {
        // Get agents in queue, sorted by joined_at
        const queuedAgents = agency.agents
            .filter(agent => agent.agentQueue !== null)
            .sort((a, b) => new Date(a.agentQueue.joinedAt) - new Date(b.agentQueue.joinedAt))
            .map(agent => ({
                id: agent.id,
                name: agent.name,
                status: agent.status,
                joinedAt: agent.agentQueue.joinedAt,
            }));

        return {
            id: agency.id,
            name: agency.name,
            code: agency.code,
            isActive: agency.code === currentAgencyCode,
            queuedAgents: queuedAgents,
            totalAgents: agency.agents.length,
        };
    });

    // Get recent walk-ins
    const recentWalkIns = await prisma.walkIn.findMany({
        where: { showFlatId: showFlatId },
        include: {
            assignedAgent: {
                include: { agency: true },
            },
            callAttempts: {
                include: {
                    agent: true,
                    agency: true,
                },
                orderBy: { calledAt: 'desc' },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
    });

    // Get current active call (CALLED status)
    const activeCall = recentWalkIns.find(w => w.status === 'CALLED');
    let activeCallInfo = null;

    if (activeCall && activeCall.callAttempts.length > 0) {
        const latestAttempt = activeCall.callAttempts[0];
        activeCallInfo = {
            walkInId: activeCall.id,
            agentId: latestAttempt.agent.id,
            agentName: latestAttempt.agent.name,
            agencyCode: latestAttempt.agency.code,
            agencyName: latestAttempt.agency.name,
            calledAt: latestAttempt.calledAt,
        };
    }

    // Get last successful assignment
    const lastAssigned = recentWalkIns.find(w => w.status === 'ASSIGNED');
    let lastAssignment = null;

    if (lastAssigned && lastAssigned.assignedAgent) {
        lastAssignment = {
            walkInId: lastAssigned.id,
            agentId: lastAssigned.assignedAgent.id,
            agentName: lastAssigned.assignedAgent.name,
            agencyCode: lastAssigned.assignedAgent.agency.code,
            agencyName: lastAssigned.assignedAgent.agency.name,
            assignedAt: lastAssigned.updatedAt,
        };
    }

    return {
        showFlat: {
            id: showFlat.id,
            name: showFlat.name,
            rotationOrder: rotationOrder,
            pointerIndex: showFlat.pointerIndex,
            currentAgencyCode: currentAgencyCode,
            timeoutSeconds: showFlat.timeoutSeconds,
            failPolicy: showFlat.failPolicy,
        },
        agencyQueues: agencyQueues,
        activeCall: activeCallInfo,
        lastAssignment: lastAssignment,
        recentWalkIns: recentWalkIns.map(w => ({
            id: w.id,
            status: w.status,
            createdAt: w.createdAt,
            assignedAgentName: w.assignedAgent?.name || null,
            assignedAgencyCode: w.assignedAgent?.agency?.code || null,
        })),
    };
}

/**
 * Get public display data (for TV screen)
 */
async function getPublicDisplayData(showFlatId) {
    const showFlat = await prisma.showFlat.findUnique({
        where: { id: showFlatId },
    });

    if (!showFlat) {
        throw new Error('ShowFlat not found');
    }

    // Get last assigned walk-in
    const lastAssigned = await prisma.walkIn.findFirst({
        where: {
            showFlatId: showFlatId,
            status: 'ASSIGNED',
        },
        include: {
            assignedAgent: {
                include: { agency: true },
            },
        },
        orderBy: { updatedAt: 'desc' },
    });

    if (lastAssigned && lastAssigned.assignedAgent) {
        return {
            showFlatName: showFlat.name,
            hasAssignment: true,
            agentName: lastAssigned.assignedAgent.name,
            agencyCode: lastAssigned.assignedAgent.agency.code,
            agencyName: lastAssigned.assignedAgent.agency.name,
            assignedAt: lastAssigned.updatedAt,
        };
    }

    return {
        showFlatName: showFlat.name,
        hasAssignment: false,
        agentName: null,
        agencyCode: null,
        agencyName: null,
        assignedAt: null,
    };
}

module.exports = {
    getDashboardState,
    getPublicDisplayData,
};
