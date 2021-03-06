/**
 * Created by Maple on 8/7/15.
 */

/**
 * 玩家model，记录玩家所有需要存档的信息
  */
var Hero = ModelBase.extend({
    ctor: function (name, gender) {
        // 生成一个GUID作为玩家id
        this._super(mw.UUIDGenerator.getInstance().generateUUID());

        // 定义model结构
        this._defineScheme({
            name: [ "string", null ],   // 姓名
            gender: [function (val) {
                return typeof val == "number" && val >= GENDER.MALE && val <= GENDER.FEMALE;
            }, GENDER.MALE ], // 性别
            direction: [function (val) {
                return typeof val == "number" && val >= DIRECTIONS.UP && val <= DIRECTIONS.RIGHT;
            }, DIRECTIONS.UP ],
            playTime: [ function (val) {
                return typeof val == "number" && val >= 0;
            }, 0 ],  // 游戏总时间
        });

        // 初始化
        this._setProperties({
            name: name,
            gender: gender,
        });
    },
    getName: function () {
        return this._name;
    },
    getGender: function () {
        return this._gender;
    },
    getDirection: function () {
        return this._direction;
    },
    getPlayTime: function () {
        return this._playTime;
    },
    addPlayTime: function () {
        this._setProperties({
            playTime: this._playTime + 1
        });
    }
});