"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var classes_1 = require("../classes");
var enums_1 = require("../enums/enums");
describe('GameRule', function () {
    it('should initialize and backfill', function (done) {
        var _a;
        var rule = new classes_1.GameRule(classes_1.GameRules.allow_player_move, (_a = {},
            _a[enums_1.GameStage.Pre_begin] = enums_1.EnabledStatus.Force_off,
            _a[enums_1.GameStage.Player_moves_enabled] = enums_1.EnabledStatus.Force_on,
            _a[enums_1.GameStage.Player_moves_complete] = enums_1.EnabledStatus.Force_off,
            _a));
        expect(rule).toBeInstanceOf(classes_1.GameRule);
        expect(rule.values[enums_1.GameStage.Pre_begin]).toEqual(enums_1.EnabledStatus.Force_off);
        expect(rule.values[enums_1.GameStage.Initial_presentation]).toEqual(enums_1.EnabledStatus.Force_off);
        expect(rule.values[enums_1.GameStage.Player_moves_enabled]).toEqual(enums_1.EnabledStatus.Force_on);
        expect(rule.values[enums_1.GameStage.Player_moves_in_progress]).toEqual(enums_1.EnabledStatus.Force_on);
        expect(rule.values[enums_1.GameStage.Player_moves_complete]).toEqual(enums_1.EnabledStatus.Force_off);
        expect(rule.values[enums_1.GameStage.Reveal_moves]).toEqual(enums_1.EnabledStatus.Force_off);
        expect(rule.values[enums_1.GameStage.Reveal_payoff]).toEqual(enums_1.EnabledStatus.Force_off);
        expect(rule.values[enums_1.GameStage.Cleanup]).toEqual(enums_1.EnabledStatus.Force_off);
        expect(rule.values[enums_1.GameStage.End]).toEqual(enums_1.EnabledStatus.Force_off);
        done();
    });
    it('should initialize from single value', function (done) {
        var rule = new classes_1.GameRule(classes_1.GameRules.allow_video, enums_1.EnabledStatus.Force_on);
        expect(rule).toBeInstanceOf(classes_1.GameRule);
        for (var _i = 0, _a = Object.values(enums_1.GameStage); _i < _a.length; _i++) {
            var s = _a[_i];
            expect(rule.values[s]).toEqual(enums_1.EnabledStatus.Force_on);
        }
        done();
    });
});
//# sourceMappingURL=GameRule.test.js.map