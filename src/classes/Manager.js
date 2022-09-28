"use strict";
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
exports.Manager = exports.player_timeout_delay = void 0;
var promises_1 = require("node:fs/promises");
var enums_1 = require("../enums/enums");
var Player_1 = require("./Player");
var Game_1 = require("./Game");
var VideoManager_1 = require("./VideoManager");
var log4js = require("log4js");
exports.player_timeout_delay = 60000;
var Manager = /** @class */ (function () {
    function Manager(server, room_name, props) {
        var _a;
        if (room_name === void 0) { room_name = "game"; }
        if (props === void 0) { props = {}; }
        this.server = props.server || server;
        this.players = props.players || [];
        this.games = props.games || [];
        this.id = props.id || "".concat(room_name, "_").concat(new Date().getTime().toString());
        this.name = props.name || room_name;
        if (!props.logger) {
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
        }
        else {
            this.logger = props.logger;
        }
        //this.logger = console
        this.logger.debug("Manger initialized.");
        this.videoManager = props.video_manager || new VideoManager_1.VideoManager(this);
    }
    Manager.prototype.add_player = function (socket, player_name, network_token) {
        var _this = this;
        var self = this;
        var player = new Player_1.Player(this, { socket: socket, name: player_name, network_token: network_token, index: this.players.length });
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
            socket.on('leave', function () { return setTimeout(function (manager, player, socket) { return manager.remove_player(player, socket); }, exports.player_timeout_delay, _this, player, socket); });
            socket.on('disconnect', function () { return setTimeout(function (manager, player, socket) { return manager.remove_player(player, socket); }, exports.player_timeout_delay, _this, player, socket); });
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
        if (this.current_game instanceof Game_1.Game) {
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
        if (this.current_game instanceof Game_1.Game) {
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
        if (this.current_game instanceof Game_1.Game) {
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
        if (this.current_game instanceof Game_1.Game) {
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
//# sourceMappingURL=Manager.js.map