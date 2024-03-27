const { pool } = require('../config/postgres');

const getCurrentBannerByGameIdx = async (getDTO, conn = pool) => {
    const gameIdx = getDTO.gameIdx;
    const queryResult = await conn.query(
        `SELECT
            img_path AS "imgPath"
        FROM 
            game_img_banner
        WHERE
            game_idx = $1
        AND
            deleted_at IS NULL`,
        [gameIdx]
    );

    return queryResult.rows[0];
};

module.exports = {
    getCurrentBannerByGameIdx,
};
