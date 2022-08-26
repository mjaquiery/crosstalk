"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var manager_1 = require("./src/manager");
var managers = {};
var express = require('express');
var session = require('express-session');
var fs = require('fs');
var cors = require('cors');
var https = require('https');
var socketIO = require("socket.io");
var origins = ["https://localhost:8080", "https://192.168.0.84:8080"];
var corsOptions = {
    origin: origins,
    credentials: true
};
var sshOptions = {
    key: fs.readFileSync('openvidukey.pem'),
    cert: fs.readFileSync('openviducert.pem')
};
var http = https.createServer(sshOptions, express()).listen(3000, function () {
    console.log('Listening on port *:3000');
});
var io = new socketIO.Server(http, {
    cors: corsOptions,
    allowEIO3: true,
    cookie: {
        sameSite: "none",
        secure: true
    }
});
function new_manger(room_name, game_count) {
    if (room_name === void 0) { room_name = "game"; }
    if (game_count === void 0) { game_count = 5; }
    var manager = new manager_1.Manager(io, room_name);
    var coop = { value: 2, label: 'Small fine' };
    var betrayed = { value: 0, label: 'Huge sentence' };
    var betrayer = { value: 10, label: 'No punishment' };
    var mutual_defection = { value: 1, label: 'Heavy sentence' };
    var cooperate = {
        resultString: function (p1, p2) { return "\n    <span data-player-index=\"".concat(p1.index, "\">").concat(p1.name, "</span>\n     and \n    <span data-player-index=\"").concat(p2.index, "\">").concat(p2.name, "</span>\n     cooperate"); },
        payoffs: [coop, coop]
    };
    var p1_betrays = {
        resultString: function (p1, p2) { return "\n    <span data-player-index=\"".concat(p1.index, "\">").concat(p1.name, "</span>\n     betrays \n    <span data-player-index=\"").concat(p2.index, "\">").concat(p2.name, "</span>"); },
        payoffs: [betrayer, betrayed]
    };
    var p2_betrays = {
        resultString: function (p1, p2) { return "\n    <span data-player-index=\"".concat(p2.index, "\">").concat(p2.name, "</span>\n     betrays \n    <span data-player-index=\"").concat(p1.index, "\">").concat(p1.name, "</span>"); },
        payoffs: [betrayed, betrayer]
    };
    var both_defect = {
        resultString: function (p1, p2) { return "\n    <span data-player-index=\"".concat(p1.index, "\">").concat(p1.name, "</span>\n     and \n    <span data-player-index=\"").concat(p2.index, "\">").concat(p2.name, "</span>\n     betray one another"); },
        payoffs: [mutual_defection, mutual_defection]
    };
    var game = function () { return new manager_1.Game(manager, {
        name: 'Prisoner\'s dilemma',
        description: "\n    <p>\n        You are sat at a table being interrogated. \n        Across the hall you can see your partner, also being interrogated.\n        You know they haven't got much on you; \n        if neither you nor your partner talk, the most you'll get is a small fine.\n    </p>\n    <p>\n        If one of you talks and the other doesn't, \n        whoever talks walks away and lets the other bear a much heavier sentence.\n        If you both talk, though, you're both in for a heavy sentence.\n    </p>\n    ",
        prompt: "\n    <p>\n        The pressure is on. What are you going to do?\n    </p>\n    ",
        decision_labels: [
            { text: 'Keep quiet', icon: '&#129296;' },
            { text: 'Talk', icon: '&#128516;' }
        ],
        payoff_matrix: [
            // Payoff values [P1, P2] for:
            // P1 Co-op     P1 Defect
            [cooperate, p1_betrays],
            [p2_betrays, both_defect], // P2 Defect
        ]
    }); };
    for (var i = 0; i < game_count; i++) {
        manager.add_games(game());
    }
    return manager;
}
io.on('connection', function (socket) {
    console.log("New connection: ".concat(socket.id));
    socket.on('joinGame', function (_a) {
        var game_room = _a.game_room, network_token = _a.network_token;
        try {
            if (typeof game_room !== 'string') {
                socket.emit("error", "room_name must be a string");
                return;
            }
            if (typeof network_token !== 'string') {
                socket.emit("error", "network_token must be a string");
            }
            console.debug("joinGame(".concat(socket.id, ", {game_room: ").concat(game_room, ", network_token: ").concat(network_token, "})"));
            if (!managers.hasOwnProperty(game_room)) {
                managers[game_room] = new_manger(game_room);
            }
            var manager = managers[game_room];
            try {
                manager.add_player(socket, network_token);
            }
            catch (e) {
                socket.emit("error", e);
            }
        }
        catch (e) {
            console.error(e);
        }
    });
});
//# sourceMappingURL=server.js.map