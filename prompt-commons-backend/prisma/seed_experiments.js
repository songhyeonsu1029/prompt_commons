const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const USER_ID_AUTHOR = 3;
const USER_ID_VERIFIER = 4;

const AI_MODELS = ['GPT-4', 'GPT-4o', 'Claude-3.5', 'Claude-3', 'Gemini Pro', 'Llama-3'];

const SCENARIOS = [
    {
        type: 'Coding',
        title: 'React Component Generator',
        prompt: 'Create a reusable React component for a [COMPONENT_NAME] with Tailwind CSS styling. It should support props for [PROPS_LIST] and handle [EDGE_CASE].',
        tags: ['react', 'javascript', 'frontend', 'tailwindcss'],
        vars: {
            COMPONENT_NAME: ['Modal', 'Dropdown', 'Card', 'Navbar', 'Sidebar'],
            PROPS_LIST: ['isOpen, onClose', 'items, onSelect', 'title, content, image', 'links, logo', 'menuItems, collapsed'],
            EDGE_CASE: ['outside clicks', 'empty arrays', 'loading states', 'mobile responsiveness', 'keyboard navigation']
        }
    },
    {
        type: 'Writing',
        title: 'SEO Blog Post Writer',
        prompt: 'Write a comprehensive SEO-optimized blog post about [TOPIC]. Include a catchy title, meta description, and use the keywords: [KEYWORDS]. The tone should be [TONE].',
        tags: ['seo', 'blogging', 'content-marketing', 'writing'],
        vars: {
            TOPIC: ['Remote Work Trends', 'AI in Healthcare', 'Sustainable Living', 'Digital Marketing 101', 'Healthy Eating Habits'],
            KEYWORDS: ['remote work, productivity', 'AI, medical diagnosis', 'zero waste, eco-friendly', 'SEO, social media', 'nutrition, diet'],
            TONE: ['professional', 'conversational', 'informative', 'persuasive', 'witty']
        }
    },
    {
        type: 'Analysis',
        title: 'Financial Report Summarizer',
        prompt: 'Analyze the following financial report excerpt and summarize the key findings regarding [METRIC]. Highlight any significant trends or anomalies.\n\n[Excerpt Placeholder]',
        tags: ['finance', 'data-analysis', 'business', 'reporting'],
        vars: {
            METRIC: ['revenue growth', 'operating expenses', 'net profit margin', 'cash flow', 'market share']
        }
    },
    {
        type: 'Translation',
        title: 'Technical Documentation Translator',
        prompt: 'Translate the following technical documentation from English to [LANGUAGE]. Ensure that technical terms like [TERM] are preserved or correctly localized.',
        tags: ['translation', 'localization', 'technical-writing'],
        vars: {
            LANGUAGE: ['Korean', 'Japanese', 'Spanish', 'French', 'German'],
            TERM: ['API endpoint', 'stack trace', 'dependency injection', 'asynchronous function', 'database schema']
        }
    },
    {
        type: 'Image Generation',
        title: 'Midjourney Portrait Prompter',
        prompt: 'Generate a high-quality portrait of a [SUBJECT] in the style of [STYLE]. Lighting should be [LIGHTING] and the background should be [BACKGROUND]. --ar 2:3',
        tags: ['midjourney', 'image-generation', 'art', 'prompt-engineering'],
        vars: {
            SUBJECT: ['cyberpunk hacker', 'medieval knight', 'futuristic astronaut', 'fantasy elf', 'noir detective'],
            STYLE: ['oil painting', 'digital art', 'photorealistic', 'anime', 'watercolor'],
            LIGHTING: ['cinematic', 'natural', 'neon', 'dramatic', 'soft'],
            BACKGROUND: ['dystopian city', 'enchanted forest', 'space station', 'rainy street', 'sunny meadow']
        }
    }
];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template, vars) {
    let result = template;
    for (const [key, values] of Object.entries(vars)) {
        result = result.replace(`[${key}]`, getRandomItem(values));
    }
    return result;
}

async function cleanUp() {
    console.log('Cleaning up old test data...');
    // Delete experiments created by the seed script (identified by generic titles or just delete all for user 3)
    // Safer to delete by author ID if we are sure user 3 is only for testing
    await prisma.experiment.deleteMany({
        where: { authorId: BigInt(USER_ID_AUTHOR) }
    });
    console.log('Cleanup finished.');
}

async function main() {
    await cleanUp();
    console.log('Start seeding realistic data...');

    const author = await prisma.user.findUnique({ where: { id: BigInt(USER_ID_AUTHOR) } });
    const verifier = await prisma.user.findUnique({ where: { id: BigInt(USER_ID_VERIFIER) } });

    if (!author || !verifier) {
        console.error(`User ${USER_ID_AUTHOR} or ${USER_ID_VERIFIER} not found.`);
        return;
    }

    for (let i = 0; i < 50; i++) {
        const scenario = getRandomItem(SCENARIOS);
        const title = `${scenario.title} #${Math.floor(Math.random() * 1000)}`;
        const promptText = fillTemplate(scenario.prompt, scenario.vars);
        const aiModel = getRandomItem(AI_MODELS);

        // 1. Create Experiment
        const experiment = await prisma.experiment.create({
            data: {
                authorId: BigInt(USER_ID_AUTHOR),
                title: title,
                taskType: scenario.type,
            }
        });

        console.log(`Created: ${title} (ID: ${experiment.id})`);

        // 2. Create Versions
        const numVersions = Math.floor(Math.random() * 2) + 2; // 2-3 versions
        let activeVersionId = null;

        for (let v = 1; v <= numVersions; v++) {
            const versionNumber = `v${v}.0`;
            const currentPrompt = v === 1 ? promptText : promptText + `\n\nAdditional instruction: Ensure the output is concise.`; // Slight variation

            const version = await prisma.experimentVersion.create({
                data: {
                    experimentId: experiment.id,
                    versionNumber: versionNumber,
                    promptText: currentPrompt,
                    promptDescription: `This version optimizes for ${v === 1 ? 'clarity' : 'conciseness'} and accuracy.`,
                    modificationGuide: `You can adjust the [${Object.keys(scenario.vars)[0]}] placeholder to fit your specific needs.`,
                    changelog: v === 1 ? 'Initial release with core functionality.' : `Refined prompt for better token usage and stricter output format.`,
                    aiModel: aiModel,
                    modelVersion: 'latest',
                    reproductionRate: 0, // Will update later
                    reproductionCount: 0,
                    viewCount: Math.floor(Math.random() * 500) + 50,
                }
            });

            // Tags
            await prisma.experimentTag.createMany({
                data: scenario.tags.map(tag => ({
                    versionId: version.id,
                    tagName: tag
                }))
            });

            activeVersionId = version.id;

            // 3. Create Reproductions (1-3 reports per version)
            const numReproductions = Math.floor(Math.random() * 3) + 1;
            let successCount = 0;
            let totalScore = 0;

            for (let r = 0; r < numReproductions; r++) {
                const isSuccess = Math.random() > 0.2; // 80% success rate
                if (isSuccess) successCount++;

                // Score: 80-100 for success, 20-60 for failure
                const score = isSuccess
                    ? Math.floor(Math.random() * 21) + 80
                    : Math.floor(Math.random() * 41) + 20;

                totalScore += score;

                await prisma.reproduction.create({
                    data: {
                        experimentId: experiment.id,
                        verifierId: BigInt(USER_ID_VERIFIER),
                        versionId: version.id,
                        success: isSuccess,
                        score: score,
                        note: isSuccess
                            ? `Works perfectly! The output was exactly as expected. The model handled the edge cases well.`
                            : `Failed to generate the expected format. The model hallucinated some details.`,
                        modifiedPrompt: Math.random() > 0.9 ? 'Added "Think step by step" to the prompt.' : null,
                    }
                });
            }

            // 4. Update Stats Correctly (Weighted Algorithm)
            // Formula: (Average Score * 0.7) + (Success Rate * 0.3)
            const averageScore = totalScore / numReproductions;
            const successRate = (successCount / numReproductions) * 100;
            const reproductionRate = Math.round((averageScore * 0.7) + (successRate * 0.3));

            await prisma.experimentVersion.update({
                where: { id: version.id },
                data: {
                    reproductionCount: numReproductions,
                    reproductionRate: reproductionRate
                }
            });
        }

        // Set active version
        await prisma.experiment.update({
            where: { id: experiment.id },
            data: { activeVersionId: activeVersionId }
        });
    }

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
