const router = require('express').Router();
const { pool } = require('../config/postgres');
const { query, body } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/validator');
const checkLogin = require('../middlewares/checkLogin');
const { uploadS3 } = require('../middlewares/upload');
const { findModifyUserAllByGameIdx } = require('../service/user.service');
const {
    getGameByIdx,
    requestGame,
    getGameWithPostNumber,
    getGameAllWithTitle,
    getGameByTitle,
} = require('../service/game.service');
const {
    createHistory,
    updateHistoryByGameIdx,
    getCurrentHistoryByGameIdx,
    getHistory,
    getHistoryAllByGameIdx,
} = require('../service/history.service');
//게임생성요청
router.post(
    '/request',
    checkLogin,
    body('title').trim().isLength({ min: 2 }).withMessage('2글자이상입력해주세요'),
    handleValidationErrors,
    async (req, res, next) => {
        const { title } = req.body;
        const { userIdx } = req.decoded;
        try {
            await requestGame({ title, userIdx });

            res.status(200).send();
        } catch (e) {
            next(e);
        }
    }
);

//게임목록불러오기
router.get('/all', async (req, res, next) => {
    let { page } = req.query;

    try {
        //20개씩 불러오기
        const {
            gameList,
            meta: { totalCount },
        } = await getGameAllWithTitle({ page });

        res.status(200).send({
            data: {
                totalCount: totalCount,
                page: page,
                gameList: gameList,
            },
        });
    } catch (e) {
        next(e);
    }
});

//게임검색하기
router.get(
    '/search',
    query('title').trim().isLength({ min: 2 }).withMessage('2글자 이상입력해주세요'),
    handleValidationErrors,
    async (req, res, next) => {
        const { title } = req.query;
        try {
            const { gameList } = await getGameByTitle({ title });

            if (!gameList || gameList.length == 0) {
                return res.status(204).send();
            }

            res.status(200).send({
                data: gameList,
            });
        } catch (e) {
            next(e);
        }
    }
);

//인기게임목록불러오기(게시글순)
router.get('/popular', async (req, res, next) => {
    const { page } = req.query || 1;
    try {
        //게시글 수가 많은 게임 순서대로 게임 idx, 제목, 이미지경로 추출
        const {
            gameList,
            meta: { totalCount },
        } = await getGameWithPostNumber({ page });

        res.status(200).send({
            data: {
                totalCount: totalCount,
                page: page,
                gameList: gameList,
            },
        });
    } catch (e) {
        next(e);
    }
});
//배너이미지가져오기
router.get('/:gameidx/banner', async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    try {
        const { game } = await getGameByIdx({ gameIdx });
        console.log('banner: ', game);

        res.status(200).send({
            data: {
                imgPath: game.banner,
            },
        });
    } catch (e) {
        next(e);
    }
});

//히스토리 목록보기
router.get('/:gameidx/history/all', async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    try {
        //특정게임 히스토리목록 최신순으로 출력
        const historyList = await getHistoryAllByGameIdx({ gameIdx });

        res.status(200).send({ data: historyList });
    } catch (e) {
        next(e);
    }
});

//히스토리 자세히보기
router.get('/:gameidx/history/:historyidx?', async (req, res, next) => {
    let historyIdx = req.params.historyidx;
    const gameIdx = req.params.gameidx;
    try {
        const history = await getHistory({ historyIdx, gameIdx });

        res.status(200).send({ data: history });
    } catch (e) {
        next(e);
    }
});

//게임 자세히보기
router.get('/:gameidx/wiki', async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    try {
        const history = await getCurrentHistoryByGameIdx({ gameIdx });

        res.status(200).send({ data: history });
    } catch (e) {
        next(e);
    }
});

//게임 수정하기
router.put(
    '/:gameidx/wiki/:historyidx',
    checkLogin,
    body('content').trim().isLength({ min: 2 }).withMessage('2글자이상 입력해주세요'),
    handleValidationErrors,
    async (req, res, next) => {
        // HTTP 통신 처리하는 곳
        const gameIdx = req.params.gameidx;
        const { content } = req.body;

        // 비즈니스 로직 실행 던지고
        await updateHistoryByGameIdx({
            gameIdx,
            userIdx,
            content,
        });

        // 응답
        res.status(200).send();
    }
);
// 임시위키생성
router.post('/:gameidx/wiki', checkLogin, async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    const { userIdx } = req.decoded;
    try {
        const makeTemporaryHistorySQLResult = await pool.query(
            `INSERT INTO 
                history(game_idx, user_idx, created_at)
            VALUES
                ( $1, $2, null)
            RETURNING
                idx`,
            [gameIdx, userIdx]
        );

        const temporaryHistory = makeTemporaryHistorySQLResult.rows[0];
        const temporaryHistoryIdx = temporaryHistory.idx;
        //기존 게임내용 불러오기
        const getLatestHistorySQLResult = await pool.query(
            `SELECT 
                g.title, h.content
            FROM 
                history h 
            JOIN 
                game g 
            ON 
                h.game_idx = g.idx 
            WHERE 
                h.game_idx = $1
            AND
                h.created_at IS NOT NULL 
            ORDER BY 
                h.created_at DESC 
            limit 
                1;`,
            [gameIdx]
        );
        const latestHistory = getLatestHistorySQLResult.rows[0];

        res.status(201).send({
            data: {
                historyIdx: temporaryHistoryIdx,
                title: latestHistory.title,
                content: latestHistory.content,
            },
        });
    } catch (e) {
        next(e);
    }
});
// 위키 이미지 업로드
router.post(
    '/:gameidx/wiki/:historyidx/image',
    checkLogin,
    uploadS3.array('images', 1),
    async (req, res, next) => {
        const historyIdx = req.params.historyidx;
        try {
            const location = req.files[0].location;
            console.log(location);

            await pool.query(
                `INSERT INTO
                    game_img( history_idx, img_path )
                VALUES ( $1, $2 ) `,
                [historyIdx, location]
            );

            res.status(200).send({ data: location });
        } catch (e) {
            next(e);
        }
    }
);

module.exports = router;
