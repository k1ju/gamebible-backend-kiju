const { pool } = require('../config/postgres');
const { findModifyUserAllByGameIdx } = require('./user.service');

/**
 * history 데이터를 생성한다.
 * @param {{gameIdx: number, userIdx: number, content: string}} data
 * @param {import('pg').PoolClient | undefined} conn
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

module.exports = {
    createHistory,
    updateHistoryByGameIdx,
};
