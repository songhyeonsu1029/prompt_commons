/* eslint-env node */

import { createExperiment, fetchExperimentById, postComment } from './src/services/api.js';

const runTest = async () => {
    try {
        console.log('--- Starting Test ---');

        // 1. Create user
        const user = { id: 1, username: 'TestUser' };

        // 2. Create experiment
        const expData = {
            title: 'Test Experiment',
            ai_model: 'GPT-4',
            model_version: 'v1',
            task_type: 'Generation',
            prompt_text: 'Hello',
            tags: 'test'
        };
        const newExp = await createExperiment(expData, user);
        console.log('Experiment created:', newExp.id);

        // 3. Fetch experiment
        let fetchedExp = await fetchExperimentById(newExp.id);
        console.log('Initial comments:', fetchedExp.comments);

        // 4. Post comment
        await postComment(newExp.id, user, 'This is a test comment');
        console.log('Comment posted');

        // 5. Fetch experiment again
        fetchedExp = await fetchExperimentById(newExp.id);
        console.log('Comments after post:', fetchedExp.comments);

        if (fetchedExp.comments.length === 1 && fetchedExp.comments[0].text === 'This is a test comment') {
            console.log('SUCCESS: Comment found.');
        } else {
            console.error('FAILURE: Comment not found.');
        }

        // 6. Test displayData logic
        const selectedVersion = 'v1.0';
        const displayData = fetchedExp.versions.find(v => v.version_number === selectedVersion) ?
            { ...fetchedExp, ...fetchedExp.versions.find(v => v.version_number === selectedVersion), stats: fetchedExp.versions.find(v => v.version_number === selectedVersion).stats }
            : fetchedExp;

        console.log('DisplayData comments:', displayData.comments);
        if (displayData.comments.length === 1) {
            console.log('SUCCESS: DisplayData preserved comments.');
        } else {
            console.error('FAILURE: DisplayData lost comments.');
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
};

runTest();
