const { pool } = require('../config/postgres');
const { Game } = require('../entity/gameEntity');
/**
 *게임생성요청
 * @param {gameIdx: number, userIdx: number, title: string} getDTO
 * @param {import("pg").PoolClient | undefined} conn
 * @param {number} page 페이지수
 * @returns
 */
const requestGame = async (getDTO, conn = pool) => {
    const { userIdx, title } = getDTO;
    await conn.query(
        `INSERT INTO 
            request(user_idx, title) 
        VALUES 
            ( $1 ,$2 )`,
        [userIdx, title]
    );
    return;
};

/**
 * 게임 목록 가져오기
 * @param {{page: number,
 *          orderBy: 'title',
 *          order?: 'asc' | 'desc' }} pagerble
 * @param {import("pg").PoolClient | undefined} conn
 * @returns {{gameList: Game[],
 *            meta: {
 *              totalCount: number
 *       }
 * }}
 */
const getGameAllWithTitle = async (pagerble, conn = pool) => {
    const skip = (pagerble.page - 1) * 20;
    // prettier-ignore
    const queryResult = await conn.query(
        `SELECT 
            *
        FROM 
            game
        WHERE 
            deleted_at IS NULL ${pagerble.orderBy === 'title' ?
       `ORDER BY 
            title ${order === 'asc' ? 'asc' : 'desc'}` : ``}
        LIMIT 
            20
        OFFSET
            $1`,
        [skip]
    );

    let gameList = queryResult.rows.map((row) => Game.createGame(row));

    const countQuery = await conn.query(`
        SELECT
            count(*)
        FROM
            game
    `);
    const totalCount = countQuery.rows[0].count;

    return { gameList: gameList, meta: { totalCount: totalCount } };
};

/**
 * 게임검색하기
 * @param {{
 *      title: string,
 * }} getDTO
 * @param {import("pg").PoolClient | undefined} conn
 * @returns {gameList: Game[]}
 */
const getGameByTitle = async (getDTO, conn = pool) => {
    const { title } = getDTO;
    const queryResult = await conn.query(
        `SELECT
            g.idx, g.title, t.img_path AS "imgPath"
        FROM
            game g 
        JOIN
            game_img_thumnail t 
        ON 
            g.idx = t.game_idx
        WHERE
            title
        LIKE 
            '%' ||$1|| '%'
        AND
            t.deleted_at IS NULL`,
        [title]
    );
    const gameList = queryResult.rows;

    return { gameList };
};

/**
 * 인기순게임가져오기
 * @param {{page : number;
 *          }} pagerble
 * @param {import("pg").PoolClient | undefined} conn
 * @returns {{gameList: game[],
 *            meta: {
 *                totalCount: number,
 *                    skip: number
 *         }
 * }}
 */
const getGameWithPostNumber = async (pagerble, conn = pool) => {
    let count = null;
    let skip = null;

    if (pagerble.page == 1) {
        //1페이지는 19개 불러오기
        count = 19;
        skip = 0;
    } else {
        //2페이지부터는 16개씩불러오기
        count = 16;
        skip = (page - 1) * 16 + 3;
    }

    const getGameNumberSQLResult = await conn.query(`
        SELECT
            count(*)
        FROM
            game
     `);
    const gameNumber = getGameNumberSQLResult.rows[0].count;

    const selectGameWithPostSQLResult = await conn.query(
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
    let gameList = selectGameWithPostSQLResult.rows.map((row) => Game.createGame(row));
    return {
        gameList: gameList,
        meta: { totalCount: gameNumber },
    };
};

/**
 * 게임배너가져오기
 * @param {{gameIdx: Number}} getDTO
 * @param {import("pg").PoolClient | undefined} conn
 * @returns {Game}
 */
const getGameByIdx = async (getDTO, conn = pool) => {
    const { gameIdx } = getDTO;
    const getGameByIdxSQLResult = await conn.query(
        `SELECT
            g.idx, title, g.created_at AS "createdAt", g.user_idx AS "userIdx", u.nickname, u.is_admin AS "isAdmin", b.img_path AS banner, t.img_path AS thumnail
        FROM
            game g
        JOIN 
            game_img_banner b
        ON
            g.idx = b.game_idx
        JOIN
            game_img_thumnail t
        ON
            g.idx = t.game_idx
        JOIN
            "user" u
        ON
            u.idx = g.user_idx
        WHERE
            g.idx = $1
        AND
            b.deleted_at IS NULL`,
        [gameIdx]
    );
    const game = Game.createGame(getGameByIdxSQLResult.rows[0]);

    return { game };
};

module.exports = {
    getGameByIdx,
    getGameWithPostNumber,
    getGameByTitle,
    getGameAllWithTitle,
    requestGame,
};
