const { pool } = require('../config/postgres');

/**
 *
 * @param {{
 *  conn: any,
 *  type: 'DENY_GAME'| 'MODIFY_GAME' | 'MAKE_COMMENT' |,
 *  gameIdx: number,
 *  postIdx: number,
 *  toUserIdx: number,
 * }} option
 */

const generateNotification = async (option) => {
    let notificationType = null;

    if (option.type == 'MAKE_COMMENT') notificationType = 1;
    else if (option.type == 'MODIFY_GAME') notificationType = 2;
    else if (option.type == 'DENY_GAME') notificationType = 3;

    (option.poolClient || pool).query(
        `INSERT INTO
                notification (type, user_idx, game_idx, post_idx)
            VALUES( $1, $2, $3, $4 )`,
        [notificationType, option.toUserIdx, option.gameIdx, option.postIdx || null]
    );
};

/**
 * @param {import('pg').poolClient | undefined} conn
 * @param {{gameIdx:number,
 *          toUserIdx: number[]}} DTO
 * @returns {void}
 */
const generateNotifications = async (DTO, conn = pool) => {
    await conn.query(
        `INSERT INTO
                notification (type, game_idx, post_idx, user_idx)
            SELECT
                2, $1, NULL,
                UNNEST($2::int[])`,
        [DTO.gameIdx, DTO.toUserIdx]
    );
};

module.exports = { generateNotification, generateNotifications };
