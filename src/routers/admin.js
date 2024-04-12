const router = require('express').Router();
const { pool } = require('../config/postgres');
const checkLogin = require('../middlewares/checkLogin');
const checkAdmin = require('../middlewares/checkAdmin');
const { uploadS3 } = require('../middlewares/upload');
const { generateNotification } = require('../modules/generateNotification');
const {
    updateThumnail,
    updateBanner,
    denyRequest,
    showRequest,
} = require('../service/admin.service');

// 게임 생성
router.post('/game', checkLogin, checkAdmin, async (req, res, next) => {
    const { requestIdx } = req.body;

    try {
        res.status(201).send();
        await poolClient.query('COMMIT');
    } catch (e) {
        await poolClient.query('ROLLBACK');
        next(e);
    } finally {
        poolClient.release();
    }
});
//승인요청온 게임목록보기
router.get('/game/request', checkLogin, checkAdmin, async (req, res, next) => {
    try {
        const requestList = await showRequest();

        res.status(200).send({
            data: requestList,
        });
    } catch (e) {
        next(e);
    }
});

//승인요청 거부
router.delete('/game/request/:requestidx', checkLogin, checkAdmin, async (req, res, next) => {
    const requestIdx = req.params.requestidx;
    try {
        await denyRequest({ requestIdx });
        res.status(200).send();
    } catch (e) {
        next(e);
    }
});

//배너이미지 등록
router.post(
    '/game/:gameidx/banner',
    checkLogin,
    checkAdmin,
    uploadS3.array('images', 1),
    async (req, res, next) => {
        const gameIdx = req.params.gameidx;
        const image = req.files[0];

        try {
            await updateBanner({ gameIdx, image });

            res.status(201).send();
        } catch (e) {
            next(e);
        }
    }
);

//대표이미지 등록하기
router.post(
    '/game/:gameidx/thumnail',
    checkLogin,
    checkAdmin,
    uploadS3.array('images', 1),
    async (req, res, next) => {
        const gameIdx = req.params.gameidx;
        const image = req.files[0];

        try {
            await updateThumnail({ gameIdx, image });

            res.status(201).send();
        } catch (e) {
            next(e);
        }
    }
);

module.exports = router;
