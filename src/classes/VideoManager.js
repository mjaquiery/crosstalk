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
exports.VideoManager = void 0;
var openvidu_node_client_1 = require("openvidu-node-client");
var ManagerComponent_1 = require("./ManagerComponent");
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
}(ManagerComponent_1.ManagerComponent));
exports.VideoManager = VideoManager;
//# sourceMappingURL=VideoManager.js.map