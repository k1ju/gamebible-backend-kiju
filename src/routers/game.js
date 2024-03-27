const router = require('express').Router();
const { pool } = require('../config/postgres');
const { query, body } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/validator');
const checkLogin = require('../middlewares/checkLogin');
const { generateNotification, generateNotifications } = require('../modules/generateNotification');
const { findModifyUserAllByGameIdx } = require('../service/user.service');
const { getCurrentBannerByGameIdx } = require('../service/game.service');
const {
    createHistory,
    updateHistoryByGameIdx,
    getCurrentHistoryByGameIdx,
    getHistory,
    getHistoryListByGameIdx,
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
            const sql = `
        INSERT INTO 
            request(user_idx, title) 
        VALUES 
            ( $1 ,$2 ) `;
            const values = [userIdx, title];
            await pool.query(sql, values);

            res.status(200).send();
        } catch (e) {
            next(e);
        }
    }
);

//게임목록불러오기
router.get('/', async (req, res, next) => {
    let { page } = req.query;
    //20개씩 불러오기
    const skip = (page - 1) * 20;

    try {
        const gameSelectSQLResult = await pool.query(
            `SELECT 
                *
            FROM 
                game
            WHERE 
                deleted_at IS NULL 
            ORDER BY 
                title ASC
            LIMIT 
                20
            OFFSET
                $1`,
            [skip]
        );

        const gameList = gameSelectSQLResult.rows;

        res.status(200).send({
            data: {
                page: page,
                skip: skip,
                count: gameList.length,
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
            const searchSQLResult = await pool.query(
                `SELECT
                    g.idx, g.title, t.img_path
                FROM
                    game g 
                JOIN
                    game_img_thumnail t 
                ON 
                    g.idx = t.game_idx
                WHERE
                    title
                LIKE 
                    '%' ||$1|| '%'
                AND
                    t.deleted_at IS NULL`,
                [title]
            );
            const selectedGameList = searchSQLResult.rows;

            res.status(200).send({
                data: selectedGameList,
            });
        } catch (e) {
            next(e);
        }
    }
);

//인기게임목록불러오기(게시글순)
router.get('/popular', async (req, res, next) => {
    const { page } = req.query || 1;

    let skip;
    let count;
    if (page == 1) {
        //1페이지는 19개 불러오기
        count = 19;
        skip = 0;
    } else {
        //2페이지부터는 16개씩불러오기
        count = 16;
        skip = (page - 1) * 16 + 3;
    }

    try {
        //
        const popularSelectSQLResult = await pool.query(
            //게시글 수가 많은 게임 순서대로 게임 idx, 제목, 이미지경로 추출
            `
                SELECT
                    g.idx, g.title, count(*) AS post_count ,t.img_path  
                FROM 
                    game g 
                JOIN 
                    post p 
                ON 
                    g.idx = p.game_idx 
                JOIN 
                    game_img_thumnail t 
                ON 
                    g.idx = t.game_idx 
                WHERE 
                    t.deleted_at IS NULL 
                GROUP BY 
                    g.title, t.img_path , g.idx
                ORDER BY 
                    post_count DESC
                LIMIT
                    $1
                OFFSET
                    $2`,
            [count, skip]
        );
        const popularGameList = popularSelectSQLResult.rows;

        res.status(200).send({
            data: {
                page: page,
                skip: skip,
                count: popularGameList.length,
                gameList: popularGameList,
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
        const banner = await getCurrentBannerByGameIdx({ gameIdx });

        res.status(200).send({
            data: banner,
        });
    } catch (e) {
        next(e);
    }
});

//히스토리 목록보기
router.get('/:gameidx/history', async (req, res, next) => {
    const gameIdx = req.params.gameidx;
    try {
        //특정게임 히스토리목록 최신순으로 출력
        const historyList = await getHistoryListByGameIdx({ gameIdx });

        res.status(200).send({ data: historyList });
    } catch (e) {
        next(e);
    }
});

//히스토리 자세히보기
router.get('/:gameidx/history/:historyidx', async (req, res, next) => {
    const historyIdx = req.params.historyidx;
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
    '/:gameidx/wiki',
    checkLogin,
    body('content').trim().isLength({ min: 2 }).withMessage('2글자이상 입력해주세요'),
    handleValidationErrors,
    async (req, res, next) => {
        // HTTP 통신 처리하는 곳
        const gameIdx = req.params.gameidx;
        const { userIdx } = req.decoded;
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

module.exports = router;
