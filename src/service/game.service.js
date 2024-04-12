const { pool } = require('../config/postgres');

class Game {
    idx;
    title;
    user;
    createdAt;

    /**
     * @param {{
     *  idx: number,
     *  title:string,
     *  user: {
     *      idx: number,
     *      isAdmin: boolean,
     *      nickname: string
     * },
     * createdAt: time
     * }} data
     */
    constructor(data) {
        this.idx = data.idx;
        this.title = data.title;
        this.user = data.user;
        this.createdAt = data.createdAt;
    }

    static createGame(row) {
        return new Game({
            idx: row.idx,
            title: row.title,
            user: row.user,
            createdAt: row.createdAt,
        });
    }
}

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
 * 게임목록불러오기
 * @param {number} page
 * @param {import("pg").PoolClient | undefined} conn
 * @returns
 */
const getGameByDictionaryOrder = async (page, conn = pool) => {
    const skip = (page - 1) * 20;
    const queryResult = await conn.query(
        `SELECT 
            *
        FROM 
            game
        WHERE 
            deleted_at IS NULL 
        ORDER BY 
            title ASC
        LIMIT 
            20
        OFFSET
            $1`,
        [skip]
    );

    let gameList = queryResult.rows.map((row) => Game.createGame(row));
    console.log('gameList: ', gameList);

    return { gameList, skip };
};

/**
 * 게임검색하기
 * @param
 *
 *
 */
const getGameBySearch = async (getDTO, conn = pool) => {
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

    return gameList;
};

/**
 * 인기순게임가져오기
 * @param {*} page
 * @param {*} conn
 * @returns
 */
const getPopularGameList = async (page, conn = pool) => {
    let count = null;
    let skip = null;

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

/**
 * 게임배너가져오기
 * @param {*} getDTO
 * @param {*} conn
 * @returns
 */
const getCurrentBannerByGameIdx = async (getDTO, conn = pool) => {
    const { gameIdx } = getDTO;
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

//가장최신게임가져오기? ->빼기
const getNewestGameIdx = async (conn) => {
    const queryResult = await conn.query(
        `SELECT
            idx
        FROM
            game
        ORDER BY
            idx DESC
        LIMIT
            1`
    );
    const newestGame = queryResult.rows[0];

    return newestGame.idx;
};

module.exports = {
    getCurrentBannerByGameIdx,
    getPopularGameList,
    getGameBySearch,
    getGameByDictionaryOrder,
    requestGame,
    getNewestGameIdx,
};
