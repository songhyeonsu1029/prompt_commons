const experimentService = require('../services/experimentService');
const { asyncHandler } = require('../middlewares/errorHandler');

exports.getWeeklyTop = asyncHandler(async (req, res) => {
    const data = await experimentService.getWeeklyTopExperiments();
    res.json({
        data,
        count: data.length
    });
});

exports.getExperiments = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const result = await experimentService.getExperiments({ page, limit });
    res.json(result);
});

exports.searchExperiments = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 20);
    const query = req.query.q || '';
    const tag = req.query.tag;
    const model = req.query.model;
    const rate = parseInt(req.query.rate) || 0;

    try {
        const result = await experimentService.searchExperiments({
            query,
            tag,
            model,
            rate,
            page,
            limit
        });
        res.json(result);
    } catch (error) {
        console.warn('[Search] Elasticsearch unavailable:', error.message);
        res.json({
            data: [],
            pagination: {
                currentPage: page,
                totalPages: 0,
                totalResults: 0
            },
            message: '검색 서비스를 일시적으로 사용할 수 없습니다.'
        });
    }
});

exports.syncExperiments = asyncHandler(async (req, res) => {
    console.log(`[API] Sync triggered by user ${req.user.username}`);
    try {
        const result = await experimentService.syncExperiments();
        res.json({
            message: 'Elasticsearch sync completed successfully.',
            stats: {
                total: result.totalCount,
                synced: result.syncedCount,
                errors: result.errorCount
            }
        });
    } catch (error) {
        console.warn('[Sync] Elasticsearch unavailable:', error.message);
        res.status(503).json({
            message: 'Elasticsearch sync is disabled in this environment.'
        });
    }
});

exports.createExperiment = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const username = req.user.username;
    const result = await experimentService.createExperiment(userId, username, req.body);
    res.status(201).json(result);
});

exports.getExperimentById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { version } = req.query;
    const userId = req.user?.id;
    const result = await experimentService.getExperimentById(id, version, userId);
    res.json(result);
});

exports.createVersion = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await experimentService.createVersion(id, userId, req.body);
    res.status(201).json(result);
});

exports.createComment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { text } = req.body;
    const result = await experimentService.createComment(id, userId, text);
    res.status(201).json(result);
});

exports.deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;
    const result = await experimentService.deleteComment(commentId, userId);
    res.json(result);
});

exports.createReproduction = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await experimentService.createReproduction(id, userId, req.body);
    res.status(201).json(result);
});

exports.voteReproduction = asyncHandler(async (req, res) => {
    const { reproductionId } = req.params;
    const userId = req.user.id;
    const result = await experimentService.voteReproduction(reproductionId, userId);
    res.json(result);
});

exports.replyReproduction = asyncHandler(async (req, res) => {
    const { reproductionId } = req.params;
    const userId = req.user.id;
    const { content } = req.body;
    const result = await experimentService.replyReproduction(reproductionId, userId, content);
    res.status(201).json(result);
});

exports.toggleSaveExperiment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await experimentService.toggleSaveExperiment(id, userId);
    res.json(result);
});

exports.deleteExperiment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await experimentService.deleteExperiment(id, userId);
    res.json(result);
});

exports.updateExperiment = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await experimentService.updateExperiment(id, userId, req.body);
    res.json(result);
});
