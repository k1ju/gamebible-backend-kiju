const { pool } = require('../config/postgres');
const { History } = require('../entity/historyEntity');
const moment = require('moment');

const { findModifyUserAllByGameIdx } = require('./user.service');
const { generateNotifications } = require('../modules/generateNotification');

/**
 *
 * @param {{gameIdx:number}} getDTO
 * @param {import('pg').PoolClient | undefined} conn
 * @returns {historyList : History[]}
 */

const getHistoryAllByGameIdx = async (getDTO, conn = pool) => {
    const getHistoryALLSQLResult = await conn.query(
        `SELECT 
            h.idx, h.created_at, u.idx AS user_idx, u.nickname, g.idx AS game_idx, g.title
        FROM 
            history h 
        JOIN 
            "user" u
        ON 
            h.user_idx = u.idx
        JOIN
            game g
        ON 
            g.idx = h.game_idx
        WHERE 
            game_idx = $1
        ORDER BY
            h.created_at DESC`,
        [getDTO.gameIdx]
    );

    const historyList = getHistoryALLSQLResult.rows;

    return { historyList };
};

/**
 * history 데이터를 생성한다.
 * @param {{gameIdx: number, userIdx: number, content: string}} insertDTO
 * @param {import('pg').PoolClient | undefined} conn
 * @returns {Promise<void>}
 */

const createHistory = async (insertDTO, conn = pool) => {
    const createHistorySQLResult = await conn.query(
        `INSERT INTO 
            history(game_idx, user_idx, content)
        VALUES 
            ($1, $2, $3)
        RETURNING
            idx`,
        [insertDTO.gameIdx, insertDTO.userIdx, insertDTO.content]
    );
    const historyIdx = createHistorySQLResult.rows[0].idx;
    console.log('historyIdx: ', historyIdx);
    // 반환값 무엇? : 알림 -> 수정이력 있는사람
    return { historyIdx };
};

/**
 * 게임 내용(최신history)를 수정한다
 * @param {{gameIdx:Number, userIdx:Number, content:String}} updateDto
 * @param {import('pg').PoolClient | undefined} conn
 * @returns {void}
 */
const updateHistoryByGameIdx = async (updateDto, conn = pool) => {
    let poolClient = null;
    try {
        poolClient = await conn.connect();

        await conn.query('BEGIN');

        const { modifyUsers } = await findModifyUserAllByGameIdx(updateDto.gameIdx, conn);

        await generateNotifications({
            gameIdx: updateDto.gameIdx,
            toUserIdx: modifyUsers,
        });

        await createHistory({
            gameIdx: updateDto.gameIdx,
            userIdx: updateDto.userIdx,
            content: updateDto.content,
        });

        await conn.query('COMMIT');
    } catch (error) {
        if (poolClient) await conn.query('ROLLBACK');
        throw error;
    } finally {
        if (poolClient) poolClient.release();
    }
};

const getCurrentHistoryByGameIdx = async (getDTO, conn = pool) => {
    const gameIdx = getDTO.gameIdx;
    const queryResult = await conn.query(
        `SELECT 
            content, created_at 
        FROM 
            history
        WHERE 
            game_idx = $1
        ORDER BY
            created_at DESC
        limit 
            1`,
        [gameIdx]
    );

    return queryResult.rows[0];
};

/**
 *
 * @param {{historyIdx: number | undefined, gameIdx : number}} getDTO
 * @param {import('pg').PoolClient | undefined} conn
 * @returns {History: object}
 */
const getHistoryByIdx = async (getDTO, conn = pool) => {
    let getHistoryByIdxSQLResult;
    //historyIdx가 없을때
    if (!getDTO.historyIdx) {
        getHistoryByIdxSQLResult = await conn.query(
            `SELECT    
                h.idx, content, h.created_at AS "createdAt", g.idx AS "gameIdx", g.title, u.idx AS "userIdx", u.nickname, u.is_admin AS "isAdmin"  
            FROM 
                history h
            JOIN
                game g
            ON
                g.idx = h.game_idx
            JOIN
                "user" u
            ON
                u.idx = h.user_idx
            WHERE 
                game_idx = $1
            AND 
                h.created_at IS NOT NULL
            ORDER BY
                h.idx DESC
            LIMIT
                1`,
            [getDTO.gameIdx]
        );
    } else {
        //historyIdx가 있을때

        getHistoryByIdxSQLResult = await conn.query(
            `SELECT    
                h.idx, content, h.created_at AS "createdAt", g.idx AS "gameIdx", g.title, u.idx AS "userIdx", u.nickname, u.is_admin AS "isAdmin"  
            FROM 
                history h
            JOIN
                game g
            ON
                g.idx = h.game_idx
            JOIN
                "user" u
            ON
                u.idx = h.user_idx
            WHERE 
                h.idx = $1
            AND 
                game_idx = $2`,
            [getDTO.historyIdx, getDTO.gameIdx]
        );
    }
    const history = History.createHistory(getHistoryByIdxSQLResult.rows[0]);

    return { history };
};

module.exports = {
    createHistory,
    updateHistoryByGameIdx,
    getCurrentHistoryByGameIdx,
    getHistoryByIdx,
    getHistoryAllByGameIdx,
};
