const { syncAllExperiments } = require('../src/services/elasticsearchService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting ES Sync...');
    const result = await syncAllExperiments();
    console.log('Sync Result:', result);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        // Force exit because ES client might keep connection open
        process.exit(0);
    });
