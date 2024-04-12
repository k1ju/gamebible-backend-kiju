const express = require('express');
require('dotenv').config();

const app = express();

app.use(express.json());

const accountApi = require('./src/routers/account');
const gameApi = require('./src/routers/game');
const postApi = require('./src/routers/post');
const commentApi = require('./src/routers/comment');
const adminApi = require('./src/routers/admin');
const { Exception } = require('./src/modules/Exception');

app.use('/account', accountApi);
app.use('/game', gameApi);
app.use('/post', postApi);
app.use('/comment', commentApi);
app.use('/admin', adminApi);

app.use((req, res, next) => {
    next({ status: 404, message: 'API 없음' });
});

app.use((err, req, res, next) => {
    console.log(err);

    if (err instanceof Exception) {
        return res.status(err.status).send({
            message: err.message,
        });
    }

    return res.status(500).send({
        message: '예상하지 못한 에러가 발생했습니다.',
    });
});

app.listen(process.env.HTTP_PORT, () => {
    console.log(`${process.env.HTTP_PORT}번 포트번호 서버실행`);
});
