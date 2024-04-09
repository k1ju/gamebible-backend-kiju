const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');
const checkAdmin = require('../middlewares/checkAdmin');
const { uploadS3 } = require('../middlewares/upload');
const { generateNotification } = require('../modules/generateNotification');

// 게임 생성 요청 승인
router.post(
    '/game',
    checkLogin,
    checkAdmin,
    uploadS3.array('images', 2),
    async (req, res, next) => {
        const { requestIdx } = req.body;
        let poolClient;

        try {
            poolClient = await pool.connect();

            await poolClient.query('BEGIN');

            //요청삭제, 제목,유저idx반환
            const deleteRequestSQLResult = await poolClient.query(
                `
            UPDATE
                request
            SET 
                deleted_at = now(), is_confirmed = true
            WHERE 
                idx = $1
            RETURNING
                user_idx AS "userIdx" , title`,
                [requestIdx]
            );
            const request = deleteRequestSQLResult.rows[0];

            //기존 게임중복확인
            const selectEixsistingGameSQLResult = await poolClient.query(
                `
                SELECT
                    *
                FROM
                    game
                WHERE
                    title = $1`,
                [request.title]
            );

            const existingGame = selectEixsistingGameSQLResult.rows[0];
            if (existingGame) {
                throw new Error('이미존재하는게임');
            }

            //새로운게임추가
            const insertGameSQLResult = await poolClient.query(
                `
                INSERT INTO
                    game(title, user_idx)
                VALUES
                    ( $1, $2 )
                RETURNING
                    idx AS "gameIdx"`,
                [request.title, request.userIdx]
            );
            const gameIdx = insertGameSQLResult.rows[0].gameIdx;

            await poolClient.query(
                `
                INSERT INTO 
                    history(game_idx, user_idx)
                VALUES( $1, $2 )`,
                [gameIdx, request.userIdx]
            );

            const thumnailLocation = req.files[0].location;
            const bannerLocation = req.files[1].location;

            //게임 썸네일, 배너이미지 등록
            await poolClient.query(
                `
                INSERT INTO
                    game_img_thumnail(game_idx, img_path)
                VALUES ( $1, $2 )`,
                [gameIdx, thumnailLocation]
            );

            await poolClient.query(
                `
                INSERT INTO
                    game_img_banner(game_idx, img_path)
                VALUES ( $1, $2 )`,
                [gameIdx, bannerLocation]
            );

            res.status(201).send();
            await poolClient.query('COMMIT');
        } catch (e) {
            await poolClient.query('ROLLBACK');
            next(e);
        } finally {
            poolClient.release();
        }
    }
);
//승인요청온 게임목록보기
router.get('/game/request', checkLogin, checkAdmin, async (req, res, next) => {
    try {
        const selectRequestSQLResult = await pool.query(
            `SELECT
                idx, user_idx AS "userIdx", title, is_confirmed AS "isConfirmed", created_at AS "createdAt"
            FROM
                request
            WHERE 
                deleted_at IS NULL
            ORDER BY
                created_at DESC`
        );
        const requestList = selectRequestSQLResult.rows;

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
    let poolClient;
    try {
        poolClient = await pool.connect();
        await poolClient.query(`BEGIN`);
        // 요청삭제
        await poolClient.query(
            `UPDATE
                request
            SET 
                deleted_at = now(), is_confirmed = false
            WHERE 
                idx = $1`,
            [requestIdx]
        );
        // 요청의 user_idx, 게임제목 추출
        const selectRequestSQLResult = await poolClient.query(
            `SELECT
                user_idx, title
            FROM 
                request
            WHERE 
                idx = $1`,
            [requestIdx]
        );
        const selectedRequest = selectRequestSQLResult.rows[0];
        // 추출한 user_idx, 게임제목으로 새로운 게임 생성, 삭제 -> 그래야 거절 알림보낼 수 있음
        await poolClient.query(
            `INSERT INTO
                game(user_idx, title, deleted_at)
            VALUES
                ( $1, $2, now())`,
            [selectedRequest.user_idx, selectedRequest.title]
        );
        // 방금 생성,삭제된 게임idx 추출
        const latestGameResult = await poolClient.query(
            `SELECT
                idx
            FROM
                game
            ORDER BY
                idx DESC
            LIMIT
                1`
        );
        latestGame = latestGameResult.rows[0];
        //알림생성
        await generateNotification({
            conn: poolClient,
            type: 'DENY_GAME',
            gameIdx: latestGame.idx,
            toUserIdx: selectedRequest.user_idx,
        });

        await poolClient.query(`COMMIT`);

        res.status(200).send();
    } catch (e) {
        await poolClient.query(`ROLLBACK`);
        next(e);
    } finally {
        if (poolClient) poolClient.release();
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
        let poolClient;

        try {
            const location = req.files[0].location;

            poolClient = await pool.connect();
            await poolClient.query(`BEGIN`);

            //기존배너이미지 삭제
            await poolClient.query(
                `UPDATE 
                    game_img_banner
                SET 
                    deleted_at = now()
                WHERE 
                    game_idx = $1
                AND 
                    deleted_at IS NULL`,
                [gameIdx]
            );
            //새로운배너이미지 추가
            await poolClient.query(
                `INSERT INTO
                    game_img_banner(game_idx, img_path)
                VALUES
                    ($1, $2)`,
                [gameIdx, location]
            );
            await poolClient.query(`COMMIT`);

            res.status(201).send();
        } catch (e) {
            await poolClient.query(`ROLLBACK`);
            next(e);
        } finally {
            if (poolClient) poolClient.release();
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
        let poolClient;
        try {
            poolClient = await pool.connect();
            const location = req.files[0].location;

            await poolClient.query(`BEGIN`);
            //기존 썸네일 삭제
            await poolClient.query(
                `UPDATE
                    game_img_thumnail
                SET
                    deleted_at = now()
                WHERE
                    game_idx = $1
                AND
                    deleted_at IS NULL`,
                [gameIdx]
            );
            //새로운 썸네일 등록
            await poolClient.query(
                `INSERT INTO
                    game_img_thumnail(game_idx, img_path)
                VALUES 
                    ( $1, $2 )`,
                [gameIdx, location]
            );

            await poolClient.query(`COMMIT`);

            res.status(201).send();
        } catch (e) {
            await poolClient.query(`ROLLBACK`);
            next(e);
        } finally {
            if (poolClient) poolClient.release();
        }
    }
);

module.exports = router;
