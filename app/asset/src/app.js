
var App = cc.Class.extend({
    ctor: function() {
        jsb.fileUtils.addSearchPath("res");

        ex.GameAudioEngine.getInstance().setMaxAudioInstance(10);
        TextureManager.setPvrTexturesSupportPremultipliedAlpha(true);
    },
    run: function() {
        var scene = new BattleScene();
        scene.addParameter("pokemon1", "250");
        scene.addParameter("pokemon2", "150");
        cc.director.runScene(new cc.TransitionFade(0.5, scene));
    }
});