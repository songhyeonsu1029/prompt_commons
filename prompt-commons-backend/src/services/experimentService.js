const prisma = require('../utils/prisma');
const { ApiError } = require('../middlewares/errorHandler');
const {
    indexExperiment,
    deleteExperiment: deleteFromES,
    updateExperiment: updateInES,
    semanticSearch,
    syncAllExperiments
} = require('./elasticsearchService');

class ExperimentService {
    /**
     * 주간 인기 실험 Top 10 조회
     */
    async getWeeklyTopExperiments() {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const experiments = await prisma.experiment.findMany({
            where: {
                createdAt: {
                    gte: oneWeekAgo
                }
            },
            include: {
                author: {
                    select: { username: true }
                },
                activeVersion: {
                    select: {
                        versionNumber: true,
                        aiModel: true,
                        modelVersion: true,
                        reproductionRate: true,
                        reproductionCount: true,
                        viewCount: true,
                        promptText: true,
                        tags: {
                            select: { tagName: true }
                        }
                    }
                }
            }
        });

        const experimentsWithScore = experiments.map(exp => {
            const version = exp.activeVersion || {};
            const views = version.viewCount || 0;
            const rate = version.reproductionRate || 0;
            const count = version.reproductionCount || 0;
            const popularityScore = (views * 1) + (rate * 2) + (count * 5);
            const tags = version.tags ? version.tags.map(t => t.tagName) : [];

            return {
                id: exp.id.toString(),
                title: exp.title,
                author: { username: exp.author.username },
                version_number: version.versionNumber || 'v1.0',
                ai_model: version.aiModel || 'Unknown',
                model_version: version.modelVersion,
                prompt_text: version.promptText || '',
                reproduction_rate: version.reproductionRate || 0,
                reproduction_count: version.reproductionCount || 0,
                views: version.viewCount || 0,
                tags: tags,
                created_at: exp.createdAt.toISOString(),
                popularity_score: popularityScore
            };
        });

        return experimentsWithScore
            .sort((a, b) => b.popularity_score - a.popularity_score)
            .slice(0, 10);
    }

    /**
     * 실험 목록 조회 (최신순, 페이지네이션)
     */
    async getExperiments({ page = 1, limit = 6 }) {
        const skip = (page - 1) * limit;

        const experiments = await prisma.experiment.findMany({
            skip: skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                author: {
                    select: { username: true }
                },
                activeVersion: {
                    select: {
                        versionNumber: true,
                        aiModel: true,
                        modelVersion: true,
                        reproductionRate: true,
                        reproductionCount: true,
                        viewCount: true,
                        promptText: true,
                        tags: {
                            select: { tagName: true }
                        }
                    }
                }
            }
        });

        const totalCount = await prisma.experiment.count();

        const formattedExperiments = experiments.map(exp => {
            const version = exp.activeVersion || {};
            const tags = version.tags ? version.tags.map(t => t.tagName) : [];

            return {
                id: exp.id.toString(),
                title: exp.title,
                author: { username: exp.author.username },
                version_number: version.versionNumber || 'v1.0',
                ai_model: version.aiModel || 'Unknown',
                model_version: version.modelVersion,
                prompt_text: version.promptText || '',
                reproduction_rate: version.reproductionRate || 0,
                reproduction_count: version.reproductionCount || 0,
                views: version.viewCount || 0,
                tags: tags,
                created_at: exp.createdAt.toISOString()
            };
        });

        return {
            data: formattedExperiments,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalCount / limit),
                totalResults: totalCount
            }
        };
    }

    /**
     * 실험 검색 (Elasticsearch + Gemini Embedding)
     */
    async searchExperiments({ query, tag, model, rate, page = 1, limit = 20 }) {
        if ((!query || query.trim().length === 0) && !tag) {
            return {
                data: [],
                pagination: {
                    currentPage: page,
                    totalPages: 0,
                    totalResults: 0
                },
                message: '검색어를 입력해주세요.'
            };
        }

        const esResult = await semanticSearch({
            query: query ? query.trim() : '',
            tag: tag,
            model: model,
            minRate: rate,
            page: page,
            limit: limit
        });

        if (!esResult.success) {
            throw new ApiError(503, '검색 서비스에 일시적인 문제가 발생했습니다.', esResult.error);
        }

        if (esResult.data.length === 0) {
            return {
                data: [],
                pagination: {
                    currentPage: page,
                    totalPages: 0,
                    totalResults: 0
                },
                message: '검색 결과가 없습니다.'
            };
        }

        const experimentIds = esResult.data.map(r => BigInt(r.id));

        const experiments = await prisma.experiment.findMany({
            where: { id: { in: experimentIds } },
            include: {
                author: { select: { username: true } },
                activeVersion: {
                    select: {
                        versionNumber: true,
                        aiModel: true,
                        promptText: true,
                        reproductionRate: true,
                        reproductionCount: true,
                        viewCount: true,
                        tags: { select: { tagName: true } }
                    }
                }
            }
        });

        const experimentMap = new Map(experiments.map(e => [e.id.toString(), e]));
        const orderedExperiments = esResult.data
            .map(r => experimentMap.get(String(r.id)))
            .filter(Boolean);

        const formattedResults = orderedExperiments.map((exp, idx) => {
            const version = exp.activeVersion || {};
            return {
                id: exp.id.toString(),
                title: exp.title,
                author: { username: exp.author.username },
                ai_model: version.aiModel || 'Unknown',
                prompt_text: version.promptText || '',
                reproduction_rate: version.reproductionRate || 0,
                reproduction_count: version.reproductionCount || 0,
                views: version.viewCount || 0,
                tags: version.tags?.map(t => t.tagName) || [],
                created_at: exp.createdAt.toISOString(),
                similarity_score: esResult.data[idx]?.score
            };
        });

        return {
            data: formattedResults,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(esResult.total / limit),
                totalResults: esResult.total
            }
        };
    }

    /**
     * Elasticsearch 동기화
     */
    async syncExperiments() {
        const result = await syncAllExperiments();
        if (!result.success) {
            throw new ApiError(500, 'Elasticsearch sync failed.', result.error);
        }
        return result;
    }

    /**
     * 새 실험 생성
     */
    async createExperiment(userId, username, data) {
        const {
            title,
            ai_model,
            model_version,
            task_type,
            prompt_text,
            modification_guide,
            description,
            tags
        } = data;

        if (!title || !prompt_text) {
            throw new ApiError(400, '제목과 프롬프트 텍스트는 필수입니다.');
        }

        if (!ai_model) {
            throw new ApiError(400, 'AI 모델은 필수입니다.');
        }

        let tagList = [];
        if (tags) {
            if (typeof tags === 'string') {
                tagList = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
            } else if (Array.isArray(tags)) {
                tagList = tags;
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const experiment = await tx.experiment.create({
                data: {
                    authorId: BigInt(userId),
                    title: title,
                    taskType: task_type || null,
                }
            });

            const firstVersion = await tx.experimentVersion.create({
                data: {
                    experimentId: experiment.id,
                    versionNumber: 'v1.0',
                    promptText: prompt_text,
                    aiModel: ai_model,
                    modelVersion: model_version || null,
                    promptDescription: description || null,
                    modificationGuide: modification_guide || null,
                    changelog: 'Initial release',
                    reproductionRate: 0,
                    reproductionCount: 0,
                    viewCount: 0
                }
            });

            if (tagList.length > 0) {
                await tx.experimentTag.createMany({
                    data: tagList.map(tagName => ({
                        versionId: firstVersion.id,
                        tagName: tagName
                    }))
                });
            }

            await tx.experiment.update({
                where: { id: experiment.id },
                data: { activeVersionId: firstVersion.id }
            });

            return { experiment, firstVersion };
        });

        indexExperiment({
            id: result.experiment.id.toString(),
            title: title,
            description: description || '',
            promptText: prompt_text,
            aiModel: ai_model,
            reproductionRate: 0,
            tags: tagList,
            createdAt: result.experiment.createdAt
        }).catch(err => {
            console.error('[Experiment Create] ES indexing failed:', err.message);
        });

        return {
            id: result.experiment.id.toString(),
            title: result.experiment.title,
            task_type: result.experiment.taskType,
            author: {
                id: userId,
                username: username
            },
            created_at: result.experiment.createdAt.toISOString(),
            active_version: 'v1.0',
            version_number: 'v1.0',
            ai_model: ai_model,
            model_version: model_version,
            prompt_text: prompt_text,
            prompt_description: description,
            modification_guide: modification_guide,
            tags: tagList,
            stats: {
                reproduction_rate: 0,
                reproduction_count: 0,
                views: 0
            },
            versions: [{
                version_number: 'v1.0',
                prompt_text: prompt_text,
                prompt_description: description,
                modification_guide: modification_guide,
                changelog: 'Initial release',
                tags: tagList,
                created_at: result.firstVersion.createdAt.toISOString(),
                stats: {
                    reproduction_rate: 0,
                    reproduction_count: 0,
                    views: 0
                }
            }],
            comments: [],
            reproductions: [],
            similar: []
        };
    }

    /**
     * 실험 상세 조회
     */
    async getExperimentById(id, version, userId) {
        const experiment = await prisma.experiment.findUnique({
            where: { id: BigInt(id) },
            include: {
                author: {
                    select: { id: true, username: true }
                },
                versions: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        tags: { select: { tagName: true } }
                    }
                },
                activeVersion: {
                    include: {
                        tags: { select: { tagName: true } }
                    }
                },
                comments: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        author: { select: { username: true } }
                    }
                },
                reproductions: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        verifier: { select: { username: true } },
                        version: { select: { versionNumber: true } },
                        upvotes: true,
                        replies: {
                            orderBy: { createdAt: 'asc' },
                            include: {
                                author: { select: { username: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!experiment) {
            throw new ApiError(404, '실험을 찾을 수 없습니다.');
        }

        let targetVersion;
        if (version) {
            targetVersion = experiment.versions.find(v => v.versionNumber === version);
            if (!targetVersion) {
                throw new ApiError(404, `버전 ${version}을 찾을 수 없습니다.`);
            }
        } else {
            targetVersion = experiment.activeVersion || experiment.versions[experiment.versions.length - 1];
        }

        if (targetVersion) {
            await prisma.experimentVersion.update({
                where: { id: targetVersion.id },
                data: { viewCount: { increment: 1 } }
            });
            targetVersion.viewCount += 1;
        }

        let isSaved = false;
        if (userId) {
            const savedRecord = await prisma.savedExperiment.findUnique({
                where: {
                    userId_experimentId: {
                        userId: BigInt(userId),
                        experimentId: BigInt(id)
                    }
                }
            });
            isSaved = !!savedRecord;
        }

        const currentTags = targetVersion?.tags?.map(t => t.tagName) || [];
        let similarExperiments = [];
        if (currentTags.length > 0) {
            similarExperiments = await prisma.experiment.findMany({
                where: {
                    id: { not: experiment.id },
                    versions: {
                        some: {
                            tags: {
                                some: {
                                    tagName: { in: currentTags }
                                }
                            }
                        }
                    }
                },
                take: 3,
                include: {
                    activeVersion: {
                        select: {
                            reproductionRate: true,
                            tags: { select: { tagName: true } }
                        }
                    }
                }
            });
        }

        const formattedVersions = experiment.versions.map(v => ({
            version_number: v.versionNumber,
            prompt_text: v.promptText,
            prompt_description: v.promptDescription,
            modification_guide: v.modificationGuide,
            changelog: v.changelog,
            tags: v.tags.map(t => t.tagName),
            created_at: v.createdAt.toISOString(),
            stats: {
                reproduction_rate: v.reproductionRate || 0,
                reproduction_count: v.reproductionCount || 0,
                views: v.viewCount || 0
            }
        }));

        const formattedComments = experiment.comments.map(c => ({
            id: c.id.toString(),
            experiment_id: experiment.id.toString(),
            author: { username: c.author.username },
            text: c.content,
            created_at: c.createdAt.toISOString()
        }));

        const formattedReproductions = experiment.reproductions.map(r => ({
            id: r.id.toString(),
            experiment_id: experiment.id.toString(),
            version_number: r.version?.versionNumber || 'v1.0',
            user: r.verifier.username,
            success: r.success,
            note: r.note,
            score: r.score,
            modified_prompt: r.modifiedPrompt,
            date: r.createdAt.toISOString().split('T')[0],
            upvotes: r.upvotes.length,
            replies: r.replies.map(reply => ({
                id: reply.id.toString(),
                author: { username: reply.author.username },
                content: reply.content,
                timestamp: reply.createdAt.toISOString()
            }))
        }));

        const formattedSimilar = similarExperiments.map(s => ({
            id: s.id.toString(),
            title: s.title,
            reproduction_rate: s.activeVersion?.reproductionRate || 0,
            tags: s.activeVersion?.tags?.map(t => t.tagName) || []
        }));

        return {
            id: experiment.id.toString(),
            title: experiment.title,
            task_type: experiment.taskType,
            author: {
                id: experiment.author.id.toString(),
                username: experiment.author.username
            },
            created_at: experiment.createdAt.toISOString(),
            active_version: experiment.activeVersion?.versionNumber || 'v1.0',
            versions: formattedVersions,
            version_number: targetVersion?.versionNumber,
            ai_model: targetVersion?.aiModel,
            model_version: targetVersion?.modelVersion,
            prompt_text: targetVersion?.promptText,
            prompt_description: targetVersion?.promptDescription,
            modification_guide: targetVersion?.modificationGuide,
            changelog: targetVersion?.changelog,
            tags: targetVersion?.tags?.map(t => t.tagName) || [],
            stats: {
                reproduction_rate: targetVersion?.reproductionRate || 0,
                reproduction_count: targetVersion?.reproductionCount || 0,
                views: targetVersion?.viewCount || 0
            },
            comments: formattedComments,
            reproductions: formattedReproductions,
            similar: formattedSimilar,
            isSaved
        };
    }

    /**
     * 새 버전 배포
     */
    async createVersion(id, userId, data) {
        const {
            version_number,
            prompt_text,
            prompt_description,
            modification_guide,
            changelog,
            ai_model,
            model_version,
            tags
        } = data;

        const experiment = await prisma.experiment.findUnique({
            where: { id: BigInt(id) },
            include: {
                author: { select: { id: true } },
                activeVersion: {
                    include: { tags: { select: { tagName: true } } }
                }
            }
        });

        if (!experiment) {
            throw new ApiError(404, '실험을 찾을 수 없습니다.');
        }

        if (experiment.author.id.toString() !== userId) {
            throw new ApiError(403, '본인의 실험만 수정할 수 있습니다.');
        }

        if (!version_number || !prompt_text) {
            throw new ApiError(400, '버전 번호와 프롬프트 텍스트는 필수입니다.');
        }

        await prisma.$transaction(async (tx) => {
            const newVersion = await tx.experimentVersion.create({
                data: {
                    experimentId: experiment.id,
                    versionNumber: version_number,
                    promptText: prompt_text,
                    promptDescription: prompt_description || null,
                    modificationGuide: modification_guide || null,
                    changelog: changelog || null,
                    aiModel: ai_model || experiment.activeVersion?.aiModel,
                    modelVersion: model_version || experiment.activeVersion?.modelVersion,
                    reproductionRate: 0,
                    reproductionCount: 0,
                    viewCount: 0
                }
            });

            const tagsToCreate = tags && tags.length > 0
                ? tags
                : experiment.activeVersion?.tags?.map(t => t.tagName) || [];

            if (tagsToCreate.length > 0) {
                await tx.experimentTag.createMany({
                    data: tagsToCreate.map(tagName => ({
                        versionId: newVersion.id,
                        tagName: tagName
                    }))
                });
            }

            await tx.experiment.update({
                where: { id: experiment.id },
                data: { activeVersionId: newVersion.id }
            });
        });

        // Return full experiment details using existing method
        return this.getExperimentById(id, null, userId);
    }

    /**
     * 댓글 작성
     */
    async createComment(experimentId, userId, text) {
        if (!text || text.trim().length === 0) {
            throw new ApiError(400, '댓글 내용을 입력해주세요.');
        }

        const experiment = await prisma.experiment.findUnique({
            where: { id: BigInt(experimentId) }
        });

        if (!experiment) {
            throw new ApiError(404, '실험을 찾을 수 없습니다.');
        }

        const comment = await prisma.comment.create({
            data: {
                experimentId: BigInt(experimentId),
                authorId: BigInt(userId),
                content: text.trim()
            },
            include: {
                author: { select: { username: true } }
            }
        });

        return {
            id: comment.id.toString(),
            experiment_id: experimentId,
            author: { username: comment.author.username },
            text: comment.content,
            created_at: comment.createdAt.toISOString()
        };
    }

    /**
     * 댓글 삭제
     */
    async deleteComment(commentId, userId) {
        const comment = await prisma.comment.findUnique({
            where: { id: BigInt(commentId) },
            include: { author: { select: { id: true } } }
        });

        if (!comment) {
            throw new ApiError(404, '댓글을 찾을 수 없습니다.');
        }

        if (comment.author.id.toString() !== userId) {
            throw new ApiError(403, '본인의 댓글만 삭제할 수 있습니다.');
        }

        await prisma.comment.delete({
            where: { id: BigInt(commentId) }
        });

        return { message: '댓글이 삭제되었습니다.' };
    }

    /**
     * 재현 검증 제출
     */
    async createReproduction(experimentId, userId, data) {
        const {
            version_number,
            modifiedContent,
            score,
            feedback
        } = data;

        const experiment = await prisma.experiment.findUnique({
            where: { id: BigInt(experimentId) },
            include: {
                versions: true,
                activeVersion: true
            }
        });

        if (!experiment) {
            throw new ApiError(404, '실험을 찾을 수 없습니다.');
        }

        let targetVersion = experiment.activeVersion;
        if (version_number) {
            targetVersion = experiment.versions.find(v => v.versionNumber === version_number);
            if (!targetVersion) {
                throw new ApiError(404, `버전 ${version_number}을 찾을 수 없습니다.`);
            }
        }

        if (score === undefined || score === null) {
            throw new ApiError(400, '점수는 필수입니다.');
        }

        const reproduction = await prisma.reproduction.create({
            data: {
                experimentId: BigInt(experimentId),
                versionId: targetVersion.id,
                verifierId: BigInt(userId),
                success: score >= 80,
                score: score,
                note: feedback || null,
                modifiedPrompt: modifiedContent || null
            },
            include: {
                verifier: { select: { username: true } },
                version: { select: { versionNumber: true } }
            }
        });

        const versionReproductions = await prisma.reproduction.findMany({
            where: { versionId: targetVersion.id },
            select: { score: true, success: true }
        });

        const totalCount = versionReproductions.length;
        let reproductionRate = 0;

        if (totalCount > 0) {
            const totalScore = versionReproductions.reduce((sum, r) => sum + r.score, 0);
            const averageScore = totalScore / totalCount;
            const successCount = versionReproductions.filter(r => r.success).length;
            const successRate = (successCount / totalCount) * 100;
            const weightedScore = (averageScore * 0.7) + (successRate * 0.3);
            reproductionRate = Math.round(weightedScore);
        }

        await prisma.experimentVersion.update({
            where: { id: targetVersion.id },
            data: {
                reproductionCount: totalCount,
                reproductionRate: reproductionRate
            }
        });

        if (targetVersion.id === experiment.activeVersionId) {
            const fullExperiment = await prisma.experiment.findUnique({
                where: { id: BigInt(experimentId) },
                include: {
                    activeVersion: {
                        include: { tags: { select: { tagName: true } } }
                    }
                }
            });

            if (fullExperiment?.activeVersion) {
                updateInES({
                    id: fullExperiment.id.toString(),
                    title: fullExperiment.title,
                    description: fullExperiment.activeVersion.promptDescription || '',
                    promptText: fullExperiment.activeVersion.promptText || '',
                    aiModel: fullExperiment.activeVersion.aiModel || '',
                    reproductionRate: reproductionRate,
                    tags: fullExperiment.activeVersion.tags?.map(t => t.tagName) || [],
                    createdAt: fullExperiment.createdAt
                }).catch(err => {
                    console.error('[Reproduction Submit] ES update failed:', err.message);
                });
            }
        }

        return {
            id: reproduction.id.toString(),
            experiment_id: experimentId,
            version_number: reproduction.version.versionNumber,
            user: reproduction.verifier.username,
            success: reproduction.success,
            score: reproduction.score,
            note: reproduction.note,
            modified_prompt: reproduction.modifiedPrompt,
            date: reproduction.createdAt.toISOString().split('T')[0],
            upvotes: 0,
            replies: []
        };
    }

    /**
     * 재현 좋아요 토글
     */
    async voteReproduction(reproductionId, userId) {
        const reproduction = await prisma.reproduction.findUnique({
            where: { id: BigInt(reproductionId) }
        });

        if (!reproduction) {
            throw new ApiError(404, '재현 기록을 찾을 수 없습니다.');
        }

        const existingUpvote = await prisma.reproductionUpvote.findUnique({
            where: {
                reproductionId_userId: {
                    reproductionId: BigInt(reproductionId),
                    userId: BigInt(userId)
                }
            }
        });

        let action;
        if (existingUpvote) {
            await prisma.reproductionUpvote.delete({
                where: { id: existingUpvote.id }
            });
            action = 'removed';
        } else {
            await prisma.reproductionUpvote.create({
                data: {
                    reproductionId: BigInt(reproductionId),
                    userId: BigInt(userId)
                }
            });
            action = 'added';
        }

        const upvoteCount = await prisma.reproductionUpvote.count({
            where: { reproductionId: BigInt(reproductionId) }
        });

        return {
            id: reproductionId,
            upvotes: upvoteCount,
            action: action
        };
    }

    /**
     * 재현 답글 작성
     */
    async replyReproduction(reproductionId, userId, content) {
        if (!content || content.trim().length === 0) {
            throw new ApiError(400, '답글 내용을 입력해주세요.');
        }

        const reproduction = await prisma.reproduction.findUnique({
            where: { id: BigInt(reproductionId) }
        });

        if (!reproduction) {
            throw new ApiError(404, '재현 기록을 찾을 수 없습니다.');
        }

        const reply = await prisma.reproductionReply.create({
            data: {
                reproductionId: BigInt(reproductionId),
                authorId: BigInt(userId),
                content: content.trim()
            },
            include: {
                author: { select: { username: true } }
            }
        });

        return {
            id: reply.id.toString(),
            author: { username: reply.author.username },
            content: reply.content,
            timestamp: reply.createdAt.toISOString()
        };
    }

    /**
     * 실험 저장/북마크 토글
     */
    async toggleSaveExperiment(experimentId, userId) {
        const experiment = await prisma.experiment.findUnique({
            where: { id: BigInt(experimentId) }
        });

        if (!experiment) {
            throw new ApiError(404, '실험을 찾을 수 없습니다.');
        }

        const existingSave = await prisma.savedExperiment.findUnique({
            where: {
                userId_experimentId: {
                    userId: BigInt(userId),
                    experimentId: BigInt(experimentId)
                }
            }
        });

        let isSaved;
        if (existingSave) {
            await prisma.savedExperiment.delete({
                where: {
                    userId_experimentId: {
                        userId: BigInt(userId),
                        experimentId: BigInt(experimentId)
                    }
                }
            });
            isSaved = false;
        } else {
            await prisma.savedExperiment.create({
                data: {
                    userId: BigInt(userId),
                    experimentId: BigInt(experimentId)
                }
            });
            isSaved = true;
        }

        const savedExperiments = await prisma.savedExperiment.findMany({
            where: { userId: BigInt(userId) },
            select: { experimentId: true }
        });

        return {
            isSaved,
            saved: savedExperiments.map(s => s.experimentId.toString())
        };
    }

    /**
     * 실험 삭제
     */
    async deleteExperiment(experimentId, userId) {
        const experiment = await prisma.experiment.findUnique({
            where: { id: BigInt(experimentId) },
            include: { author: { select: { id: true } } }
        });

        if (!experiment) {
            throw new ApiError(404, '실험을 찾을 수 없습니다.');
        }

        if (experiment.author.id.toString() !== userId) {
            throw new ApiError(403, '본인의 실험만 삭제할 수 있습니다.');
        }

        await prisma.experiment.delete({
            where: { id: BigInt(experimentId) }
        });

        // Assuming deleteFromES is defined elsewhere and imported
        // For example: import { deleteFromES } from '../utils/elasticsearch';
        deleteFromES(experimentId).catch(err => {
            console.error('[Experiment Delete] ES delete failed:', err.message);
        });

        return { message: '실험이 삭제되었습니다.' };
    }

    /**
     * 실험 기본 정보 수정
     */
    async updateExperiment(experimentId, userId, data) {
        const { title, task_type } = data;

        const experiment = await prisma.experiment.findUnique({
            where: { id: BigInt(experimentId) },
            include: { author: { select: { id: true } } }
        });

        if (!experiment) {
            throw new ApiError(404, '실험을 찾을 수 없습니다.');
        }

        if (experiment.author.id.toString() !== userId) {
            throw new ApiError(403, '본인의 실험만 수정할 수 있습니다.');
        }

        const updated = await prisma.experiment.update({
            where: { id: BigInt(experimentId) },
            data: {
                ...(title && { title }),
                ...(task_type && { taskType: task_type })
            },
            include: {
                author: { select: { id: true, username: true } }
            }
        });

        return {
            id: updated.id.toString(),
            title: updated.title,
            task_type: updated.taskType,
            author: {
                id: updated.author.id.toString(),
                username: updated.author.username
            }
        };
    }
}

module.exports = new ExperimentService();
