import {Game} from "../classes";
import {GameStage} from "../enums/enums";
import {manager_stub} from "./stubs";

describe('Game', function () {

    it('should initialize', function (done) {
        const game = new Game(manager_stub, {})
        expect(game).toBeInstanceOf(Game)
        expect(game.stage).toEqual(GameStage.Pre_begin)
        game.advance_stage()
        expect(game.stage).toEqual(GameStage.Initial_presentation)
        setTimeout(done, game.delay * 2)
    })
})