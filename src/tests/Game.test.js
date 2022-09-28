"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var classes_1 = require("../classes");
var enums_1 = require("../enums/enums");
var stubs_1 = require("./stubs");
describe('Game', function () {
    it('should initialize', function (done) {
        var game = new classes_1.Game(stubs_1.manager_stub, {});
        expect(game).toBeInstanceOf(classes_1.Game);
        expect(game.stage).toEqual(enums_1.GameStage.Pre_begin);
        game.advance_stage();
        expect(game.stage).toEqual(enums_1.GameStage.Initial_presentation);
        setTimeout(done, game.delay * 2);
    });
});
//# sourceMappingURL=Game.test.js.map