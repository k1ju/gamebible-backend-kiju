class Game {
    idx;
    title;
    user;
    createdAt;
    banner;
    thumnail;

    /**
     * @param {{
     *  idx: number,
     *  title:string,
     *  user: {
     *      idx: number,
     *      isAdmin: boolean,
     *      nickname: string
     * },
     * createdAt: time,
     * banner: string,
     * thumnail: string
     * }} data
     */
    constructor(data) {
        (this.idx = data.idx),
            (this.title = data.title),
            (this.user = data.user),
            (this.createdAt = data.createdAt),
            (this.banner = data.banner),
            (this.thumnail = data.thumnail);
    }

    static createGame(row) {
        return new Game({
            idx: row.idx,
            title: row.title,
            user: row.user,
            createdAt: row.createdAt,
            banner: row.banner,
            thumnail: row.thumnail,
        });
    }
}

module.exports = { Game };
