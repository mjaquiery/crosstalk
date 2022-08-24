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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var log4js = require("log4js");
var stage_delay = 1000;
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
})(GameStage || (GameStage = {}));
var EnabledStatus;
(function (EnabledStatus) {
    EnabledStatus[EnabledStatus["Force_off"] = -1] = "Force_off";
    EnabledStatus[EnabledStatus["Unset"] = 0] = "Unset";
    EnabledStatus[EnabledStatus["Force_on"] = 1] = "Force_on";
})(EnabledStatus || (EnabledStatus = {}));
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
})(GameRules || (GameRules = {}));
var GameRule = /** @class */ (function () {
    /**
     * A Rule maps GameStages to EnabledStatuses.
     * The value can be supplied as a single EnabledStatus, which will be copied to all GameStages,
     * or as an object with GameStages as keys and EnabledStatuses as values.
     *
     * If given an object, the following rules are used for working out what the EnabledStatus will
     * be at each GameStage:
     * * If an EnabledStatus is declared for this GameStage, use that
     * * Otherwise, use the EnabledStatus last declared.
     * * Otherwise, use the first EnabledStatus that is declared
     */
    function GameRule(name, values) {
        this.name = name;
        var _values = {};
        if (values instanceof Object) {
            var last_value = void 0;
            var backfill = [];
            for (var gamestage in GameStage) {
                var stage = GameStage[gamestage];
                if (values[stage] in EnabledStatus) {
                    _values[stage] = values[stage];
                    last_value = values[stage];
                    while (backfill.length) {
                        _values[backfill.pop()] = last_value;
                    }
                }
                else if (typeof last_value !== 'undefined') {
                    _values[stage] = last_value;
                }
                else {
                    backfill.push(stage);
                }
            }
        }
        else {
            // Single value supplied
            for (var gamestage in GameStage) {
                var stage = GameStage[gamestage];
                _values[stage] = values;
            }
        }
        // @ts-ignore -- we know we have a full set of values here because we iterated through
        this.values = _values;
    }
    return GameRule;
}());
var Manager = /** @class */ (function () {
    function Manager(server) {
        var _a;
        this.server = server;
        this.players = [];
        this.games = [];
        this.messages = [];
        this.videos = [];
        this.id = "game_" + new Date().getTime().toString();
        log4js.configure({
            appenders: __assign(__assign({}, log4js.appenders), (_a = {}, _a[this.id] = {
                type: "file",
                filename: process.env.GAME_LOG + "/" + this.id + ".log",
                // layout: { type: "basic" }
            }, _a)),
            categories: { default: { appenders: [this.id], level: "error", enableCallStack: true } },
        });
        var logger = log4js.getLogger(this.id);
        logger.level = log4js.DEBUG;
        this.logger = logger;
        this.logger.debug("Manger initialized.");
    }
    Manager.prototype.add_player = function (socket) {
        var _this = this;
        if (this.players.length === 2) {
            this.logger.error("Refusing to allow " + socket.id + " to join: too many players.");
            socket.emit('error', "Too many players!");
        }
        var player = new Player(this, { socket: socket, index: this.players.length });
        var existing_player = this.players.find(function (p) { return p.id === player.id; });
        if (existing_player) {
            existing_player.socket = socket;
        }
        else {
            this.players.push(player);
            this.logger.debug(player.name + " joined [" + player.id + "]");
            socket.on('leave', function () { return setTimeout(function (manager, player) { return manager.remove_player(player); }, stage_delay, _this, player); });
            socket.on('disconnect', function () { return setTimeout(function (manager, player) { return manager.remove_player(player); }, stage_delay, _this, player); });
        }
        if (this.players.length === 2) {
            this.next_game();
        }
        this.broadcast();
    };
    Manager.prototype.remove_player = function (player) {
        if (this.getPlayerById(player.id)) {
            this.players = this.players.filter(function (p) { return p.id !== player.id; });
            this.logger.debug("Player " + player.name + " left [" + player.id + "]");
            this.broadcast();
        }
    };
    Manager.prototype.add_games = function (games) {
        var _a;
        if (!(games instanceof Array)) {
            games = [games];
        }
        (_a = this.games).push.apply(_a, games);
    };
    Object.defineProperty(Manager.prototype, "current_game", {
        get: function () {
            try {
                return this.games.filter(function (g) { return g.active === true; })[0];
            }
            catch (e) {
                return null;
            }
        },
        enumerable: false,
        configurable: true
    });
    Manager.prototype.next_game = function () {
        if (this.current_game instanceof Game) {
            var i = this.games.indexOf(this.current_game) + 1;
            this.current_game.active = false;
            if (this.games.length > i) {
                console.debug("Starting game " + i);
                this.games[i].active = true;
            }
        }
        else {
            console.debug("Starting game 0");
            this.games[0].active = true;
        }
        if (this.current_game instanceof Game) {
            console.debug("Starting game " + this.current_game.name);
            this.current_game.advance_stage(GameStage.Pre_begin);
        }
        else {
            console.debug("All " + this.games.length + " game(s) complete.");
            this.broadcast();
        }
    };
    /**
     * Game state view for a player, redacted as necessary
     */
    Manager.prototype.get_game_state = function (player, log) {
        var _a;
        if (log === void 0) { log = false; }
        var manager = this;
        var players;
        var game;
        if (this.current_game instanceof Game) {
            players = this.players.map(function (p) {
                var showScore = false;
                if (p === player && manager.current_game.get_rule(GameRules.show_own_score)) {
                    showScore = true;
                }
                else if (player !== p && manager.current_game.get_rule(GameRules.show_partner_score)) {
                    showScore = true;
                }
                return {
                    index: p.index,
                    name: p.name,
                    score: showScore ? p.score : null,
                    you: p === player
                };
            });
            game = __assign(__assign({}, this.current_game.state), { moves: this.current_game.get_rule(GameRules.show_partner_moves) ?
                    this.current_game.state.moves : (_a = {}, _a[player.index] = this.current_game.state.moves[player.index], _a), payoffs: this.current_game.get_rule(GameRules.show_partner_payoff) ?
                    this.current_game.payoffs : this.current_game.state.payoffs.map(function (po, i) { return i === player.index ? po : null; }), number: this.current_game.index + 1 });
        }
        else {
            players = this.players.map(function (p) {
                return { index: p.index, name: p.name, you: p === player, score: p.score };
            });
        }
        return {
            players: players,
            game: game,
            game_count: this.games.length
        };
    };
    Manager.prototype.log_game_state = function () {
        if (this.current_game instanceof Game) {
            this.logger.info("<< Broadcast game state >>");
            this.logger.info(this.current_game.state);
            this.logger.info(this.players);
            this.logger.info("<< Broadcast ends >>");
        }
        else {
            this.logger.info("<< Broadcast game state >>");
            this.logger.info("No game currently active");
            this.logger.info(this.players);
            this.logger.info("<< Broadcast ends >>");
        }
    };
    Manager.prototype.broadcast = function () {
        this.log_game_state();
        for (var _i = 0, _a = this.players; _i < _a.length; _i++) {
            var p = _a[_i];
            // redact gamestate if necessary
            p.socket.emit('gameStateUpdate', JSON.stringify(this.get_game_state(p)));
        }
    };
    Manager.prototype.getPlayerById = function (id) {
        return this.players.find(function (p) { return p.id === id; });
    };
    Manager.prototype.getPlayerByIndex = function (index) {
        return this.players.find(function (p) { return p.index === index; });
    };
    return Manager;
}());
var ManagerComponent = /** @class */ (function () {
    function ManagerComponent(manager) {
        this._manager = manager;
    }
    Object.defineProperty(ManagerComponent.prototype, "state", {
        get: function () { return null; },
        enumerable: false,
        configurable: true
    });
    return ManagerComponent;
}());
var Player = /** @class */ (function (_super) {
    __extends(Player, _super);
    function Player(manager, props) {
        var _this = _super.call(this, manager) || this;
        _this.score = 0;
        _this.index = 0;
        _this.socket = props.socket;
        _this._id = props.socket.id;
        _this.index = props.index ? 1 : 0;
        _this._name = "Player " + (_this.index + 1);
        return _this;
    }
    Object.defineProperty(Player.prototype, "id", {
        get: function () { return this._id; },
        set: function (new_id) { this._id = new_id; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Player.prototype, "name", {
        get: function () { return this._name; },
        set: function (new_name) {
            this._name = new_name;
        },
        enumerable: false,
        configurable: true
    });
    return Player;
}(ManagerComponent));
/**
 * A Game is a single round of a game theory interaction.
 * It progresses through the GameStages.
 * Each GameStage can be hooked by including a function with that GameStage name.
 */
var Game = /** @class */ (function (_super) {
    __extends(Game, _super);
    function Game(manager, props) {
        var _a, _b, _c, _d;
        var _this = _super.call(this, manager) || this;
        _this.active = false;
        _this.stage = GameStage.Pre_begin;
        _this.moves = [];
        _this.payoffs = [];
        _this.resultString = "";
        _this.decision_labels = [{ text: 'cooperate' }, { text: 'defect' }];
        _this.rules = [
            new GameRule(GameRules.allow_chat, EnabledStatus.Force_off),
            new GameRule(GameRules.allow_video, EnabledStatus.Force_on),
            new GameRule(GameRules.show_description, EnabledStatus.Force_on),
            new GameRule(GameRules.show_payoff_matrix, (_a = {},
                _a[GameStage.Pre_begin] = EnabledStatus.Force_off,
                _a[GameStage.Initial_presentation] = EnabledStatus.Force_on,
                _a[GameStage.Player_moves_complete] = EnabledStatus.Force_off,
                _a)),
            new GameRule(GameRules.allow_player_move, (_b = {},
                _b[GameStage.Pre_begin] = EnabledStatus.Force_off,
                _b[GameStage.Player_moves_enabled] = EnabledStatus.Force_on,
                _b[GameStage.Player_moves_complete] = EnabledStatus.Force_off,
                _b)),
            new GameRule(GameRules.show_partner_moves, (_c = {},
                _c[GameStage.Pre_begin] = EnabledStatus.Force_off,
                _c[GameStage.Reveal_moves] = EnabledStatus.Force_on,
                _c)),
            new GameRule(GameRules.show_partner_payoff, (_d = {},
                _d[GameStage.Pre_begin] = EnabledStatus.Force_off,
                _d[GameStage.Reveal_payoff] = EnabledStatus.Force_on,
                _d)),
            new GameRule(GameRules.show_own_score, EnabledStatus.Force_on),
            new GameRule(GameRules.show_partner_score, EnabledStatus.Force_on),
        ];
        _this.hooks = [
            {
                stage: GameStage.Pre_begin,
                fun: function (game) {
                    setTimeout(function (game) { return game.advance_stage(); }, 100, game);
                }
            },
            {
                stage: GameStage.Initial_presentation,
                fun: function (game) {
                    setTimeout(function (game) { return game.advance_stage(); }, stage_delay, game);
                }
            },
            {
                stage: GameStage.Player_moves_enabled,
                fun: function (game) {
                    // Set up move listeners for the sockets
                    function do_move(move) {
                        var _this = this;
                        function reject(socket, error) {
                            game._manager.logger.error("Socket " + socket.id + " error: " + error);
                            socket.emit('error', error);
                            socket.once('makeMove', do_move);
                        }
                        // Check move is valid
                        var new_move;
                        try {
                            new_move = {
                                player_index: game._manager.players.find(function (p) { return p.socket === _this; }).index,
                                index: move ? 1 : 0,
                                label: game.decision_labels[move ? 1 : 0]
                            };
                        }
                        catch (e) {
                            return reject(this, "That is not a valid move.");
                        }
                        // Record move
                        game._manager.logger.debug("New move: " + new_move.player_index + " selects '" + new_move.label.text + "' [" + new_move.index + "]");
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
                stage: GameStage.Player_moves_complete,
                fun: function (game) { return game.advance_stage(); }
            },
            {
                stage: GameStage.Reveal_moves,
                fun: function (game) { return setTimeout(function (game) { return game.advance_stage(); }, stage_delay, game); }
            },
            {
                stage: GameStage.Reveal_payoff,
                fun: function (game) {
                    // Matrix indexed by player move values
                    // Player 2 (index=1) first because P1 is columns and P2 is rows!
                    var payoffs = game.payoff_matrix[game.moves.find(function (m) { return game._manager.getPlayerByIndex(m.player_index).index === 1; }).index][game.moves.find(function (m) { return game._manager.getPlayerByIndex(m.player_index).index === 0; }).index];
                    game.payoffs = payoffs.payoffs;
                    game.resultString = payoffs.resultString.apply(payoffs, game._manager.players);
                    game._manager.logger.debug(game.resultString + " [P1=" + game.payoffs[0].value + ", P2=" + game.payoffs[1].value + "]");
                    game.moves.forEach(function (m) {
                        var p = game._manager.getPlayerByIndex(m.player_index);
                        p.score += game.payoffs[p.index].value;
                    });
                    // setTimeout(game => game.advance_stage(), stage_delay, game)
                }
            },
            {
                stage: GameStage.End,
                fun: function (game) { return setTimeout(function (game) { return game.advance_stage(); }, stage_delay, game); }
            },
            {
                stage: GameStage.Cleanup,
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
                payoffs: this.payoffs,
                resultString: this.resultString,
                timestamp: new Date().getTime()
            };
        },
        enumerable: false,
        configurable: true
    });
    Game.prototype.advance_stage = function (force_stage) {
        var _this = this;
        var found = false;
        var new_stage;
        if (typeof force_stage === 'undefined') {
            for (var gamestage in GameStage) {
                var stage = GameStage[gamestage];
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
            this._manager.logger.debug("No next stage found from " + this.stage);
        }
        this._manager.logger.debug("Stage " + this.stage + " -> " + new_stage);
        var hooks = this.hooks.filter(function (h) { return h.stage === _this.stage && h.when === "post"; });
        if (hooks.length) {
            this._manager.logger.debug("Executing " + hooks.length + " hooked functions for post_" + this.stage);
            hooks.forEach(function (h) { return h.fun(_this, h.context_arg); });
        }
        this.stage = new_stage;
        // Execute hooked functions
        hooks = this.hooks.filter(function (h) { return h.stage === _this.stage && h.when === "pre"; });
        if (hooks.length) {
            this._manager.logger.debug("Executing " + hooks.length + " hooked functions for pre_" + this.stage);
            hooks.forEach(function (h) { return h.fun(_this, h.context_arg); });
        }
        hooks = this.hooks.filter(function (h) { return h.stage === _this.stage && !h.when; });
        if (hooks.length) {
            this._manager.logger.debug("Executing " + hooks.length + " hooked functions for " + this.stage);
            hooks.forEach(function (h) { return h.fun(_this, h.context_arg); });
        }
        this._manager.broadcast();
    };
    Game.prototype.get_rule = function (rule) {
        try {
            return this.rules.find(function (r) { return r.name === rule; }).values[this.stage];
        }
        catch (e) {
            return EnabledStatus.Unset;
        }
    };
    Object.defineProperty(Game.prototype, "index", {
        get: function () {
            return this._manager.games.indexOf(this);
        },
        enumerable: false,
        configurable: true
    });
    return Game;
}(ManagerComponent));
var Message = /** @class */ (function (_super) {
    __extends(Message, _super);
    function Message() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Message;
}(ManagerComponent));
var Video = /** @class */ (function (_super) {
    __extends(Video, _super);
    function Video() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Video;
}(ManagerComponent));
module.exports = { Manager: Manager, Game: Game, GameRules: GameRules };
//# sourceMappingURL=manager.js.map