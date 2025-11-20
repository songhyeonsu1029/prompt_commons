// src/services/api.js

const LATENCY = 300; // ms

// --- MOCK DATABASE ---
const MOCK_EXPERIMENTS_DB = [
    {
        id: 1,
        title: 'Generate a README for a CLI tool',
        ai_model: 'Claude 3',
        model_version: 'opus-20240229',
        task_type: 'Code Generation',
        modification_guide: 'This prompt is designed to be highly adaptable. You can change the `[TOOL_NAME]`, `[DESCRIPTION]`, `[INSTALLATION]`, `[USAGE]`, and `[CONTRIBUTING]` placeholders to fit any command-line tool. For more advanced customization, try modifying the tone and style of the generated README by adding adjectives like "professional", "casual", or "witty" to the prompt.',
        author: { id: 2, username: 'AI_Architect' },
        created_at: '2025-03-15T08:00:00Z',
        active_version: 'v1.1',
        versions: [
            {
                version_number: 'v1.0',
                prompt_text: 'Generate a comprehensive README.md file for a new CLI tool named `[TOOL_NAME]`. The README should include the following sections: \n\n- **Overview**: A brief description of what the tool does. \n- **Installation**: Instructions on how to install the tool. \n- **Usage**: Examples of how to use the tool with common commands. \n- **Contributing**: Guidelines for how others can contribute to the project.',
                changelog: 'Initial release with basic sections.',
                tags: ['code-generation', 'readme', 'documentation', 'cli'],
                created_at: '2025-03-15T08:00:00Z',
                stats: { reproduction_rate: 85, reproduction_count: 20, views: 1500 }
            },
            {
                version_number: 'v1.1',
                prompt_text: 'Generate a professional and user-friendly README.md file for a new CLI tool named `[TOOL_NAME]`. The tool is described as: `[DESCRIPTION]`. The README should be well-structured and include the following sections:\n\n- **Overview**: A compelling description of the tool\'s purpose and features.\n- **Installation**: Clear and concise installation instructions (e.g., using npm, pip, or Homebrew): `[INSTALLATION]`.\n- **Usage**: Practical examples of how to use the tool, demonstrating its key features: `[USAGE]`.\n- **Contributing**: Welcoming guidelines for developers who want to contribute to the project: `[CONTRIBUTING]`.',
                changelog: 'Improved structure and added placeholders for easier customization.',
                tags: ['code-generation', 'readme', 'documentation', 'cli', 'professional'],
                created_at: '2025-03-18T14:20:00Z',
                stats: { reproduction_rate: 92, reproduction_count: 35, views: 2800 }
            }
        ]
    }
];

const MOCK_USERS_DB = {
    'TestUser': { id: 1, username: 'TestUser', bio: 'Testing the prompt commons platform.', joined_at: '2025-01-01', stats: { saved: 0, reproductions: 0 }, saved: [] },
    'AI_Architect': { id: 2, username: 'AI_Architect', bio: 'Building the future of AI, one prompt at a time.', joined_at: '2024-01-15' },
    'DevRel_Kim': { id: 3, username: 'DevRel_Kim', bio: 'Bridging the gap between developers and technology.', joined_at: '2024-02-20' },
    'Dr_Prompt': { id: 4, username: 'Dr_Prompt', bio: 'PhD in Promptology. Crafting words that build worlds.', joined_at: '2024-03-10' },
    'ArtDirector': { id: 5, username: 'ArtDirector', bio: 'Visuals, aesthetics, and pixels. Making AI art beautiful.', joined_at: '2024-04-05' },
    'Prompt_Engineer_Kim': { id: 6, username: "Prompt_Engineer_Kim", bio: "Exploring the boundaries of GPT-4 and Claude.", joined_at: '2024-05-01', stats: { saved: 0, reproductions: 0 }, saved: [] }
};

let MOCK_COMMENTS_DB = [
    { id: 1, experiment_id: 1, author: { username: 'DevRel_Kim' }, text: 'This is a great starting point! Have you tried experimenting with the temperature setting?', created_at: '2025-03-15T10:00:00Z' },
    { id: 2, experiment_id: 1, author: { username: 'AI_Architect' }, text: 'Interesting results. I wonder how this prompt performs on the latest model version.', created_at: '2025-03-15T11:30:00Z' },
    { id: 3, experiment_id: 2, author: { username: 'Dr_Prompt' }, text: 'I managed to get a similar result, but I had to tweak the preamble significantly.', created_at: '2025-03-16T09:00:00Z' },
];

const MOCK_REPRODUCTIONS_DB = [];

// --- API FUNCTIONS ---

const enrichExperiment = (experiment) => {
    if (!experiment) return null;
    const activeVersion = experiment.versions.find(v => v.version_number === experiment.active_version) || experiment.versions[0];
    return {
        ...experiment,
        ...activeVersion, // flattens prompt_text, changelog, tags, stats, created_at (version)
        original_created_at: experiment.created_at,
        stats: activeVersion.stats // ensure stats is accessible at root
    };
};

const simulateRequest = (data, success = true) => new Promise((resolve, reject) => {
    setTimeout(() => {
        if (success) {
            resolve(data);
        } else {
            reject(new Error('API request failed'));
        }
    }, LATENCY);
});

export const fetchExperimentById = (id, username) => {
    console.log(`API: Fetching experiment with id: ${id}` + (username ? ` for user: ${username}`: ''));
    const experimentRaw = MOCK_EXPERIMENTS_DB.find(exp => exp.id === parseInt(id));
    if (experimentRaw) {
        const experiment = enrichExperiment(experimentRaw);
        const reproductions = MOCK_REPRODUCTIONS_DB.filter(r => r.experiment_id === experiment.id);
        const similar = MOCK_EXPERIMENTS_DB
            .map(enrichExperiment)
            .filter(e => e.id !== experiment.id && e.tags.some(t => experiment.tags.includes(t)))
            .slice(0, 3);
        const comments = MOCK_COMMENTS_DB.filter(c => c.experiment_id === experiment.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        let isSaved = false;
        if (username) {
            const user = Object.values(MOCK_USERS_DB).find(u => u.username === username);
            if (user && user.saved?.includes(experiment.id)) {
                isSaved = true;
            }
        }

        return simulateRequest({ ...experiment, reproductions, similar, comments, isSaved });
    }
    return Promise.reject(new Error('Experiment not found'));
};

export const postComment = (experiment_id, author, text) => {
    console.log(`API: Posting comment for experiment: ${experiment_id}`);
    if (!author || !text) {
        return Promise.reject(new Error('Author and text are required.'));
    }
    const newComment = {
        id: Date.now(),
        experiment_id: parseInt(experiment_id),
        author: { username: author.username },
        text,
        created_at: new Date().toISOString(),
    };
    MOCK_COMMENTS_DB.unshift(newComment);
    return simulateRequest(newComment);
};

export const createExperiment = (experimentData, user) => {
    console.log(`API: Creating new experiment by user: ${user.username}`);
    const newId = MOCK_EXPERIMENTS_DB.length > 0 ? Math.max(...MOCK_EXPERIMENTS_DB.map(e => e.id)) + 1 : 1;

    const newExperiment = {
        id: newId,
        title: experimentData.title,
        ai_model: experimentData.ai_model,
        model_version: experimentData.model_version,
        task_type: experimentData.task_type,
        modification_guide: experimentData.modification_guide,
        author: { id: user.id, username: user.username },
        created_at: new Date().toISOString(),
        active_version: 'v1.0',
        versions: [
            {
                version_number: 'v1.0',
                prompt_text: experimentData.prompt_text,
                changelog: 'Initial release',
                tags: experimentData.tags ? experimentData.tags.split(',').map(t => t.trim()) : [],
                created_at: new Date().toISOString(),
                stats: {
                    reproduction_rate: 0,
                    reproduction_count: 0,
                    views: 0
                }
            }
        ]
    };

    MOCK_EXPERIMENTS_DB.push(newExperiment);
    return simulateRequest(enrichExperiment(newExperiment));
};

export const updateExperiment = (experimentId, newVersionData) => {
    console.log(`API: Updating experiment with id: ${experimentId}`);
    const experiment = MOCK_EXPERIMENTS_DB.find(exp => exp.id === parseInt(experimentId));

    if (!experiment) {
        return Promise.reject(new Error('Experiment not found'));
    }

    const lastVersion = experiment.versions[experiment.versions.length - 1].version_number;
    const [major, minor] = lastVersion.substring(1).split('.').map(Number);
    const newVersionNumber = `v${major}.${minor + 1}`;

    const newVersion = {
        version_number: newVersionNumber,
        prompt_text: newVersionData.prompt_text,
        changelog: newVersionData.changelog,
        tags: newVersionData.tags, // tags are already an array from react-hook-form
        created_at: new Date().toISOString(),
        stats: {
            reproduction_rate: 0,
            reproduction_count: 0,
            views: 0
        }
    };

    experiment.versions.push(newVersion);
    experiment.active_version = newVersionNumber;

    // A bit of a hack to simulate view count increase on update
    const activeVersion = experiment.versions.find(v => v.version_number === experiment.active_version);
    if(activeVersion) {
        activeVersion.stats.views = (activeVersion.stats.views || 0) + 1;
    }


    return simulateRequest(enrichExperiment(experiment));
};

export const submitVerificationReport = (experimentId, report, user) => {
    console.log(`API: Submitting verification report for experiment: ${experimentId}`);
    const newReproduction = {
        id: Date.now(),
        experiment_id: parseInt(experimentId),
        user: user.username,
        success: report.score >= 80,
        note: report.feedback,
        score: report.score,
        modified_prompt: report.modifiedContent,
        date: new Date().toISOString().split('T')[0],
        upvotes: 0,
        replies: []
    };

    MOCK_REPRODUCTIONS_DB.unshift(newReproduction);

    const experiment = MOCK_EXPERIMENTS_DB.find(e => e.id === parseInt(experimentId));
    if (experiment) {
        const activeVersion = experiment.versions.find(v => v.version_number === experiment.active_version) || experiment.versions[0];
        activeVersion.stats.reproduction_count += 1;
        const experimentReproductions = MOCK_REPRODUCTIONS_DB.filter(r => r.experiment_id === parseInt(experimentId));
        const successCount = experimentReproductions.filter(r => r.success).length;
        activeVersion.stats.reproduction_rate = Math.round((successCount / experimentReproductions.length) * 100);
    }

    return simulateRequest(newReproduction);
};

export const voteReproduction = (reproductionId, userId) => {
    console.log(`API: Voting on reproduction: ${reproductionId} by user: ${userId}`);
    const reproduction = MOCK_REPRODUCTIONS_DB.find(r => r.id === parseInt(reproductionId));
    if (reproduction) {
        reproduction.upvotes = (reproduction.upvotes || 0) + 1;
        return simulateRequest(reproduction);
    }
    return Promise.reject(new Error('Reproduction not found'));
};

export const replyToReproduction = (reproductionId, user, text) => {
    console.log(`API: Replying to reproduction: ${reproductionId}`);
    const reproduction = MOCK_REPRODUCTIONS_DB.find(r => r.id === parseInt(reproductionId));
    if (reproduction) {
        const newReply = {
            id: Date.now(),
            author: { username: user.username },
            content: text,
            timestamp: new Date().toISOString()
        };
        if (!reproduction.replies) reproduction.replies = [];
        reproduction.replies.push(newReply);
        return simulateRequest(newReply);
    }
    return Promise.reject(new Error('Reproduction not found'));
};

export const fetchExperiments = ({ page = 1, limit = 6 } = {}) => {
    console.log(`API: Fetching experiments for page: ${page}, limit: ${limit}`);
    const enrichedDB = MOCK_EXPERIMENTS_DB.map(enrichExperiment);
    const sorted = [...enrichedDB].sort((a, b) => b.stats.views - a.stats.views);
    const totalPages = Math.ceil(sorted.length / limit);
    const startIndex = (page - 1) * limit;
    const data = sorted.slice(startIndex, startIndex + limit);
    return simulateRequest({ data, pagination: { currentPage: page, totalPages, totalResults: sorted.length } });
};

export const searchExperiments = ({ query = '', model = 'All', rate = 'All', page = 1, limit = 10 } = {}) => {
    console.log(`API: Searching for experiments with query: ${query}, page: ${page}`);
    const enrichedDB = MOCK_EXPERIMENTS_DB.map(enrichExperiment);
    const filtered = enrichedDB.filter(result => {
        const queryMatch = query === '' || result.title.toLowerCase().includes(query.toLowerCase()) || result.prompt_text.toLowerCase().includes(query.toLowerCase());
        const modelMatch = model === 'All' || result.ai_model === model;
        const rateMatch = rate === 'All' || result.stats.reproduction_rate >= parseInt(rate);
        return queryMatch && modelMatch && rateMatch;
    });
    const totalPages = Math.ceil(filtered.length / limit);
    const startIndex = (page - 1) * limit;
    const data = filtered.slice(startIndex, startIndex + limit);
    return simulateRequest({ data, pagination: { currentPage: page, totalPages, totalResults: filtered.length } });
}

export const saveExperiment = (experimentId, username) => {
    console.log(`API: User ${username} is saving/unsaving experiment ${experimentId}`);
    const user = Object.values(MOCK_USERS_DB).find(u => u.username === username);

    if (!user) {
        return Promise.reject(new Error('User not found'));
    }

    if (!user.saved) {
        user.saved = [];
    }

    const experimentIdInt = parseInt(experimentId);
    const savedIndex = user.saved.indexOf(experimentIdInt);
    let isSaved;

    if (savedIndex > -1) {
        // Unsave
        user.saved.splice(savedIndex, 1);
        isSaved = false;
    } else {
        // Save
        user.saved.push(experimentIdInt);
        isSaved = true;
    }

    if (user.stats) {
        user.stats.saved = user.saved.length;
    }

    return simulateRequest({ saved: user.saved, isSaved: isSaved });
};

export const fetchMyPageData = (username) => {
    console.log(`API: Fetching MyPage data for user: ${username}`);
    const userProfile = MOCK_USERS_DB[username];
    if (!userProfile) return Promise.reject(new Error('User not found'));
    const savedPrompts = MOCK_EXPERIMENTS_DB.filter(exp => userProfile.saved?.includes(exp.id)).map(enrichExperiment);
    const reproductionHistory = MOCK_REPRODUCTIONS_DB.map(rep => ({ ...rep, target_title: MOCK_EXPERIMENTS_DB.find(e => e.id === rep.experiment_id)?.title || 'Unknown' }));
    const myExperiments = MOCK_EXPERIMENTS_DB.filter(exp => exp.author.username === username).map(enrichExperiment);
    return simulateRequest({ userProfile, savedPrompts, reproductionHistory, myExperiments });
}

export const getUserByUsername = (username) => {
    console.log(`API: Fetching user profile for: ${username}`);
    const profile = Object.values(MOCK_USERS_DB).find(u => u.username === username);
    if (!profile) return Promise.reject(new Error('User not found'));

    const experiments = MOCK_EXPERIMENTS_DB.filter(e => e.author.username === username).map(enrichExperiment);
    return simulateRequest({ profile, experiments });
}