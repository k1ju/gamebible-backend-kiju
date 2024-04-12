const { pool } = require('../config/postgres');
const moment = require('moment');

const { findModifyUserAllByGameIdx } = require('./user.service');

/**
 * history 데이터를 생성한다.
 * @param {{gameIdx: number, userIdx: number, content: string}} data
 * @param {import('pg').PoolClient | undefined} conn
 * @param {{gameIdx: number, historyIdx: number}} getDTO
 * @returns {Promise<void>}
 */
const createHistory = async (data, conn = pool) => {
    await conn.query(
        `INSERT INTO 
            history(game_idx, user_idx, content)
        VALUES 
            ($1, $2, $3)`,
        [data.gameIdx, data.userIdx, data.content]
    );

    return;
};

const updateHistoryByGameIdx = async (updateDto, conn = pool) => {
    const gameIdx = updateDto.gameIdx;
    const content = updateDto.content;
    const userIdx = updateDto.userIdx;

    let poolClient = null;
    try {
        poolClient = await conn.connect();

        await conn.query('BEGIN');

        const modifyUsers = findModifyUserAllByGameIdx(updateDto.gameIdx, conn);

        await generateNotifications({
            conn,
            gameIdx,
            toUserIdx: modifyUsers.map((modifyUser) => modifyUser.user_idx),
        });

        await createHistory({
            gameIdx,
            userIdx,
            content,
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

const getHistory = async (getDTO, conn = pool) => {
    const gameIdx = getDTO.gameIdx;
    const historyIdx = getDTO.historyIdx;
    const queryResult = await conn.query(
        `SELECT    
            * 
        FROM 
            history
        WHERE 
            idx = $1
        AND 
            game_idx = $2`,
        [historyIdx, gameIdx]
    );
    return queryResult.rows[0];
};

const getHistoryListByGameIdx = async (getDTO, conn = pool) => {
    const gameIdx = getDTO.gameIdx;

    const queryResult = await conn.query(
        `SELECT 
            h.idx, h.created_at, u.nickname
        FROM 
            history h 
        JOIN 
            "user" u
        ON 
            h.user_idx = u.idx
        WHERE 
            game_idx = $1
        ORDER BY
            h.created_at DESC`,
        [gameIdx]
    );

    const historyList = queryResult.rows;

    const historyTitleList = historyList.map((element) => {
        const { idx, created_at, nickname } = element;

        const dateTime = moment(created_at).format('YYYY-MM-DD HH:mm:ss');
        title = dateTime + ' ' + nickname;

        return { idx, title };
    });

    return historyTitleList;
};

module.exports = {
    createHistory,
    updateHistoryByGameIdx,
    getCurrentHistoryByGameIdx,
    getHistory,
    getHistoryListByGameIdx,
};
