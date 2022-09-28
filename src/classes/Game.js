"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = exports.stage_delay_default = void 0;
var enums_1 = require("../enums/enums");
var ManagerComponent_1 = require("./ManagerComponent");
var GameRule_1 = require("./GameRule");
exports.stage_delay_default = 1000;
/**
 * A Game is a single round of a game theory interaction.
 * It progresses through the GameStages.
 * Each GameStage can be hooked by including a function with that GameStage name.
 */
var Game = /** @class */ (function (_super) {
    __extends(Game, _super);
    function Game(manager, props) {
        var _a, _b, _c, _d, _e;
        var _this = _super.call(this, manager) || this;
        _this.active = false;
        _this.stage = enums_1.GameStage.Pre_begin;
        _this.moves = [];
        _this.payoffs = [];
        _this.resultString = "";
        _this.rules = [
            new GameRule_1.GameRule(enums_1.GameRules.allow_chat, enums_1.EnabledStatus.Force_off),
            new GameRule_1.GameRule(enums_1.GameRules.allow_video, enums_1.EnabledStatus.Force_on),
            new GameRule_1.GameRule(enums_1.GameRules.show_description, enums_1.EnabledStatus.Force_on),
            new GameRule_1.GameRule(enums_1.GameRules.show_payoff_matrix, (_a = {},
                _a[enums_1.GameStage.Pre_begin] = enums_1.EnabledStatus.Force_off,
                _a[enums_1.GameStage.Initial_presentation] = enums_1.EnabledStatus.Force_on,
                _a[enums_1.GameStage.Player_moves_complete] = enums_1.EnabledStatus.Force_off,
                _a)),
            new GameRule_1.GameRule(enums_1.GameRules.allow_player_move, (_b = {},
                _b[enums_1.GameStage.Pre_begin] = enums_1.EnabledStatus.Force_off,
                _b[enums_1.GameStage.Player_moves_enabled] = enums_1.EnabledStatus.Force_on,
                _b[enums_1.GameStage.Player_moves_complete] = enums_1.EnabledStatus.Force_off,
                _b)),
            new GameRule_1.GameRule(enums_1.GameRules.show_partner_moves, (_c = {},
                _c[enums_1.GameStage.Pre_begin] = enums_1.EnabledStatus.Force_off,
                _c[enums_1.GameStage.Reveal_moves] = enums_1.EnabledStatus.Force_on,
                _c)),
            new GameRule_1.GameRule(enums_1.GameRules.show_partner_payoff, (_d = {},
                _d[enums_1.GameStage.Pre_begin] = enums_1.EnabledStatus.Force_off,
                _d[enums_1.GameStage.Reveal_payoff] = enums_1.EnabledStatus.Force_on,
                _d)),
            new GameRule_1.GameRule(enums_1.GameRules.show_own_score, enums_1.EnabledStatus.Force_on),
            new GameRule_1.GameRule(enums_1.GameRules.show_partner_score, enums_1.EnabledStatus.Force_on),
        ];
        _this.rewrite_rule = function (move, game) { return move; };
        _this.timings = (_e = {},
            _e[enums_1.GameStage.Pre_begin] = 100,
            _e[enums_1.GameStage.Initial_presentation] = 1000,
            _e[enums_1.GameStage.Reveal_moves] = 1000,
            _e[enums_1.GameStage.Reveal_payoff] = 1000,
            _e);
        _this.default_timing = exports.stage_delay_default;
        _this.stage_timestamps = {};
        _this.decision_labels = [{ text: 'cooperate' }, { text: 'defect' }];
        _this.hooks = [
            {
                stage: enums_1.GameStage.Pre_begin,
                fun: function (game) {
                    setTimeout(function (game) { return game.advance_stage(); }, game.delay, game);
                }
            },
            {
                stage: enums_1.GameStage.Initial_presentation,
                fun: function (game) {
                    setTimeout(function (game) { return game.advance_stage(); }, game.delay, game);
                }
            },
            {
                stage: enums_1.GameStage.Player_moves_enabled,
                fun: function (game) {
                    // Set up move listeners for the sockets
                    function do_move(move) {
                        var _this = this;
                        function reject(socket, error) {
                            game._manager.logger.error("Socket ".concat(socket.id, " error: ").concat(error));
                            socket.emit('error', error);
                            socket.once('makeMove', do_move);
                        }
                        // Check move is valid
                        var new_move;
                        try {
                            new_move = {
                                player_index: game._manager.players.find(function (p) { return p.socket === _this; }).index,
                                index: move ? 1 : 0,
                                label: game.decision_labels[move ? 1 : 0],
                                timestamp: new Date().getTime()
                            };
                        }
                        catch (e) {
                            return reject(this, "That is not a valid move.");
                        }
                        // Record move
                        game._manager.logger.debug("New move: ".concat(new_move.player_index, " selects '").concat(new_move.label.text, "' [").concat(new_move.index, "]"));
                        game.moves.push(new_move);
                        // If both players have moved, proceed
                        if (game.moves.length === 2) {
                            game.advance_stage();
                        }
                    }
                    game._manager.players.forEach(function (p) { return p.socket.once('makeMove', do_move); });
                    game.advance_stage();
                }
            },
            {
                stage: enums_1.GameStage.Player_moves_complete,
                fun: function (game) { return game.advance_stage(); }
            },
            {
                stage: enums_1.GameStage.Reveal_moves,
                fun: function (game) { return setTimeout(function (game) { return game.advance_stage(); }, game.delay, game); }
            },
            {
                stage: enums_1.GameStage.Reveal_payoff,
                fun: function (game) {
                    // Matrix indexed by player move values
                    // Player 2 (index=1) first because P1 is columns and P2 is rows!
                    var payoffs = game.payoff_matrix[game.rewritten_moves.find(function (m) { return game._manager.getPlayerByIndex(m.player_index).index === 1; }).index][game.rewritten_moves.find(function (m) { return game._manager.getPlayerByIndex(m.player_index).index === 0; }).index];
                    game.payoffs = payoffs.payoffs;
                    game.resultString = payoffs.resultString(game._manager.players[0], game._manager.players[1]);
                    game._manager.logger.debug("".concat(game.resultString, " [P1=").concat(game.payoffs[0].value, ", P2=").concat(game.payoffs[1].value, "]"));
                    game.moves.forEach(function (m) {
                        var p = game._manager.getPlayerByIndex(m.player_index);
                        p.score += game.payoffs[p.index].value;
                    });
                    setTimeout(function (game) { return game.advance_stage(); }, game.delay, game);
                }
            },
            {
                stage: enums_1.GameStage.End,
                fun: function (game) { return setTimeout(function (game) { return game.advance_stage(); }, game.delay, game); }
            },
            {
                stage: enums_1.GameStage.Cleanup,
                fun: function (game) { return game._manager.next_game(); }
            }
        ];
        for (var p in props) {
            _this[p] = props[p];
        }
        return _this;
    }
    Object.defineProperty(Game.prototype, "state", {
        get: function () {
            var rules = {};
            for (var _i = 0, _a = this.rules; _i < _a.length; _i++) {
                var r = _a[_i];
                rules[r.name] = r.values[this.stage];
            }
            return {
                name: this.name,
                description: this.description,
                prompt: this.prompt,
                stage: this.stage,
                rules: rules,
                decision_labels: this.decision_labels,
                moves: this.moves,
                rewritten_moves: this.rewritten_moves,
                payoffs: this.payoffs,
                resultString: this.resultString,
                timestamp: new Date().getTime()
            };
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Game.prototype, "rewritten_moves", {
        get: function () {
            var _this = this;
            return this.moves.map(function (m) { return _this.rewrite_rule(m, _this); });
        },
        enumerable: false,
        configurable: true
    });
    Game.prototype.advance_stage = function (force_stage) {
        var _this = this;
        this._manager.logger.debug("advance_stage(".concat(force_stage, ")"));
        var found = false;
        var new_stage;
        if (typeof force_stage === 'undefined') {
            for (var gamestage in enums_1.GameStage) {
                var stage = enums_1.GameStage[gamestage];
                if (found) {
                    new_stage = stage;
                    break;
                }
                else if (stage === this.stage) {
                    found = true;
                }
            }
        }
        else {
            new_stage = force_stage;
        }
        if (!new_stage) {
            this._manager.logger.debug("No next stage found from ".concat(this.stage));
        }
        this._manager.logger.debug("Stage ".concat(this.stage, " -> ").concat(new_stage));
        this.stage_timestamps["".concat(this.stage, "_end")] = new Date().getTime();
        var hooks = this.hooks.filter(function (h) { return h.stage === _this.stage && h.when === "post"; });
        if (hooks.length) {
            this._manager.logger.debug("Executing ".concat(hooks.length, " hooked functions for post_").concat(this.stage));
            hooks.forEach(function (h) { return h.fun(_this, h.context_arg); });
        }
        this.stage_timestamps["".concat(this.stage, "_post_complete")] = new Date().getTime();
        this.stage = new_stage;
        // Execute hooked functions
        this.stage_timestamps["".concat(this.stage, "_pre")] = new Date().getTime();
        hooks = this.hooks.filter(function (h) { return h.stage === _this.stage && h.when === "pre"; });
        if (hooks.length) {
            this._manager.logger.debug("Executing ".concat(hooks.length, " hooked functions for pre_").concat(this.stage));
            hooks.forEach(function (h) { return h.fun(_this, h.context_arg); });
        }
        hooks = this.hooks.filter(function (h) { return h.stage === _this.stage && !h.when; });
        if (hooks.length) {
            this._manager.logger.debug("Executing ".concat(hooks.length, " hooked functions for ").concat(this.stage));
            hooks.forEach(function (h) { return h.fun(_this, h.context_arg); });
        }
        this.stage_timestamps["".concat(this.stage, "_start")] = new Date().getTime();
        this._manager.broadcast();
    };
    Game.prototype.get_rule = function (rule) {
        try {
            return this.rules.find(function (r) { return r.name === rule; }).values[this.stage];
        }
        catch (e) {
            return enums_1.EnabledStatus.Unset;
        }
    };
    Object.defineProperty(Game.prototype, "index", {
        get: function () {
            return this._manager.games.indexOf(this);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Game.prototype, "delay", {
        get: function () {
            if (typeof this.timings[this.stage] === 'number')
                return this.timings[this.stage];
            return this.default_timing;
        },
        enumerable: false,
        configurable: true
    });
    return Game;
}(ManagerComponent_1.ManagerComponent));
exports.Game = Game;
//# sourceMappingURL=Game.js.map