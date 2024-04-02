const { pool } = require('../config/postgres');
const { getNewestGameIdx } = require('../service/game.service');
/**
 *
 * @param {gameIdx: number, image: object} getDTO
 * @param {import("pg").PoolClient | undefined} conn
 */
const denyRequest = async (getDTO, conn = pool) => {
    const { requestIdx } = getDTO;
    console.log('requestIdx: ', requestIdx);
    let poolClient;
    try {
        poolClient = await conn.connect();

        await poolClient.query(`BEGIN`);
        await poolClient.query(
            `UPDATE
                request
            SET 
                deleted_at = now(), is_confirmed = false
            WHERE 
                idx = $1`,
            [requestIdx]
        );
        // 요청의 user_idx, 게임제목 추출
        const selectRequestSQLResult = await poolClient.query(
            `SELECT
                user_idx, title
            FROM 
                request
            WHERE 
                idx = $1`,
            [requestIdx]
        );
        const selectedRequest = selectRequestSQLResult.rows[0];
        console.log('selectedRequest: ', selectedRequest);
        // 추출한 user_idx, 게임제목으로 새로운 게임 생성, 삭제 -> 그래야 거절 알림보낼 수 있음
        await poolClient.query(
            `INSERT INTO
                game(user_idx, title, deleted_at)
            VALUES
                ( $1, $2, now())`,
            [selectedRequest.user_idx, selectedRequest.title]
        );

        // 방금 생성,삭제된 게임idx 추출
        const newestGameIdx = await getNewestGameIdx({
            conn: poolClient,
        });
        console.log('newestGameIdx: ', newestGameIdx);

        //알림생성
        await generateNotification({
            conn: poolClient,
            type: 'DENY_GAME',
            gameIdx: newestGameIdx,
            toUserIdx: selectedRequest.user_idx,
        });

        console.log('실행완료');

        await poolClient.query(`COMMIT`);
        return;
    } catch (e) {
        if (poolClient) poolClient.query('ROLLBACK');
    } finally {
        if (poolClient) poolClient.release();
    }
};

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
    denyRequest,
};
