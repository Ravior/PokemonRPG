/**
 * Created by Maple on 9/4/15.
 */

var BattleAI;
BattleAI = Component.extend({
    ctor: function () {
        this._super("BattleAI");
    },
    getAILevel: function () {
        return this._aiLevel;
    },
    setAILevel: function (aiLevel) {
        this._aiLevel = aiLevel;
    },
    think: function () {
        cc.assert(this._aiLevel, "未设置AI级别");

        // 处理类似逆鳞技能的特殊情况
        if (this._target.getRepeat() > 0 || this._target.isPreparing()) {
            return this._lastBehavior;
        }
        var handlerName = "_think" + this._aiLevel.toString();
        var handler = this[handlerName];
        cc.assert(handler instanceof Function, "未实现的AI");
        return handler.call(this);
    },
    onBind: function (target) {
        if (!(target instanceof Pokemon)) {
            mw.error("不合法的绑定对象 BattleAI组件必须绑定在Pokemon上");
            return;
        }
    },
    onUnbind: function () {
    },
    _think1: function () {
        var skills = this._target.getSkills();
        var rdNum = Math.floor(Math.random() * skills.length);
        var rdSkillId = skills[rdNum][0];
        var rdSkillInfo = new SkillInfo(rdSkillId);
        this._lastBehavior = new SkillBehavior(this._target, rdSkillInfo);
        return this._lastBehavior;
    },
    _aiLevel: null,
    _lastBehavior: null,
});

BattleAI.AI_LEVELS = {
    IDIOT: 1,
};
