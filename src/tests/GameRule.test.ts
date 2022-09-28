import {GameRule, GameRules} from "../classes";
import {EnabledStatus, GameStage} from "../enums/enums";

describe('GameRule', function () {

    it('should initialize and backfill', function (done) {
        const rule = new GameRule(
            GameRules.allow_player_move,
            {
                [GameStage.Pre_begin]: EnabledStatus.Force_off,
                [GameStage.Player_moves_enabled]: EnabledStatus.Force_on,
                [GameStage.Player_moves_complete]: EnabledStatus.Force_off
            }
        )
        expect(rule).toBeInstanceOf(GameRule)
        expect(rule.values[GameStage.Pre_begin]).toEqual(EnabledStatus.Force_off)
        expect(rule.values[GameStage.Initial_presentation]).toEqual(EnabledStatus.Force_off)
        expect(rule.values[GameStage.Player_moves_enabled]).toEqual(EnabledStatus.Force_on)
        expect(rule.values[GameStage.Player_moves_in_progress]).toEqual(EnabledStatus.Force_on)
        expect(rule.values[GameStage.Player_moves_complete]).toEqual(EnabledStatus.Force_off)
        expect(rule.values[GameStage.Reveal_moves]).toEqual(EnabledStatus.Force_off)
        expect(rule.values[GameStage.Reveal_payoff]).toEqual(EnabledStatus.Force_off)
        expect(rule.values[GameStage.Cleanup]).toEqual(EnabledStatus.Force_off)
        expect(rule.values[GameStage.End]).toEqual(EnabledStatus.Force_off)
        done()
    })

    it('should initialize from single value', function(done) {
        const rule = new GameRule(GameRules.allow_video, EnabledStatus.Force_on)
        expect(rule).toBeInstanceOf(GameRule)
        for(const s of Object.values(GameStage)) {
            expect(rule.values[s]).toEqual(EnabledStatus.Force_on)
        }
        done()
    })
})