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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = exports.GameRule = exports.GameRules = exports.Game = exports.Manager = void 0;
var openvidu_node_client_1 = require("openvidu-node-client");
var promises_1 = require("node:fs/promises");
var enums_1 = require("./enums/enums");
Object.defineProperty(exports, "GameRules", { enumerable: true, get: function () { return enums_1.GameRules; } });
var log4js = require("log4js");
var stage_delay_default = 1000;
var player_timeout_delay = 60000;
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
            for (var gamestage in enums_1.GameStage) {
                var stage = enums_1.GameStage[gamestage];
                if (values[stage] in enums_1.EnabledStatus) {
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
            for (var gamestage in enums_1.GameStage) {
                var stage = enums_1.GameStage[gamestage];
                _values[stage] = values;
            }
        }
        // @ts-ignore -- we know we have a full set of values here because we iterated through
        this.values = _values;
    }
    return GameRule;
}());
exports.GameRule = GameRule;
var Manager = /** @class */ (function () {
    function Manager(server, room_name) {
        var _a;
        if (room_name === void 0) { room_name = "game"; }
        this.server = server;
        this.players = [];
        this.games = [];
        this.id = "".concat(room_name, "_").concat(new Date().getTime().toString());
        this.name = room_name;
        log4js.configure({
            appenders: __assign(__assign({}, log4js.appenders), (_a = {}, _a[this.id] = {
                type: "file",
                filename: "".concat(process.env.GAME_LOG, "/").concat(this.id, ".log"),
                // layout: { type: "basic" }
            }, _a)),
            categories: { default: { appenders: [this.id], level: "error", enableCallStack: true } },
        });
        var logger = log4js.getLogger(this.id);
        logger.level = log4js.DEBUG;
        this.logger = logger;
        //this.logger = console
        this.logger.debug("Manger initialized.");
        this.videoManager = new VideoManager(this);
    }
    Manager.prototype.add_player = function (socket, player_name, network_token) {
        var _this = this;
        var self = this;
        var player = new Player(this, { socket: socket, name: player_name, network_token: network_token, index: this.players.length });
        var existing_player = this.players.find(function (p) { return p.id === player.id; });
        if (existing_player) {
            this.logger.debug("Refreshing socket for ".concat(player.name, " [").concat(player.index, "]"));
            existing_player.socket = socket;
        }
        else {
            if (this.players.length === 2) {
                this.logger.error("Refusing to allow ".concat(network_token, " to join: too many players."));
                throw new Error("Too many players!");
            }
            this.logger.debug("Accepted new player: ".concat(player.name, " [").concat(player.index, "]"));
            this.players.push(player);
            this.logger.debug("".concat(player.name, " joined [").concat(player.id, "]"));
            socket.on('leave', function () { return setTimeout(function (manager, player, socket) { return manager.remove_player(player, socket); }, player_timeout_delay, _this, player, socket); });
            socket.on('disconnect', function () { return setTimeout(function (manager, player, socket) { return manager.remove_player(player, socket); }, player_timeout_delay, _this, player, socket); });
            if (this.players.length === 2) {
                this.next_game();
            }
            this.broadcast();
        }
        this.videoManager.get_token(existing_player || player)
            .then(function () { return self.broadcast(); })
            .catch(function (err) { return self.logger.error(err); });
    };
    Manager.prototype.remove_player = function (player, socket) {
        if (this.getPlayerById(player.id)) {
            if (player.socket !== socket) {
                // Player already relogged on
                return;
            }
            this.players = this.players.filter(function (p) { return p.id !== player.id; });
            this.logger.debug("Player ".concat(player.name, " left [").concat(player.id, "]"));
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
                console.debug("Starting game ".concat(i));
                this.games[i].active = true;
            }
        }
        else {
            console.debug("Starting game 0");
            this.games[0].active = true;
        }
        if (this.current_game instanceof Game) {
            console.debug("Starting game ".concat(this.current_game.name));
            this.current_game.advance_stage(enums_1.GameStage.Pre_begin);
        }
        else {
            this.end();
        }
    };
    Manager.prototype.end = function () {
        var _this = this;
        console.debug("All ".concat(this.games.length, " game(s) complete."));
        this.broadcast();
        this.players.forEach(function (p) { return p.socket.emit("gameOver"); });
        this.videoManager.close_all();
        // Save all the game data neatly into a .csv file
        var tsv_data = this.games.map(function (g, i) {
            var s = g.state;
            var moves = s.moves;
            var rewritten_moves = s.rewritten_moves;
            var f = function (a, b) { return a.player_index > b.player_index ? 1 : -1; };
            moves.sort(f);
            rewritten_moves.sort(f);
            var baseline = g.stage_timestamps["".concat(enums_1.GameStage.Pre_begin, "_pre")];
            var timings = {
                time_game_start: baseline,
                t_player_1_intended_move_ms: s.moves[0].timestamp - baseline,
                t_player_2_intended_move_ms: s.moves[1].timestamp - baseline,
                t_player_1_rewritten_move_ms: s.rewritten_moves[0].timestamp - baseline,
                t_player_2_rewritten_move_ms: s.rewritten_moves[1].timestamp - baseline,
            };
            for (var k in g.stage_timestamps) {
                if (g.stage_timestamps.hasOwnProperty(k) && /_end$/.test(k)) {
                    timings["t_".concat(k, "_ms")] = g.stage_timestamps[k] - baseline;
                }
            }
            return __assign(__assign(__assign({ game_name: s.name, game_number: i, player_1_name: _this.players[0].name, player_2_name: _this.players[1].name, player_1_intended_move_index: s.moves[0].index, player_2_intended_move_index: s.moves[1].index, player_1_rewritten_move_index: s.rewritten_moves[0].index, player_2_rewritten_move_index: s.rewritten_moves[1].index, resultString: s.resultString, player_1_payoff_value: s.payoffs[0].value, player_2_payoff_value: s.payoffs[1].value, player_1_payoff_name: s.payoffs[0].label, player_2_payoff_name: s.payoffs[1].label, player_1_intended_move_text: s.moves[0].label.text, player_2_intended_move_text: s.moves[1].label.text, player_1_intended_move_icon: s.moves[0].label.icon, player_2_intended_move_icon: s.moves[1].label.icon, player_1_rewritten_move_text: s.rewritten_moves[0].label.text, player_2_rewritten_move_text: s.rewritten_moves[1].label.text, player_1_rewritten_move_icon: s.rewritten_moves[0].label.icon, player_2_rewritten_move_icon: s.rewritten_moves[1].label.icon }, timings), { player_1_id: _this.players[0].id, player_2_id: _this.players[1].id, game_description: s.description, game_prompt: s.prompt, decision_1_text: s.decision_labels[0].text, decision_2_text: s.decision_labels[1].text, decision_1_icon: s.decision_labels[0].icon, decision_2_icon: s.decision_labels[1].icon }), s.rules);
        });
        // Convert to CSV object
        var headers = [];
        for (var k in tsv_data[0]) {
            if (tsv_data[0].hasOwnProperty(k)) {
                headers.push(k.replace(/\t/, ' '));
            }
        }
        var tsv = __spreadArray([
            headers.join('\t')
        ], tsv_data.map(function (x) {
            return headers.map(function (h) { return JSON.stringify(x[h]).replace(/\t/, ' '); }).join('\t');
        }), true).join('\n');
        var self = this;
        (0, promises_1.writeFile)("".concat(process.env.GAME_DATA, "/").concat(this.id, ".tsv"), tsv)
            .then(function () { return (0, promises_1.writeFile)("".concat(process.env.GAME_DATA, "/").concat(_this.id, ".json"), JSON.stringify(tsv_data)); })
            .then(function () { return self.logger.info('Game data saved.'); })
            .catch(function (e) { return self.logger.error("Error saving game data.", e); });
    };
    /**
     * Game state view for a player, redacted as necessary
     */
    Manager.prototype.get_game_state = function (player) {
        var _this = this;
        var manager = this;
        var players;
        var game;
        if (this.current_game instanceof Game) {
            players = this.players.map(function (p) {
                var showScore = false;
                if (p === player && manager.current_game.get_rule(enums_1.GameRules.show_own_score)) {
                    showScore = true;
                }
                else if (player !== p && manager.current_game.get_rule(enums_1.GameRules.show_partner_score)) {
                    showScore = true;
                }
                return {
                    index: p.index,
                    name: p.name,
                    score: showScore ? p.score : null,
                    you: p === player
                };
            });
            game = __assign(__assign({}, this.current_game.state), { moves: this.current_game.rewritten_moves.filter(function (m) {
                    return m.player_index === player.index || _this.current_game.get_rule(enums_1.GameRules.show_partner_moves);
                }), payoffs: this.current_game.get_rule(enums_1.GameRules.show_partner_payoff) ?
                    this.current_game.payoffs : this.current_game.state.payoffs.map(function (po, i) { return i === player.index ? po : null; }), number: this.current_game.index + 1 });
        }
        else {
            players = this.players.map(function (p) {
                return { index: p.index, name: p.name, you: p === player, score: p.score };
            });
        }
        var ov = this.videoManager.connections.find(function (c) { return c.player === player; });
        var ov_token = null;
        if (ov) {
            ov_token = ov.connection.token;
        }
        return {
            players: players,
            game: game,
            game_count: this.games.length,
            ov_token: ov_token
        };
    };
    Manager.prototype.log_game_state = function () {
        if (this.current_game instanceof Game) {
            this.logger.info("<< [".concat(this.id, "] Broadcast game state >>"));
            this.logger.info(this.current_game.loggable);
            this.logger.info(this.players.map(function (p) { return p.loggable; }));
            this.logger.info(this.videoManager.loggable);
            this.logger.info("<< Broadcast ends >>");
        }
        else {
            this.logger.info("<< [".concat(this.id, "] Broadcast game state >>"));
            this.logger.info("No game currently active");
            this.logger.info(this.players.map(function (p) { return p.loggable; }));
            this.logger.info(this.videoManager.loggable);
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
exports.Manager = Manager;
var ManagerComponent = /** @class */ (function () {
    function ManagerComponent(manager) {
        this._manager = manager;
    }
    Object.defineProperty(ManagerComponent.prototype, "state", {
        get: function () { return null; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ManagerComponent.prototype, "loggable", {
        get: function () { return this.state ? this.state : this; },
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
        _this._id = props.network_token;
        _this.index = props.index ? 1 : 0;
        if (props.name) {
            _this._name = props.name;
        }
        else {
            _this._name = "Player ".concat(_this.index + 1);
        }
        return _this;
    }
    Object.defineProperty(Player.prototype, "id", {
        get: function () { return this._id; },
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
    Object.defineProperty(Player.prototype, "loggable", {
        get: function () {
            return __assign(__assign({}, this), { socket: this.socket.id });
        },
        enumerable: false,
        configurable: true
    });
    return Player;
}(ManagerComponent));
exports.Player = Player;
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
            new GameRule(enums_1.GameRules.allow_chat, enums_1.EnabledStatus.Force_off),
            new GameRule(enums_1.GameRules.allow_video, enums_1.EnabledStatus.Force_on),
            new GameRule(enums_1.GameRules.show_description, enums_1.EnabledStatus.Force_on),
            new GameRule(enums_1.GameRules.show_payoff_matrix, (_a = {},
                _a[enums_1.GameStage.Pre_begin] = enums_1.EnabledStatus.Force_off,
                _a[enums_1.GameStage.Initial_presentation] = enums_1.EnabledStatus.Force_on,
                _a[enums_1.GameStage.Player_moves_complete] = enums_1.EnabledStatus.Force_off,
                _a)),
            new GameRule(enums_1.GameRules.allow_player_move, (_b = {},
                _b[enums_1.GameStage.Pre_begin] = enums_1.EnabledStatus.Force_off,
                _b[enums_1.GameStage.Player_moves_enabled] = enums_1.EnabledStatus.Force_on,
                _b[enums_1.GameStage.Player_moves_complete] = enums_1.EnabledStatus.Force_off,
                _b)),
            new GameRule(enums_1.GameRules.show_partner_moves, (_c = {},
                _c[enums_1.GameStage.Pre_begin] = enums_1.EnabledStatus.Force_off,
                _c[enums_1.GameStage.Reveal_moves] = enums_1.EnabledStatus.Force_on,
                _c)),
            new GameRule(enums_1.GameRules.show_partner_payoff, (_d = {},
                _d[enums_1.GameStage.Pre_begin] = enums_1.EnabledStatus.Force_off,
                _d[enums_1.GameStage.Reveal_payoff] = enums_1.EnabledStatus.Force_on,
                _d)),
            new GameRule(enums_1.GameRules.show_own_score, enums_1.EnabledStatus.Force_on),
            new GameRule(enums_1.GameRules.show_partner_score, enums_1.EnabledStatus.Force_on),
        ];
        _this.rewrite_rule = function (move, game) { return move; };
        _this.timings = (_e = {},
            _e[enums_1.GameStage.Pre_begin] = 100,
            _e[enums_1.GameStage.Initial_presentation] = 1000,
            _e[enums_1.GameStage.Reveal_moves] = 1000,
            _e[enums_1.GameStage.Reveal_payoff] = 1000,
            _e);
        _this.default_timing = stage_delay_default;
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
}(ManagerComponent));
exports.Game = Game;
var Message = /** @class */ (function (_super) {
    __extends(Message, _super);
    function Message() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return Message;
}(ManagerComponent));
var VideoManager = /** @class */ (function (_super) {
    __extends(VideoManager, _super);
    function VideoManager(manager) {
        var _this = _super.call(this, manager) || this;
        _this.connections = [];
        _this.ov_session_props = {
            customSessionId: "".concat(manager.id, "_video"),
            recordingMode: openvidu_node_client_1.RecordingMode.ALWAYS,
            defaultRecordingProperties: {
                outputMode: openvidu_node_client_1.Recording.OutputMode.INDIVIDUAL
            }
        };
        _this.ov_connection_props = {
            role: openvidu_node_client_1.OpenViduRole.PUBLISHER
        };
        _this.create_session();
        return _this;
    }
    VideoManager.prototype.create_session = function () {
        var self = this;
        this.ov = new openvidu_node_client_1.OpenVidu(process.env.OPENVIDU_URL, process.env.OPENVIDU_SECRET);
        this.ov.createSession(this.ov_session_props)
            .then(function (session) { return self.ov_session = session; })
            .then(function () { return self._manager.logger.info(self.ov_session); })
            .catch(function (err) {
            self._manager.logger.error("Unable to connect to OpenVidu server. Error:");
            self._manager.logger.error(err);
            setTimeout(function (self) { return self.create_session(); }, 10000, self);
        });
    };
    VideoManager.prototype.get_token = function (player, i) {
        var _this = this;
        if (i === void 0) { i = 0; }
        var self = this;
        // Handle connection requests where session not yet initialized
        if (!this.ov_session) {
            this._manager.logger.debug("Delaying generation of ov_token for ".concat(player.id, " due to uninitalized session [").concat(i, "]"));
            return new Promise(function (resolve, reject) {
                var retry_delay = 1000;
                var max_delay = 5000;
                if (i * retry_delay > max_delay) {
                    return reject("ov_token generation timed out after ".concat(max_delay, "ms."));
                }
                setTimeout(function () {
                    _this.get_token(player, i + 1).then(resolve).catch(reject);
                }, retry_delay, self);
            });
        }
        var conn = this.connections.find(function (c) { return c.player === player; });
        if (conn) {
            console.log("Removing old connection for ".concat(player.name));
            this.ov_session.forceDisconnect(conn.connection)
                .catch(function (e) { return console.warn('forceDisconnect error:', e); });
            this.connections = this.connections.filter(function (c) { return c.player !== player; });
        }
        return this.ov_session.createConnection(__assign(__assign({}, self.ov_connection_props), { data: JSON.stringify({ id: player.id, index: player.index, now: new Date().getTime() }) }))
            .then(function (connection) {
            self.connections.push({ player: player, connection: connection });
            return connection.token;
        })
            .catch(function (err) {
            self._manager.logger.error(err);
            return null;
        });
    };
    VideoManager.prototype.close_all = function () {
        var _this = this;
        this.connections.forEach(function (c) {
            _this.ov_session.forceDisconnect(c.connection)
                .catch(function (e) { return console.warn('forceDisconnect error:', e); });
        });
        this.connections = [];
    };
    Object.defineProperty(VideoManager.prototype, "loggable", {
        get: function () {
            return {
                connections: this.connections.map(function (c) {
                    return {
                        player_index: c.player.index,
                        player_id: c.player.id,
                        connection_id: c.connection.connectionId,
                        connection_status: c.connection.status,
                        connection_token: c.connection.token
                    };
                })
            };
        },
        enumerable: false,
        configurable: true
    });
    return VideoManager;
}(ManagerComponent));
//# sourceMappingURL=manager.js.map