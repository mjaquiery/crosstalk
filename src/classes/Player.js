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
exports.Player = void 0;
var ManagerComponent_1 = require("./ManagerComponent");
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
}(ManagerComponent_1.ManagerComponent));
exports.Player = Player;
//# sourceMappingURL=Player.js.map