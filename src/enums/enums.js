"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRules = exports.EnabledStatus = exports.GameStage = void 0;
var GameStage;
(function (GameStage) {
    GameStage["Pre_begin"] = "Pre-begin";
    GameStage["Initial_presentation"] = "Initial presentation";
    GameStage["Player_moves_enabled"] = "Player moves enabled";
    GameStage["Player_moves_in_progress"] = "Player moves in progress";
    GameStage["Player_moves_complete"] = "Player moves complete";
    GameStage["Reveal_moves"] = "Reveal moves";
    GameStage["Reveal_payoff"] = "Reveal payoff";
    GameStage["End"] = "End";
    GameStage["Cleanup"] = "Cleanup";
})(GameStage = exports.GameStage || (exports.GameStage = {}));
var EnabledStatus;
(function (EnabledStatus) {
    EnabledStatus[EnabledStatus["Force_off"] = -1] = "Force_off";
    EnabledStatus[EnabledStatus["Unset"] = 0] = "Unset";
    EnabledStatus[EnabledStatus["Force_on"] = 1] = "Force_on";
})(EnabledStatus = exports.EnabledStatus || (exports.EnabledStatus = {}));
var GameRules;
(function (GameRules) {
    GameRules["allow_chat"] = "allow chat";
    GameRules["allow_video"] = "allow video";
    GameRules["allow_player_move"] = "allow player move";
    GameRules["show_description"] = "show description";
    GameRules["show_own_score"] = "show own score";
    GameRules["show_payoff_matrix"] = "show payoff matrix";
    GameRules["show_partner_moves"] = "show partner moves";
    GameRules["show_partner_payoff"] = "show partner payoff";
    GameRules["show_partner_score"] = "show partner score";
})(GameRules = exports.GameRules || (exports.GameRules = {}));
//# sourceMappingURL=enums.js.map