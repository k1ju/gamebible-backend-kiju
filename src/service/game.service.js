const { pool } = require('../config/postgres');

/**
 *
 * @param {gameIdx: number} getDTO
 * @param {import("pg").PoolClient | undefined} conn
 * @param {number} page
 * @param {number} count
 * @param {number} skip
 * @returns
 */

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

const getPopularGameList = async (page, conn = pool) => {
    let count = null;
    let skip = null;
    console.log(page);

    if (page == 1) {
        //1페이지는 19개 불러오기
        count = 19;
        skip = 0;
    } else {
        //2페이지부터는 16개씩불러오기
        count = 16;
        skip = (page - 1) * 16 + 3;
    }

    const queryResult = await conn.query(
        `SELECT
            g.idx, g.title, count(*) AS "postCount" ,t.img_path AS "imgPath" 
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
            "postCount" DESC
        LIMIT
            $1
        OFFSET
            $2`,
        [count, skip]
    );
    const gameList = queryResult.rows;
    return { count, skip, gameList };
};

module.exports = {
    getCurrentBannerByGameIdx,
    getPopularGameList,
};
