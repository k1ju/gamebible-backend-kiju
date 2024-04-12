class History {
    idx;
    game;
    user;
    content;
    createdAt;

    /**
     *
     * @param {{
     *   idx: number,
     *   game: {
     *     idx: number,
     *     title: string
     * },
     *   user : {
     *    idx : number,
     *    nickname: string
     * },
     * content : string,
     * createdAt : time
     * }} data
     */
    constructor(data) {
        (this.idx = data.idx),
            (this.game = data.game),
            (this.user = data.user),
            (this.content = data.content),
            (this.createdAt = data.createdAt);
    }

    static createHistory(row) {
        return new History({
            idx: row.idx,
            game: {
                idx: row.gameIdx,
                title: row.title,
            },
            user: {
                idx: row.userIdx,
                isAdmin: row.isAdmin,
                nickname: row.nickname,
            },
            content: row.content,
            createdAt: row.createdAt,
        });
    }
}

module.exports = { History };
