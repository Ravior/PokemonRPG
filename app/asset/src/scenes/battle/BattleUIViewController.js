/**
 * Created by Maple on 8/15/15.
 */

var BattleUIViewController = mw.ViewController.extend({
    TEXTURES_TO_LOAD: {
        "textures/battle.plist": "textures/battle.pvr.ccz",
    },
    ctor: function (segue) {
        this._super(segue);
    },
    viewDidLoad: function () {
        this._loadTextures();
        this._renderView();
    },
    viewDidUnload: function () {
        this._unloadTextures();
    },
    _loadTextures: function () {
        for (var plist in this.TEXTURES_TO_LOAD) {
            var tex = this.TEXTURES_TO_LOAD[plist];
            TextureManager.loadTexture(plist, tex);
        }
    },
    _unloadTextures: function () {
        for (var plist in this.TEXTURES_TO_LOAD) {
            TextureManager.unloadTexture(plist);
        }
    },
    _renderView: function () {
        var bg = new cc.Sprite("#battle/battle_bg.png");
        bg.setPosition(cc.director.getWinSize().width * 0.5, cc.director.getWinSize().height * 0.5);
        this.view().addChild(bg);

        var pokemon1Id = parseInt(this.scene().getParameter("pokemon1"));
        var pokemon2Id = parseInt(this.scene().getParameter("pokemon2"));
        mw.logWithTag("mlgb", "Pokemon1: %d, Pokemon2: %d", pokemon1Id, pokemon2Id);
        var pokemon1Model = new Pokemon({ id: pokemon1Id });
        var pokemon2Model = new Pokemon({ id: pokemon2Id });

        this._pokemon1 = new BattlePokemonView(pokemon1Model, true);
        this._pokemon2 = new BattlePokemonView(pokemon2Model, false);

        this._pokemon1.setPosition(cc.director.getWinSize().width * 0.2, cc.director.getWinSize().height * 0.2);
        this.view().addChild(this._pokemon1);
        this._pokemon2.setPosition(cc.director.getWinSize().width * 0.8, cc.director.getWinSize().height * 0.6);
        this.view().addChild(this._pokemon2);

        //this._playerBoard = new BattlePlayerBoardView(pokemon1Model);
        //this._playerBoard.setPosition(cc.director.getWinSize().width * 0.5, cc.director.getWinSize().height * 0.5);
        //this.view().addChild(this._playerBoard);
    },
    _pokemon1: null,
    _pokemon2: null,
});