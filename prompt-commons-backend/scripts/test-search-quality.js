require('dotenv').config();
const { semanticSearch } = require('../src/services/elasticsearchService');

const TEST_CASES = [
    {
        intent: 'Optimization',
        query: 'Make this code run faster',
        expectedKeywords: ['Optimization', 'Refactor', 'Speed', 'Performance', 'Optimize']
    },
    {
        intent: 'Debugging',
        query: 'Find bugs in my function',
        expectedKeywords: ['Bug', 'Fix', 'Debug', 'Error', 'Leak']
    },
    {
        intent: 'Documentation',
        query: 'Explain what this code does',
        expectedKeywords: ['Documentation', 'Explanation', 'Summary', 'Javadoc', 'Doc', 'OpenAPI']
    },
    {
        intent: 'Testing',
        query: 'Ensure code reliability',
        expectedKeywords: ['Unit Test', 'TDD', 'Testing', 'Jest', 'Test', 'Case']
    },
    {
        intent: 'Translation',
        query: 'Change Java code to Python',
        expectedKeywords: ['Translation', 'Convert', 'Porting', 'Translate']
    }
];

async function runTests() {
    console.log('Starting Search Quality Tests...\n');
    let totalPass = 0;
    let totalFail = 0;

    for (const testCase of TEST_CASES) {
        console.log(`---------------------------------------------------`);
        console.log(`Testing Intent: ${testCase.intent}`);
        console.log(`Query: "${testCase.query}"`);
        console.log(`Expected Keywords: [${testCase.expectedKeywords.join(', ')}]`);

        try {
            // Limit to top 3 for strict relevance check
            const result = await semanticSearch({ query: testCase.query, limit: 3 });

            if (!result.success) {
                console.error('❌ Search failed:', result.error);
                totalFail++;
                continue;
            }

            const topResults = result.data;
            if (topResults.length === 0) {
                console.log('❌ FAIL: No results found.');
                totalFail++;
                continue;
            }

            let relevantCount = 0;
            console.log('Top 3 Results:');

            topResults.forEach((item, index) => {
                const title = item.title;
                const tags = item.tags || [];
                const score = item.score;

                // Check relevance (Case-insensitive partial match)
                const isRelevant = testCase.expectedKeywords.some(keyword => {
                    const lowerKeyword = keyword.toLowerCase();
                    return title.toLowerCase().includes(lowerKeyword) ||
                        tags.some(tag => tag.toLowerCase().includes(lowerKeyword));
                });

                const statusIcon = isRelevant ? '✅' : '⬜️';
                if (isRelevant) relevantCount++;

                console.log(`   ${index + 1}. ${statusIcon} [${score.toFixed(2)}] ${title} (Tags: ${tags.join(', ')})`);
            });

            if (relevantCount > 0) {
                console.log(`\nResult: ✅ PASS (Found ${relevantCount} relevant items)`);
                totalPass++;
            } else {
                console.log(`\nResult: ❌ FAIL (No relevant items found in top 3)`);
                totalFail++;
            }

        } catch (error) {
            console.error('Error running test case:', error);
            totalFail++;
        }
        console.log('\n');
    }

    console.log('===================================================');
    console.log(`Summary: ${totalPass} Passed, ${totalFail} Failed`);

    if (totalFail > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests();
