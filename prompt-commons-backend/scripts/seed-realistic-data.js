require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Client } = require('@elastic/elasticsearch');
const { indexExperiment } = require('../src/services/elasticsearchService');

const prisma = new PrismaClient();
const esClient = new Client({
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200'
});

const INDEX_NAME = 'experiments';
const USER_ID_AUTHOR = 3;
const USER_ID_VERIFIER = 4;

const TEMPLATES = [
    // --- Frontend (React, Vue, CSS) ---
    { type: 'Frontend', title: 'Optimize React Re-renders', prompt: 'Identify unnecessary re-renders in this React component and optimize it using React.memo and useCallback.' },
    { type: 'Frontend', title: 'React Custom Hook for Fetching', prompt: 'Create a custom React hook `useFetch` that handles loading, error, and data states for API calls.' },
    { type: 'Frontend', title: 'Vue 3 Composition API Conversion', prompt: 'Refactor this Vue 2 Options API component to use the Vue 3 Composition API with `<script setup>`.' },
    { type: 'Frontend', title: 'Center a Div with Flexbox', prompt: 'Write the CSS to perfectly center a child div within a parent div using Flexbox.' },
    { type: 'Frontend', title: 'CSS Grid Layout for Dashboard', prompt: 'Create a responsive dashboard layout using CSS Grid with a sidebar, header, and main content area.' },
    { type: 'Frontend', title: 'Implement Dark Mode with CSS Variables', prompt: 'Show how to implement a dark mode toggle using CSS variables and a small JS snippet.' },
    { type: 'Frontend', title: 'Accessible Modal Dialog', prompt: 'Build a modal component that follows WAI-ARIA guidelines for accessibility (focus trap, escape key).' },
    { type: 'Frontend', title: 'Debounce Search Input', prompt: 'Implement a debounce function for a search input field to reduce API calls.' },
    { type: 'Frontend', title: 'Infinite Scroll Implementation', prompt: 'Create an infinite scroll component using the Intersection Observer API.' },
    { type: 'Frontend', title: 'Redux Toolkit Setup', prompt: 'Set up a Redux store using Redux Toolkit with a simple counter slice.' },

    // --- Backend (Node, Python, Java, Go) ---
    { type: 'Backend', title: 'Express.js Auth Middleware', prompt: 'Write an Express.js middleware to verify JWT tokens and attach the user to the request object.' },
    { type: 'Backend', title: 'Node.js Stream Processing', prompt: 'Create a Node.js script to read a large CSV file line-by-line using streams and process the data.' },
    { type: 'Backend', title: 'Python Flask API Endpoint', prompt: 'Create a RESTful API endpoint in Flask that accepts JSON data and saves it to a database.' },
    { type: 'Backend', title: 'Pandas Data Cleaning', prompt: 'Write a Python script using Pandas to clean a dataset: handle missing values and normalize date formats.' },
    { type: 'Backend', title: 'Java Spring Boot Controller', prompt: 'Create a Spring Boot RestController with GET and POST mappings for a "Product" resource.' },
    { type: 'Backend', title: 'Java Singleton Pattern', prompt: 'Implement a thread-safe Singleton pattern in Java.' },
    { type: 'Backend', title: 'Go Goroutine Worker Pool', prompt: 'Implement a worker pool in Go to process a queue of jobs concurrently.' },
    { type: 'Backend', title: 'Go JSON Unmarshalling', prompt: 'Show how to unmarshal a complex nested JSON string into Go structs.' },
    { type: 'Backend', title: 'GraphQL Apollo Server Setup', prompt: 'Set up a basic Apollo Server with a schema for "Books" and "Authors".' },
    { type: 'Backend', title: 'WebSocket Chat Server', prompt: 'Create a simple WebSocket server using `ws` library in Node.js for a chat application.' },

    // --- Database (SQL, NoSQL) ---
    { type: 'Database', title: 'Complex SQL Join Query', prompt: 'Write a SQL query to join three tables (Users, Orders, Products) and calculate total sales per user.' },
    { type: 'Database', title: 'Optimize SQL Indexing', prompt: 'Analyze this slow query and suggest appropriate indexes to improve performance.' },
    { type: 'Database', title: 'MongoDB Aggregation Pipeline', prompt: 'Write a MongoDB aggregation pipeline to group sales by month and calculate the average order value.' },
    { type: 'Database', title: 'Redis Caching Strategy', prompt: 'Explain how to implement a "Cache-Aside" pattern using Redis and Node.js.' },
    { type: 'Database', title: 'PostgreSQL JSONB Query', prompt: 'Show how to query JSONB data in PostgreSQL to find records where a specific key exists.' },

    // --- DevOps & Infrastructure ---
    { type: 'DevOps', title: 'Docker Multi-stage Build', prompt: 'Create a Dockerfile for a Node.js app using multi-stage builds to minimize the final image size.' },
    { type: 'DevOps', title: 'Kubernetes Deployment YAML', prompt: 'Write a Kubernetes Deployment YAML file for a web application with 3 replicas and a LoadBalancer service.' },
    { type: 'DevOps', title: 'GitHub Actions CI Workflow', prompt: 'Create a GitHub Actions workflow to run tests and linting on every push to the main branch.' },
    { type: 'DevOps', title: 'Nginx Reverse Proxy Config', prompt: 'Configure Nginx as a reverse proxy to forward traffic to a backend server running on port 3000.' },
    { type: 'DevOps', title: 'AWS Lambda Function (Node.js)', prompt: 'Write a simple AWS Lambda function in Node.js that processes an S3 event.' },
    { type: 'DevOps', title: 'Terraform S3 Bucket', prompt: 'Write Terraform code to provision a private S3 bucket with versioning enabled.' },
    { type: 'DevOps', title: 'Linux Log Rotation Script', prompt: 'Write a bash script to rotate log files that are larger than 100MB.' },

    // --- Security ---
    { type: 'Security', title: 'Fix SQL Injection Vulnerability', prompt: 'Identify and fix the SQL injection vulnerability in this raw SQL query code.' },
    { type: 'Security', title: 'Prevent XSS in React', prompt: 'Explain how React handles XSS and show an example of dangerous code to avoid (`dangerouslySetInnerHTML`).' },
    { type: 'Security', title: 'Secure Password Storage', prompt: 'Show how to securely hash and salt passwords using bcrypt in Node.js.' },

    // --- Testing ---
    { type: 'Testing', title: 'Jest Unit Test for Utils', prompt: 'Write Jest unit tests for a utility function that formats currency strings.' },
    { type: 'Testing', title: 'Cypress E2E Login Test', prompt: 'Write a Cypress E2E test to verify the user login flow, including error handling.' },
    { type: 'Testing', title: 'Python Pytest Fixture', prompt: 'Create a Pytest fixture for setting up a database connection before tests run.' },

    // --- Mobile & Others ---
    { type: 'Mobile', title: 'React Native FlatList', prompt: 'Implement a performant list in React Native using FlatList with `renderItem` and `keyExtractor`.' },
    { type: 'Mobile', title: 'SwiftUI Basic View', prompt: 'Create a simple SwiftUI view with a text label and a button that updates a state variable.' },
    { type: 'Algorithms', title: 'Binary Search Implementation', prompt: 'Implement the Binary Search algorithm in Python and explain its time complexity.' },
    { type: 'Algorithms', title: 'LRU Cache Implementation', prompt: 'Design and implement an LRU (Least Recently Used) Cache class.' },
    { type: 'Regex', title: 'Email Validation Regex', prompt: 'Write a regular expression to validate standard email addresses.' },
    { type: 'Regex', title: 'Extract URL from Text', prompt: 'Write a regex to extract all HTTP/HTTPS URLs from a given text string.' },
    { type: 'TypeScript', title: 'TypeScript Generic Interface', prompt: 'Define a generic interface `ApiResponse<T>` and use it for a user data response.' },
    { type: 'TypeScript', title: 'TypeScript Utility Types', prompt: 'Demonstrate the use of `Pick`, `Omit`, and `Partial` utility types in TypeScript.' },
    { type: 'Rust', title: 'Rust Error Handling', prompt: 'Show how to handle errors in Rust using the `Result` type and the `?` operator.' },
    { type: 'Bash', title: 'File Backup Script', prompt: 'Write a bash script to backup a directory to a tar.gz file with a timestamp in the filename.' }
];

const AI_MODELS = ['GPT-4', 'GPT-4o', 'Claude-3.5-Sonnet', 'Gemini-1.5-Pro', 'Llama-3-70b'];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function cleanup() {
    console.log('Cleaning up existing data...');
    try {
        await prisma.reproduction.deleteMany();
        await prisma.comment.deleteMany();
        await prisma.experimentTag.deleteMany();
        await prisma.experimentVersion.deleteMany();
        await prisma.experiment.deleteMany();

        const indexExists = await esClient.indices.exists({ index: INDEX_NAME });
        if (indexExists) {
            await esClient.indices.delete({ index: INDEX_NAME });
        }

        await esClient.indices.create({
            index: INDEX_NAME,
            body: {
                mappings: {
                    properties: {
                        id: { type: 'keyword' },
                        title: { type: 'text' },
                        description: { type: 'text' },
                        promptText: { type: 'text' },
                        aiModel: { type: 'keyword' },
                        reproductionRate: { type: 'integer' },
                        tags: { type: 'keyword' },
                        createdAt: { type: 'date' },
                        embedding: {
                            type: 'dense_vector',
                            dims: 768,
                            index: true,
                            similarity: 'cosine'
                        }
                    }
                }
            }
        });
        console.log('Cleanup complete.');
    } catch (error) {
        console.error('Cleanup failed:', error);
        throw error;
    }
}

async function ensureUsersExist() {
    const author = await prisma.user.upsert({
        where: { id: BigInt(USER_ID_AUTHOR) },
        update: {},
        create: { id: BigInt(USER_ID_AUTHOR), username: 'DevAuthor', email: 'author@example.com', passwordHash: 'placeholder' }
    });
    const verifier = await prisma.user.upsert({
        where: { id: BigInt(USER_ID_VERIFIER) },
        update: {},
        create: { id: BigInt(USER_ID_VERIFIER), username: 'QA_Verifier', email: 'verifier@example.com', passwordHash: 'placeholder' }
    });
    console.log(`Users ensured: ${author.username}, ${verifier.username}`);
}

async function main() {
    await cleanup();
    await ensureUsersExist();
    console.log(`Starting seeding of ${TEMPLATES.length} unique experiments...`);

    for (let i = 0; i < TEMPLATES.length; i++) {
        const template = TEMPLATES[i];
        const aiModel = getRandomItem(AI_MODELS);

        // 1. Create Experiment
        const experiment = await prisma.experiment.create({
            data: {
                authorId: BigInt(USER_ID_AUTHOR),
                title: template.title,
                taskType: template.type
            }
        });

        console.log(`[${i + 1}/${TEMPLATES.length}] Created: ${template.title}`);

        // 2. Create Versions (1-3 versions)
        const numVersions = Math.floor(Math.random() * 3) + 1;
        let activeVersionId = null;

        for (let v = 1; v <= numVersions; v++) {
            const versionNumber = `v${v}.0`;
            const isLatest = v === numVersions;
            const currentPrompt = v === 1 ? template.prompt : template.prompt + `\n\n[v${v}.0 Update]: Improved based on feedback.`;

            const version = await prisma.experimentVersion.create({
                data: {
                    experimentId: experiment.id,
                    versionNumber: versionNumber,
                    promptText: currentPrompt,
                    promptDescription: `Prompt for ${template.title}`,
                    modificationGuide: 'Feel free to modify variable names.',
                    changelog: v === 1 ? 'Initial release' : 'Refined prompt.',
                    aiModel: aiModel,
                    modelVersion: 'latest',
                    reproductionRate: 0,
                    reproductionCount: 0,
                    viewCount: Math.floor(Math.random() * 500)
                }
            });

            // Tags
            const tags = [template.type.toLowerCase(), 'development'];
            if (template.title.toLowerCase().includes('react')) tags.push('react');
            if (template.title.toLowerCase().includes('python')) tags.push('python');

            await prisma.experimentTag.createMany({
                data: tags.map(t => ({ versionId: version.id, tagName: t }))
            });

            // 3. Reproductions
            const numReproductions = Math.floor(Math.random() * 4); // 0-3 reproductions
            let successCount = 0;
            let totalScore = 0;

            for (let r = 0; r < numReproductions; r++) {
                const isSuccess = Math.random() > 0.15;
                if (isSuccess) successCount++;
                const score = isSuccess ? Math.floor(Math.random() * 11) + 90 : Math.floor(Math.random() * 40) + 30;
                totalScore += score;

                await prisma.reproduction.create({
                    data: {
                        experimentId: experiment.id,
                        versionId: version.id,
                        verifierId: BigInt(USER_ID_VERIFIER),
                        success: isSuccess,
                        score: score,
                        note: isSuccess ? 'Works as expected.' : 'Failed in edge cases.',
                        modifiedPrompt: null
                    }
                });
            }

            // Update Stats
            if (numReproductions > 0) {
                const avgScore = totalScore / numReproductions;
                const successRate = (successCount / numReproductions) * 100;
                const rate = Math.round((avgScore * 0.7) + (successRate * 0.3));

                await prisma.experimentVersion.update({
                    where: { id: version.id },
                    data: { reproductionCount: numReproductions, reproductionRate: rate }
                });
            }

            // Sync Latest to ES
            if (isLatest) {
                await prisma.experiment.update({
                    where: { id: experiment.id },
                    data: { activeVersionId: version.id }
                });

                // Get updated version for rate
                const updatedVersion = await prisma.experimentVersion.findUnique({ where: { id: version.id } });

                try {
                    await indexExperiment({
                        id: experiment.id.toString(),
                        title: experiment.title,
                        description: `Prompt for ${template.title}`,
                        promptText: currentPrompt,
                        aiModel: aiModel,
                        reproductionRate: updatedVersion.reproductionRate,
                        tags: tags,
                        createdAt: experiment.createdAt
                    });
                } catch (err) {
                    console.error(`   -> ES Sync Failed: ${err.message}`);
                }
            }
        }
    }
    console.log('Seeding completed successfully.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
