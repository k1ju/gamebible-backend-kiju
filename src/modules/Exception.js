class Exception {
    message;
    status;
    err;

    constructor(message, status, err = null) {
        this.message = message;
        this.status = status;
        this.err = err;
    }
}

class BadRequestException extends Exception {
    constructor(message, err = null) {
        super(message, 400, err);
    }
}

class UnauthorizedException extends Exception {
    constructor(message, err = null) {
        super(message, 401, err);
    }
}

class ForbiddenException extends Exception {
    constructor(message, err = null) {
        super(message, 403, err);
    }
}

class NotFoundException extends Exception {
    constructor(message, err = null) {
        super(message, 404, err);
    }
}

class ConflictException extends Exception {
    constructor(message, err = null) {
        super(message, 409, err);
    }
}

class InternalServerErrorException extends Exception {
    constructor(message, err = null) {
        super(message, 500, err);
    }
}

// 비즈니스 오브젝트
class GameRequest {
    idx;
    title;
    isConfirmed;
    createdAt;
    user;

    /**
     * @param {{
     *  idx: number,
     *  user: {
     *      idx: number,
     *      isAdmin: boolean,
     *      nickname: string,
     *      createdAt: Date,
     *  },
     *  title: string,
     *  isConfirmed: boolean,
     *  createdAt: Date
     * }} data
     */
    constructor(data) {
        this.idx = data.idx;
        this.title = data.title;
        this.isConfirmed = data.isConfirmed;
        this.createdAt = data.createdAt;
        this.user = data.user;
    }

    static createGameRequest(row) {
        return new GameRequest({
            idx: row.idx,
            title: row.title,
            isConfirmed: row.isConfirmed,
            createdAt: row.createdAt,
            user: {
                idx: row.userIdx,
                isAdmin: row.isAdmin,
                nickname: row.nickname,
                createdAt: row.userCreatedAt,
            },
        });
    }
}

module.exports = {
    Exception,
    BadRequestException,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    GameRequest,
};
