const { pool } = require('../config/postgres');
/**
 *
 * @param {gameIdx: number, image: object} getDTO
 * @param {import("pg").PoolClient | undefined} conn
 */
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
};
