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
            idx: row.row,
            game: row.game,
            user: row.user,
            content: row.content,
            createdAt: row.createdAt,
        });
    }
}

module.exports = { History };
