const { query } = require('express');
const { pool } = require('../config/postgres');
const { getNewestGameIdx, requestGame } = require('../service/game.service');
const { NotFoundException, GameRequest } = require('../modules/Exception');

/**
 * @typedef {{
 *  idx: number,
 *  user: {
 *      idx: number,
 *      isAdmin: boolean,
 *      nickname: string,
 *      createdAt: Date,
 *  },
 *  title: string,
 *  isConfirmed: boolean,
 *  createdAt: Date
 * }} GameRequest
 */

//비즈니스 객체형식으로 만들어주는 함수
const gameRequest = (row) => {
    return {
        idx: row.idx,
        title: row.title,
        isConfirmed: row.isConfirmed,
        createdAt: row.createdAt,
        user: {
            idx: row.userIdx,
            isAdmin: row.isAdmin,
            nickname: row.nickname,
            createdAt: row.userCreatedAt,
        },
    };
};

/**
 * @typedef {{
 *  idx: number,
 *  user: {
 *      idx: number,
 *  },
 *  title: string,
 *  isConfirmed: boolean,
 *  createdAt: Date
 * }} SummaryGameRequest
 */

/**
 * 게임 요청 목록 가져오기
 * @param {import("pg").PoolClient | undefined} conn
 * @returns {Promise<SummaryGameRequest[]>}
 */
const getGameRequestAll = async (conn = pool) => {
    const result = await conn.query(`
    SELECT
        idx, 
        user_idx AS "userIdx", 
        user.is_admin AS "isAdmin",
        user.nickname,
        user.createdAt AS "userCreatedAt",
        title,
        is_confirmed AS "isConfirmed", 
        created_at AS "createdAt"
    FROM
        request
    JOIN
        user
    ON
        user.idx = user_idx
    WHERE 
        deleted_at IS NULL`);

    return result.rows.map((row) => ({
        idx: row.idx,
        title: row.title,
        isConfirmed: row.isConfirmed,
        createdAt: row.createdAt,
        user: {
            idx: row.userIdx,
            isAdmin: row.isAdmin,
            nickname: row.nickname,
            createdAt: row.userCreatedAt,
        },
    }));
};

/**
 *
 * @param {number} idx idx of request
 * @param {import("pg").PoolClient | undefined} conn
 */
const getGameRequestByIdx = async (idx, conn = pool) => {
    const showRequestSQLResult = await conn.query(
        `
        SELECT
            idx, 
            user_idx AS "userIdx", 
            user.is_admin AS "isAdmin",
            user.nickname,
            user.createdAt AS "userCreatedAt",
            title,
            is_confirmed AS "isConfirmed", 
            created_at AS "createdAt"
        FROM
            request
        JOIN
            user
        ON
            user.idx = user_idx
        WHERE 
            idx = $1
        AND
            deleted_at IS NULL`,
        [idx]
    );

    const request = showRequestSQLResult.rows[0];

    if (!request) {
        throw new NotFoundException('Cannot find request');
    }

    return gameRequest(request);
};

/**
 *
 * @param {{
 *  requestIdx: number
 * }} requestDenyDto
 * @param {*} conn
 * @returns
 */
const denyRequest = async (requestDenyDto, conn = pool) => {
    const { requestIdx } = requestDenyDto;
    const poolClient = await conn.connect();
    try {
        await poolClient.query(`BEGIN`);
        await poolClient.query(
            `UPDATE
                request
            SET 
                deleted_at = now(), is_confirmed = false
            WHERE 
                idx = $1`,
            [requestIdx]
        );
        const request = await getGameRequestByIdx(requestIdx);

        await poolClient.query(
            `INSERT INTO
                game(user_idx, title, deleted_at)
            VALUES
                ( $1, $2, now())`,
            [request.user.idx, request.title]
        );

        const newestGameIdx = await getNewestGameIdx({
            conn: poolClient,
        });

        await generateNotification({
            conn: poolClient,
            type: 'DENY_GAME',
            gameIdx: newestGameIdx,
            toUserIdx: request.user.idx,
        });

        await poolClient.query(`COMMIT`);
        return;
    } catch (e) {
        poolClient.query('ROLLBACK');
    } finally {
        poolClient.release();
    }
};

const makeNewGame = async (requestDto, conn) => {
    let poolClient;
    try {
        // const { requestIdx }

        poolClient = await pool.connect();

        await poolClient.query('BEGIN');

        //요청삭제
        await poolClient.query(
            `UPDATE
                request
            SET 
                deleted_at = now(), is_confirmed = true
            WHERE 
                idx = $1
            RETURNING
                *`,
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
    } catch (e) {}
};
const updateThumnail = async (getDTO, conn = pool) => {
    const { gameIdx, image } = getDTO;
    let poolClient;
    try {
        poolClient = await conn.connect();

        await poolClient.query('BEGIN');
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
            [gameIdx, image.location]
        );

        await poolClient.query(`COMMIT`);
        return;
    } catch (e) {
        await poolClient.query('ROLLBACK');
    } finally {
        if (poolClient) poolClient.release();
    }
};

const updateBanner = async (getDTO, conn = pool) => {
    const { gameIdx, image } = getDTO;
    let poolClient;
    try {
        poolClient = await conn.connect();

        await poolClient.query('BEGIN');
        //기존 썸네일 삭제
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
        //새로운 썸네일 등록
        await poolClient.query(
            `INSERT INTO
                game_img_banner(game_idx, img_path)
            VALUES 
                ( $1, $2 )`,
            [gameIdx, image.location]
        );

        await poolClient.query(`COMMIT`);
        return;
    } catch (e) {
        await poolClient.query('ROLLBACK');
    } finally {
        if (poolClient) poolClient.release();
    }
};

module.exports = {
    updateThumnail,
    updateBanner,
    denyRequest,
    getGameRequestAll,
};
