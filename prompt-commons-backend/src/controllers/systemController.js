const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getSystemInfo = (req, res) => {
    res.json({
        name: 'Prompt Commons API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            experiments: '/api/experiments'
        }
    });
};

exports.healthCheck = (req, res) => {
    res.json({ status: 'OK', message: 'Server is running smoothly' });
};

exports.testDbConnection = async (req, res) => {
    try {
        // DB에 쿼리 날려보기 (간단한 연산)
        const result = await prisma.$queryRaw`SELECT 1 + 1 AS result`;
        res.json({
            message: 'Database connection successful!',
            result: Number(result[0].result) // BigInt 처리
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database connection failed', details: error.message });
    }
};
