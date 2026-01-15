// Prisma Seed Script - Populates initial data
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Clear existing data
    await prisma.callAttempt.deleteMany();
    await prisma.walkIn.deleteMany();
    await prisma.agentQueue.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.agency.deleteMany();
    await prisma.showFlat.deleteMany();

    // Create ShowFlat
    const showFlat = await prisma.showFlat.create({
        data: {
            id: 'sf-001',
            name: 'Sunrise Residences',
            rotationOrder: ['A', 'B', 'C'], // Round-robin order
            pointerIndex: 0,
            timeoutSeconds: 30,
            failPolicy: 'SAME_AGENCY_THEN_NEXT',
        },
    });
    console.log('✅ Created ShowFlat:', showFlat.name);

    // Create Agencies
    const agencies = await Promise.all([
        prisma.agency.create({
            data: {
                id: 'agency-a',
                name: 'Alpha Realty',
                code: 'A',
                showFlatId: showFlat.id,
            },
        }),
        prisma.agency.create({
            data: {
                id: 'agency-b',
                name: 'Beta Properties',
                code: 'B',
                showFlatId: showFlat.id,
            },
        }),
        prisma.agency.create({
            data: {
                id: 'agency-c',
                name: 'Century Homes',
                code: 'C',
                showFlatId: showFlat.id,
            },
        }),
    ]);
    console.log('✅ Created', agencies.length, 'agencies');

    // Create Agents (2 per agency)
    const agents = await Promise.all([
        // Agency A
        prisma.agent.create({
            data: { id: 'agent-a1', name: 'Alice Wong', status: 'OFFLINE', agencyId: 'agency-a' },
        }),
        prisma.agent.create({
            data: { id: 'agent-a2', name: 'Andrew Tan', status: 'OFFLINE', agencyId: 'agency-a' },
        }),
        // Agency B
        prisma.agent.create({
            data: { id: 'agent-b1', name: 'Ben Lee', status: 'OFFLINE', agencyId: 'agency-b' },
        }),
        prisma.agent.create({
            data: { id: 'agent-b2', name: 'Betty Chen', status: 'OFFLINE', agencyId: 'agency-b' },
        }),
        // Agency C
        prisma.agent.create({
            data: { id: 'agent-c1', name: 'Charlie Lim', status: 'OFFLINE', agencyId: 'agency-c' },
        }),
        prisma.agent.create({
            data: { id: 'agent-c2', name: 'Cathy Ng', status: 'OFFLINE', agencyId: 'agency-c' },
        }),
    ]);
    console.log('✅ Created', agents.length, 'agents');

    console.log('🎉 Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
