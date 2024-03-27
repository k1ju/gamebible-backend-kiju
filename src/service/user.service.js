const { pool } = require('../config/postgres');

/**
 * 게임을 수정했던 모든 사용자 목록을 가져온다.
 * @param {number} gameIdx
 * @param {import("pg").PoolClient | undefined} conn
 * @returns {Promise<{ user_idx: number}[]>}
 */
const findModifyUserAllByGameIdx = async (gameIdx, conn = pool) => {
    const queryResult = await conn.query(
        `SELECT DISTINCT 
            user_idx
        FROM
            history
        WHERE 
            game_idx = $1`,
        [gameIdx]
    );

    return queryResult.rows;
};

const signUp = () => {};

const updateMyProfile = () => {};

const getUserByIdx = () => {};

const getMyInfo = (myIdx) => {};

module.exports = {
    findModifyUserAllByGameIdx,
};
