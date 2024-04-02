const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');
const checkAdmin = require('../middlewares/checkAdmin');
const { uploadS3 } = require('../middlewares/upload');
const { generateNotification } = require('../modules/generateNotification');
const {
    updateThumnail,
    updateBanner,
    denyRequest,
    showRequest,
} = require('../service/admin.service');

// 게임 생성
router.post('/game', checkLogin, checkAdmin, async (req, res, next) => {
    const { requestIdx } = req.body;
    let poolClient;

    try {
        poolClient = await pool.connect();

        await poolClient.query('BEGIN');

        //요청삭제
        await poolClient.query(
            `UPDATE
                request
            SET 
                deleted_at = now(), is_confirmed = true
            WHERE 
                idx = $1`,
            [requestIdx]
        );

        //제목, 유저idx 불러오기
        const selectRequestSQLResult = await poolClient.query(
            `SELECT
                title, user_idx
            FROM
                request
            WHERE 
                idx = $1`,
            [requestIdx]
        );
        const selectedRequest = selectRequestSQLResult.rows[0];

        await poolClient.query(
            `INSERT INTO
                game(title, user_idx)
            VALUES
                ( $1, $2 )`,
            [selectedRequest.title, selectedRequest.user_idx]
        );

        const selectLatestGameResult = await poolClient.query(
            `SELECT 
                idx
            FROM
                game
            ORDER BY 
                idx DESC
            limit 1`
        );
        const latestGameIdx = selectLatestGameResult.rows[0].idx;

        await poolClient.query(
            `INSERT INTO 
                history(game_idx, user_idx)
            VALUES( $1, $2 )`,
            [latestGameIdx, selectedRequest.user_idx]
        );

        //게임 썸네일, 배너이미지 등록
        await poolClient.query(
            `INSERT INTO
            game_img_thumnail(game_idx)
            VALUES ( $1 )`,
            [latestGameIdx]
        );

        await poolClient.query(
            `
            INSERT INTO
                game_img_banner(game_idx)
            VALUES ( $1 )`,
            [latestGameIdx]
        );

        res.status(201).send();
        await poolClient.query('COMMIT');
    } catch (e) {
        await poolClient.query('ROLLBACK');
        next(e);
    } finally {
        poolClient.release();
    }
});
//승인요청온 게임목록보기
router.get('/game/request', checkLogin, checkAdmin, async (req, res, next) => {
    try {
        const requestList = await showRequest();

        res.status(200).send({
            data: requestList,
        });
    } catch (e) {
        next(e);
    }
});

//승인요청 거부
router.delete('/game/request/:requestidx', checkLogin, checkAdmin, async (req, res, next) => {
    const requestIdx = req.params.requestidx;
    try {
        await denyRequest({ requestIdx });
        res.status(200).send();
    } catch (e) {
        next(e);
    }
});

//배너이미지 등록
router.post(
    '/game/:gameidx/banner',
    checkLogin,
    checkAdmin,
    uploadS3.array('images', 1),
    async (req, res, next) => {
        const gameIdx = req.params.gameidx;
        const image = req.files[0];

        try {
            await updateBanner({ gameIdx, image });

            res.status(201).send();
        } catch (e) {
            next(e);
        }
    }
);

//대표이미지 등록하기
router.post(
    '/game/:gameidx/thumnail',
    checkLogin,
    checkAdmin,
    uploadS3.array('images', 1),
    async (req, res, next) => {
        const gameIdx = req.params.gameidx;
        const image = req.files[0];

        try {
            await updateThumnail({ gameIdx, image });

            res.status(201).send();
        } catch (e) {
            next(e);
        }
    }
);

module.exports = router;
