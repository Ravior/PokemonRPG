/**
 * Created by Maple on 8/23/15.
 */

var BattleProcessor = cc.Class.extend({
    ctor: function (pokemon1, pokemon2, aiLevel) {
        if (!(pokemon1 instanceof Pokemon) || !(pokemon2 instanceof Pokemon)) {
            mw.error("不合法的参数 BattleProcessor创建失败");
            return;
        }
        aiLevel = aiLevel || BattleAI.AI_LEVELS.IDIOT;
        this._pokemon1 = pokemon1;
        this._pokemon2 = pokemon2;
        var com = MakeBindable(this._pokemon2).addComponent("BattleAI");
        logBattle("AI LEVEL: %d", aiLevel);
        com.setAILevel(aiLevel);

        this._field1BuffList = [];
        this._field2BuffList = [];
        this._behaviorQueue = [];
    },
    getFriendPokemon: function () {
        return this._pokemon1;
    },
    getEnemyPokemon: function () {
        return this._pokemon2;
    },
    prepareForTurn: function (behavior) {
        var enemyBehavior = this._pokemon2.getComponent("BattleAI").think();
        if (behavior.getPriority() >= enemyBehavior.getPriority()) {
            // 玩家先行动
            this._behaviorQueue.push(behavior);
            this._behaviorQueue.push(enemyBehavior);
        } else {
            // 敌人先行动
            this._behaviorQueue.push(enemyBehavior);
            this._behaviorQueue.push(behavior);
        }
    },
    battleBegin: function () {
        // 战斗开始
    },
    beginTurn: function () {
        // 回合开始
        Notifier.notify(BATTLE_EVENTS.TURN_BEGAN);
    },
    endTurn: function () {
        // 回合结束
        // 任何害怕的状态应该清空
        this._pokemon1.removeBattleState(BATTLE_STATES.SCARED);
        this._pokemon2.removeBattleState(BATTLE_STATES.SCARED);
        // 场地buff cd
        for (var buffId in this._field1BuffList) {
            --this._field1BuffList[buffId];
            if (this._field1BuffList[buffId] <= 0) {
                this._field1BuffList[buffId] = undefined;
            }
        }
        for (var buffId in this._field2BuffList) {
            --this._field2BuffList[buffId];
            if (this._field2BuffList[buffId] <= 0) {
                this._field2BuffList[buffId] = undefined;
            }
        }
        Notifier.notify(BATTLE_EVENTS.TURN_ENDED);
    },
    endBattle: function () {
        // 战斗结束
        Notifier.notify(BATTLE_EVENTS.BATTLE_ENDED);
    },
    process: function () {
        var behavior = this._behaviorQueue.shift();
        if (behavior) {
            behavior.process();
        } else {
            this.endTurn();
        }
    },
    clearBehaviorQueue: function () {
        this._behaviorQueue = [];
    },
    getWeather: function () {
        if (this._weather) {
            return this._weather[0];
        }
        return null;
    },
    checkWeather: function () {
        if (this._weather) {
            --this._weather[1];
            if (this._weather[1] == 0) {
                this._weather = null;
                return 0;
            }
            return this._weather[1];
        }
        return -1;
    },
    checkPokemonStateBeforeUseSkill: function (pokemon) {
        // 精灵状态
        var state = pokemon.getState();
        var pokemonStateInfo = { state: state };
        // 麻痹状态50%不能行动
        if (state == POKEMON_STATES.PALSY) {
            var rd = Math.ceil(Math.random() * 2);
            if (rd == 1) {
                pokemonStateInfo["skip"] = true;
            }
        } else if (state == POKEMON_STATES.SLEEP) {
            // 30%概率醒来
            var rd = Math.ceil(Math.random() * 100);
            if (rd <= 30) {
                pokemon.setState(POKEMON_STATES.NORMAL);
                pokemonStateInfo["eliminated"] = true;
            } else {
                pokemonStateInfo["skip"] = true;
            }
        } else if (state == POKEMON_STATES.FROZEN) {
            pokemonStateInfo["skip"] = true;
        }
        return pokemonStateInfo;
    },
    checkPokemonStateWhenTurnEnds: function (pokemon) {
        var state = pokemon.getState();
        var pokemonStateInfo = { state: state };
        if (state == POKEMON_STATES.BURNED) {
            // 烧伤扣除10% HP
            var hurt = pokemon.hurt(Math.ceil(pokemon.getBasicValues()[0] * 0.1));
            pokemonStateInfo["hurt"] = hurt;
        } else if (state == POKEMON_STATES.POISON) {
            // 中毒扣除15% HP
            var hurt = pokemon.hurt(Math.ceil(pokemon.getBasicValues()[0] * 0.15));
            pokemonStateInfo["hurt"] = hurt;
        }
        return pokemonStateInfo;
    },
    checkBattleStateBeforeUseSkill: function (pokemon) {
        // 战斗状态
        if (pokemon.checkBattleState(BATTLE_STATES.TIRED) > 0) {
            return {
                skip: true,
                state: BATTLE_STATES.TIRED,
            };
        }
        if (pokemon.checkBattleState(BATTLE_STATES.SCARED) > 0) {
            return {
                skip: true,
                state: BATTLE_STATES.SCARED,
            };
        }
        var battleStateInfo = { state: BATTLE_STATES.NORMAL };
        var turns = pokemon.checkBattleState(BATTLE_STATES.CONFUSED);
        if (turns >= 0) {
            battleStateInfo["state"] = BATTLE_STATES.CONFUSED;
            if (turns == 0) {
                battleStateInfo["eliminated"] = true;
            } else {
                // 50%概率攻击自己
                var rd = Math.ceil(Math.random() * 100);
                if (rd <= 50) {
                    // 随机对自身造成最大HP的10%-25%的伤害
                    var rdHurt = Math.floor((Math.floor(Math.random() * 16) + 10) / 100 * pokemon.getBasicValues()[0]);
                    battleStateInfo["hurt"] = rdHurt;
                }
            }
        } else {
            turns = pokemon.checkBattleState(BATTLE_STATES.CONFUSED);
            if (turns >= 0) {
                battleStateInfo["state"] == BATTLE_STATES.CONFUSED;
                if (turns == 0) {
                    battleStateInfo["eliminated"] = true;
                } else {
                    battleStateInfo["skip"] = true;
                }
            }
        }
        return battleStateInfo;
    },
    analyzeSkill: function (skillUser, skillInfo) {
        var otherPokemon = skillUser.ownBySelf() ? this._pokemon2 : this._pokemon1;
        var targetType = skillInfo.getTarget();
        var target = null;
        // 暂未考虑混乱 todo
        if (targetType == SKILL_TARGET_TYPES.SINGLE_ENEMY) {
            target = otherPokemon;
        } else if (targetType == SKILL_TARGET_TYPES.ALL_ENEMIES) {
            target = otherPokemon;
        } else if (targetType == SKILL_TARGET_TYPES.SELF) {
            target = skillUser;
        } else if (targetType == SKILL_TARGET_TYPES.EXCEPT_SELF) {
            target = otherPokemon;
        } else if (targetType == SKILL_TARGET_TYPES.RANDOM_ENEMY) {
            target = otherPokemon;
        } else if (targetType == SKILL_TARGET_TYPES.SELF_FIELD) {
            target = (skillUser.ownBySelf() ? this._field1BuffList : this._field2BuffList);
        } else if (targetType == SKILL_TARGET_TYPES.ENEMY_FIELD) {
            target = (skillUser.ownBySelf() ? this._field2BuffList : this._field1BuffList);
        } else if (targetType == SKILL_TARGET_TYPES.ALL_FIELD) {
            target = this._weather;
        } else if (targetType == SKILL_TARGET_TYPES.FRIEND) {
            target = null;
        } else if (targetType == SKILL_TARGET_TYPES.WAITING) {
            target = null;
        } else if (targetType == SKILL_TARGET_TYPES.UNKNOWN) {
            target = null;
        } else if (targetType == SKILL_TARGET_TYPES.ANY) {
            target = null;
        }
        var handler = this["_skill" + skillInfo.getHandler()];
        cc.assert(handler instanceof Function, "未实现的技能逻辑处理函数");
        var result = handler.call(this, skillUser, target, skillInfo);

        return result;
    },
    _calculateHit: function (attacker, defender, skillInfo) {
        var hitRate = skillInfo.getHitRate();
        if (hitRate == null) {
            // 必中
            return true;
        }
        // 等级修正
        var levelCorrection = attacker.getLevel() - defender.getLevel();
        // 能力等级修正
        var attackerHitRateLevel = attacker.getAbilityLevels()[5];
        var defenderAvoidLevel = defender.getAbilityLevels()[6];
        // 道具修正 todo
        // 特性修正 todo
        var finalCorrection = (3 + attackerHitRateLevel) / (3 + defenderAvoidLevel);
        hitRate = Math.floor((hitRate + levelCorrection) * finalCorrection);
        logBattle("技能命中率: %d", hitRate);
        if (hitRate >= 100) {
            return true;
        }
        var rd = Math.ceil(Math.random() * 100);
        return rd <= hitRate;
    },
    _calculateHurt: function (attacker, defender, skillInfo) {
        var skillAtk = skillInfo.getAttack();
        if (skillAtk == null) {
            // 需要特殊处理 todo
            skillAtk = 40;
        }
        var skillProp = skillInfo.getProperty();
        var attackerAbilityLevels = attacker.getAbilityLevels();
        var defenderAbilityLevels = defender.getAbilityLevels();
        // 基础攻击
        var attackerAtk = skillInfo.getType() == SKILL_TYPES.PHYSICAL ? attacker.getBasicValues()[1] : attacker.getBasicValues()[3];
        // 基础防御
        var defenderDef = skillInfo.getType() == SKILL_TYPES.PHYSICAL ? defender.getBasicValues()[2] : defender.getBasicValues()[4];
        // 能力等级修正 如果防御方有天然特性跳过此步骤 todo
        var abilityAtkCorrection = 1 + (skillInfo.getType() == SKILL_TYPES.PHYSICAL ? attackerAbilityLevels[0] : attackerAbilityLevels[2]) * 0.1;
        var abilityDefCorrection = 1 + (skillInfo.getType() == SKILL_TYPES.PHYSICAL ? defenderAbilityLevels[1] : defenderAbilityLevels[3]) * 0.1;
        attackerAtk *= abilityAtkCorrection;
        defenderDef *= abilityDefCorrection;
        // 各种特性修正 todo
        // 基础伤害
        var basicHurt = Math.floor(((attacker.getLevel() * 2 / 5 + 2) * skillAtk * attackerAtk / defenderDef) / 50 + 2);
        // 天气修正 todo
        // 会心一击修正 todo
        var criticalCorrection = 1;
        // 暂定5%的会心率 还没有会心等级计算 todo
        if (Math.ceil(Math.random() * 100) <= 5) {
            criticalCorrection = 1.5;
        }
        // 随机数修正
        var randomCorrection = (Math.ceil(Math.random() * 15) + 85) / 100;
        // 属性修正
        var defenderProps = defender.getInfo().getProperties();
        var propertyCorrection = 1;
        for (var index in defenderProps) {
            var prop = defenderProps[index];
            propertyCorrection *= PROPERTY_MULTIPLIER[skillProp][prop];
        }
        // 本系属性修正
        var pokemonPropCorrection = 1;
        var attackerProps = attacker.getInfo().getProperties();
        for (var i in attackerProps) {
            if (attackerProps[i] === skillProp) {
                pokemonPropCorrection = 1.2;
                break;
            }
        }
        // 烧伤修正 todo
        var burnCorrection = 1;
        if (attacker.getState() == POKEMON_STATES.BURNED && skillInfo.getType() == SKILL_TYPES.PHYSICAL) {
            burnCorrection = 0.5;
        }
        // 实际伤害修正 todo
        basicHurt = Math.floor(basicHurt * randomCorrection * criticalCorrection * propertyCorrection * pokemonPropCorrection * burnCorrection);

        logBattle("会心一击修正: " + criticalCorrection.toString());
        logBattle("属性修正: " + propertyCorrection.toString());
        logBattle("本系属性修正: " + pokemonPropCorrection.toString());
        logBattle("伤害: %d", basicHurt);
        var hurtInfo = {
            hurt: basicHurt,
            criticalCorrection: criticalCorrection,
            propertyCorrection: propertyCorrection,
            didHit: true,
        };

        return hurtInfo;
    },
    _pokemon1: null,
    _pokemon2: null,
    _field1BuffList: null,
    _field2BuffList: null,
    _weather: null,     // [ weather, turns ]
    _behaviorQueue: null,


    /**
     * 技能处理函数
     */
    _handleParams: function (skillUser, target, skillInfo) {
        var logicParams = skillInfo.getLogicParams();
        var params = null;
        if (logicParams && logicParams.length > 0) {
            params = logicParams.split(";");
        }
        var extraData = {};
        if (params) {
            if (params[0] == 1 && skillUser.getRepeat() == 0) {
                // 特殊情形 (逆鳞类似技能)
                var args = params[1].split(",");
                var min = parseInt(args[0]);
                var max = parseInt(args[1]);
                var state = parseInt(args[2]);
                var rd = Math.floor(Math.random() * (max - min + 1));
                rd += min;
                skillUser.setRepeat(rd);
                skillUser.setNextBattleState(state);
            } else if (params[0] == 2) {
                // 回复生命值
                var percent = parseFloat(params[1]);
                var val = Math.floor(percent * target.getBasicValues()[0]);
                var delta = target.heal(val);
                extraData["delta"] = delta;
            } else if (params[0] == 3) {
                // 添加场地buff
                var args = params[1].split(",");
                var buffId = parseInt(args[0]);
                var turns = parseInt(args[1]);
                if (target[buffId]) {
                    extraData["hasBuff"] = true;
                } else {
                    target[buffId] = turns;
                }
                extraData["buffId"] = buffId;
            } else if (params[0] == 4) {
                // 某一方增加或减少能力等级
                var args = params[1].split(",");
                var rate = parseInt(args[0]);
                extraData["selfAnimationType"] = parseInt(args[1]);
                extraData["enemyAnimationType"] = parseInt(args[2]);
                extraData["selfShouldPlay"] = false;
                extraData["enemyShouldPlay"] = false;
                for (var i = 0; i < (args.length - 3) / 3; ++i) {
                    var tgt = parseInt(args[i * 3 + 3]);
                    var prop = parseInt(args[i * 3 + 4]);
                    var delta = parseInt(args[i * 3 + 5]);
                    var rd = Math.ceil(Math.random() * 100);
                    if (rd <= rate) {
                        if (tgt == 1 && extraData["selfAbilityLevels"] === undefined) {
                            extraData["selfAbilityLevels"] = [];
                        } else if (tgt == 2 && extraData["targetAbilityLevels"] === undefined) {
                            extraData["targetAbilityLevels"] = [];
                        }
                        if (tgt == 1) {
                            var success = skillUser.updateAbilityLevel(prop, delta);
                            if (success) {
                                extraData["selfShouldPlay"] = true;
                            }
                            extraData["selfAbilityLevels"].push([prop, delta, success]);
                        } else if (tgt == 2) {
                            var success = target.updateAbilityLevel(prop, delta);
                            if (success) {
                                extraData["enemyShouldPlay"] = true;
                            }
                            extraData["targetAbilityLevels"].push([prop, delta, success]);
                        }
                    }
                }
            } else if (params[0] == 5) {
                // 一定概率给敌方添加战斗状态
                var args = params[1].split(",");
                var rate = parseInt(args[0]);
                var state = parseInt(args[1]);
                var rd = Math.ceil(Math.random() * 100);
                if (rd <= rate) {
                    target.setNewBattleState(state);
                }
            } else if (params[0] == 6) {
                // 一定概率给敌方添加异常状态
                var args = params[1].split(",");
                var rate = parseInt(args[0]);
                var state = parseInt(args[1]);
                var rd = Math.ceil(Math.random() * 100);
                if (rd <= rate) {
                    target.setNewState(state);
                }
            } else if (params[0] == 7) {
                // 吸血
                var args = params[1].split(",");
                var percent = parseFloat(args[0]);
                extraData["healPercent"] = percent;
            } else if (params[0] == 8) {
                // 两回合技能
                if (!skillUser.isPreparing()) {
                    var args = params[1].split(",");
                    var string = args[0];
                    var animType = parseInt(args[1]);
                    var animName = args[2];
                    extraData["isPreparing"] = true;
                    extraData["string"] = string;
                    extraData["animType"] = animType;
                    extraData["animName"] = animName;
                    skillUser.setPrepare(true);
                } else {
                    skillUser.setPrepare(false);
                }
            } else if (params[0] == 9) {
                // 反冲伤害
                var args = params[1].split(",");
                var percent = parseFloat(args[0]);
                extraData["hurtPercent"] = percent;
            } else if (params[0] == 10) {
                // 天气
                var args = params[1].split(",");
                var weather = parseInt(args[0]);
                var turns = parseInt(args[1]);
                extraData["weather"] = weather;
                if (this.getWeather() != weather) {
                    this._weather = [weather, turns];
                } else {
                    extraData["hasWeather"] = true;
                }
            }
        }
        return extraData;
    },
    _mergeData: function (targetData, data) {
        for (var key in data) {
            targetData[key] = data[key];
        }
    },
    // 攻击单体
    _skillAttackOne: function (skillUser, target, skillInfo) {
        var didHit = this._calculateHit(skillUser, target, skillInfo);
        if (!didHit) {
            return { notHit: true };
        }
        var extraData = this._handleParams(skillUser, target, skillInfo);
        extraData["attacker"] = skillUser;
        extraData["defender"] = target;
        extraData["isHurtSkill"] = true;
        extraData["targetType"] = 1;
        if (!extraData["isPreparing"]) {
            var hurtInfo = this._calculateHurt(skillUser, target, skillInfo);
            if (hurtInfo["propertyCorrection"] == 0) {
                return { noEffect: true };
            }
            this._mergeData(extraData, hurtInfo);
            extraData["delta"] = target.hurt(hurtInfo["hurt"]);
        }

        if (skillUser.getRepeat() > 0) {
            skillUser.reduceRepeat();
        }

        return extraData;
    },
    // 攻击敌方全体
    _skillAttackEnemyAll: function (skillUser, target, skillInfo) {
        var didHit = this._calculateHit(skillUser, target, skillInfo);
        if (!didHit) {
            return { notHit: true };
        }
        var extraData = this._handleParams(skillUser, target, skillInfo);
        var hurtInfo = this._calculateHurt(skillUser, target, skillInfo);
        if (hurtInfo["propertyCorrection"] == 0) {
            return { noEffect: true };
        }
        this._mergeData(extraData, hurtInfo);
        extraData["attacker"] = skillUser;
        extraData["defender"] = target;
        extraData["delta"] = target.hurt(hurtInfo["hurt"]);
        extraData["isHurtSkill"] = true;
        extraData["targetType"] = 1;

        return extraData;
    },
    // 吸血
    _skillSuckOne: function (skillUser, target, skillInfo) {
        var didHit = this._calculateHit(skillUser, target, skillInfo);
        if (!didHit) {
            return { notHit: true };
        }
        var extraData = this._handleParams(skillUser, target, skillInfo);
        var hurtInfo = this._calculateHurt(skillUser, target, skillInfo);
        if (hurtInfo["propertyCorrection"] == 0) {
            return { noEffect: true };
        }
        this._mergeData(extraData, hurtInfo);
        extraData["attacker"] = skillUser;
        extraData["defender"] = target;
        extraData["delta"] = target.hurt(hurtInfo["hurt"]);
        extraData["heal"] = skillUser.heal(Math.floor(extraData["healPercent"] * extraData["delta"]));
        extraData["isHurtSkill"] = true;
        extraData["targetType"] = 1;

        return extraData;
    },
    // 双刃剑伤害
    _skillHurtSelfAttack: function (skillUser, target, skillInfo) {
        var didHit = this._calculateHit(skillUser, target, skillInfo);
        if (!didHit) {
            return { notHit: true };
        }
        var extraData = this._handleParams(skillUser, target, skillInfo);
        var hurtInfo = this._calculateHurt(skillUser, target, skillInfo);
        if (hurtInfo["propertyCorrection"] == 0) {
            return { noEffect: true };
        }
        this._mergeData(extraData, hurtInfo);
        extraData["attacker"] = skillUser;
        extraData["defender"] = target;
        extraData["delta"] = target.hurt(hurtInfo["hurt"]);
        extraData["selfHurt"] = skillUser.hurt(Math.floor(extraData["hurtPercent"] * extraData["delta"]));
        extraData["isHurtSkill"] = true;
        extraData["targetType"] = 1;

        return extraData
    },
    // 单体回复HP
    _skillRecoverOne: function (skillUser, target, skillInfo) {
        var extraData = this._handleParams(skillUser, target, skillInfo);
        extraData["skiller"] = skillUser;
        extraData["isHealSkill"] = true;
        if (target instanceof Pokemon) {
            extraData["targetType"] = 1;
            extraData["defender"] = target;
        }

        return extraData;
    },
    // 给场地添加buff
    _skillBuffField: function (skillUser, target, skillInfo) {
        var extraData = this._handleParams(skillUser, target, skillInfo);
        extraData["skiller"] = skillUser;
        extraData["isFieldSkill"] = true;
        extraData["isFriend"] = (target == this._field1BuffList);
        extraData["targetType"] = 2;

        return extraData;
    },
    // 无其他行动
    _skillVariance: function (skillUser, target, skillInfo) {
        var didHit = this._calculateHit(skillUser, target, skillInfo);
        if (!didHit) {
            return { notHit: true };
        }
        var extraData = this._handleParams(skillUser, target, skillInfo);
        extraData["attacker"] = skillUser;
        extraData["defender"] = target;
        extraData["isVarianceSkill"] = true;
        extraData["targetType"] = 1;

        return extraData;
    },
    // 一击必杀
    _skillKillOne: function (skillUser, target, skillInfo) {
        // 属性修正为0
        var defenderProps = target.getInfo().getProperties();
        for (var index in defenderProps) {
            var prop = defenderProps[index];
            var skillProp = skillInfo.getProperty();
            if (PROPERTY_MULTIPLIER[skillProp][prop] == 0) {
                return { noEffect: true };
            }
        }
        // 等级低的话必定不中
        if (skillUser.getLevel() < target.getLevel()) {
            return { notHit: true };
        }
        var didHit = this._calculateHit(skillUser, target, skillInfo);
        if (!didHit) {
            return { notHit: true };
        }
        var extraData = {};
        extraData["attacker"] = skillUser;
        extraData["defender"] = target;
        extraData["isKillSkill"] = true;
        extraData["targetType"] = 1;
        extraData["delta"] = target.getHp();
        target.hurt(target.getHp());

        return extraData;
    },
    // 攻击一回合下回合不能动弹
    _skillTiredAttackOne: function (skillUser, target, skillInfo) {
        var didHit = this._calculateHit(skillUser, target, skillInfo);
        if (!didHit) {
            return { notHit: true };
        }
        var extraData = this._handleParams(skillUser, target, skillInfo);
        var hurtInfo = this._calculateHurt(skillUser, target, skillInfo);
        if (hurtInfo["propertyCorrection"] == 0) {
            return { noEffect: true };
        }
        this._mergeData(extraData, hurtInfo);
        extraData["attacker"] = skillUser;
        extraData["defender"] = target;
        extraData["delta"] = target.hurt(hurtInfo["hurt"]);
        extraData["isHurtSkill"] = true;
        extraData["targetType"] = 1;

        skillUser.addBattleState(BATTLE_STATES.TIRED, 1);

        return extraData;
    },
    // 改变天气
    _skillChangeWeather: function (skillUser, target, skillInfo) {
        // 天气锁 无天气 todo
        var extraData = this._handleParams(skillUser, target, skillInfo);
        extraData["skiller"] = skillUser;
        extraData["isWeatherSkill"] = true;
        extraData["targetType"] = 3;

        return extraData;
    },
    // 自身HP越高伤害越高
    _skillHPAttackOne: function (skillUser, target, skillInfo) {
        var didHit = this._calculateHit(skillUser, target, skillInfo);
        if (!didHit) {
            return { notHit: true };
        }
        var extraData = this._handleParams(skillUser, target, skillInfo);
        var hurtInfo = this._calculateHurt(skillUser, target, skillInfo);
        if (hurtInfo["propertyCorrection"] == 0) {
            return { noEffect: true };
        }
        this._mergeData(extraData, hurtInfo);
        extraData["attacker"] = skillUser;
        extraData["defender"] = target;
        extraData["delta"] = target.hurt(Math.floor(hurtInfo["hurt"] * skillUser.getHp() / skillUser.getBasicValues()[0]));
        extraData["isHurtSkill"] = true;
        extraData["targetType"] = 1;

        return extraData;
    },
});