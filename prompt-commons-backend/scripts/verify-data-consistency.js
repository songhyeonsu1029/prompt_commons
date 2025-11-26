require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Client } = require('@elastic/elasticsearch');

const prisma = new PrismaClient();
const esClient = new Client({
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200'
});

const INDEX_NAME = 'experiments';

async function main() {
    console.log('Starting Data Consistency Check...');

    try {
        // 1. Compare Total Counts
        const mysqlCount = await prisma.experiment.count();
        const esCountResponse = await esClient.count({ index: INDEX_NAME });
        const esCount = esCountResponse.count;

        console.log('\n--- Total Count Check ---');
        console.log(`MySQL Count: ${mysqlCount}`);
        console.log(`ES Count:    ${esCount}`);

        if (mysqlCount === esCount) {
            console.log('✅ Counts match.');
        } else {
            console.error('❌ Counts MISMATCH!');
        }

        // 2. Deep Inspection (Random Sample)
        console.log('\n--- Deep Inspection (Random 5) ---');

        // Get 5 random IDs from MySQL
        // Note: Prisma doesn't support random natively well, so we fetch all IDs and pick random (okay for small dataset)
        // For larger datasets, use raw query or skip logic.
        const allIds = await prisma.experiment.findMany({ select: { id: true } });

        if (allIds.length === 0) {
            console.log('No data to inspect.');
            return;
        }

        const sampleIds = [];
        for (let i = 0; i < 5; i++) {
            if (allIds.length === 0) break;
            const randomIndex = Math.floor(Math.random() * allIds.length);
            sampleIds.push(allIds[randomIndex].id);
            allIds.splice(randomIndex, 1); // Remove to avoid duplicates
        }

        for (const id of sampleIds) {
            const mysqlData = await prisma.experiment.findUnique({
                where: { id: id },
                include: { activeVersion: true }
            });

            try {
                const esDataResponse = await esClient.get({
                    index: INDEX_NAME,
                    id: id.toString()
                });
                const esData = esDataResponse._source;

                console.log(`Checking ID: ${id}...`);

                let isConsistent = true;
                const errors = [];

                // Check Title
                if (mysqlData.title !== esData.title) {
                    isConsistent = false;
                    errors.push(`Title mismatch: MySQL="${mysqlData.title}" vs ES="${esData.title}"`);
                }

                // Check Prompt Text (Active Version)
                if (mysqlData.activeVersion.promptText !== esData.promptText) {
                    isConsistent = false;
                    errors.push('Prompt Text mismatch');
                }

                // Check Reproduction Rate
                if (mysqlData.activeVersion.reproductionRate !== esData.reproductionRate) {
                    isConsistent = false;
                    errors.push(`Rate mismatch: MySQL=${mysqlData.activeVersion.reproductionRate} vs ES=${esData.reproductionRate}`);
                }

                // Check Embedding
                // Note: dense_vector fields might be excluded from _source by default in some ES configurations
                if (esData.embedding) {
                    if (!Array.isArray(esData.embedding) || esData.embedding.length === 0) {
                        isConsistent = false;
                        errors.push('Embedding exists but is invalid/empty');
                    }
                } else {
                    console.log('   (Embedding not in _source, skipping check)');
                }
                if (isConsistent) {
                    console.log('✅ Consistent');
                } else {
                    console.error('❌ Mismatch found:');
                    errors.forEach(e => console.error(`   - ${e}`));
                }

            } catch (err) {
                if (err.meta && err.meta.statusCode === 404) {
                    console.error(`❌ ID ${id} missing in Elasticsearch!`);
                } else {
                    console.error(`Error fetching ID ${id} from ES:`, err.message);
                }
            }
        }

    } catch (error) {
        console.error('Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
