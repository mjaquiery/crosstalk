"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Chat = /** @class */ (function () {
    /**
     * A chat handler for crosstalk
     * @param socket
     * @param store generic storage object. Will write to store.Chat.
     */
    function Chat(socket, store) {
        var _this = this;
        this._socket = socket;
        if (!store.hasOwnProperty('Chat')) {
            this.initialiseChatStorage(store);
        }
        this._store = store.Chat;
        this._socket.on('joined', function (user) {
            console.log("User ".concat(user, " connected."));
            _this._socket.emit('joined', user);
        });
        this._socket.on('leave', function (user) {
            console.log("User ".concat(user, " left."));
            _this._socket.broadcast.emit('leave', user);
        });
        this._socket.on('disconnect', function () {
            console.log("A user disconnected");
        });
        this._socket.on('chat-message', function (data) {
            _this._socket.emit('chat-message', data);
        });
    }
    Chat.prototype.initialiseChatStorage = function (store) {
        store.Chat = new ChatStorage();
        return store.Chat;
    };
    return Chat;
}());
var ChatStorage = /** @class */ (function () {
    function ChatStorage() {
    }
    return ChatStorage;
}());
var Message = /** @class */ (function () {
    function Message() {
    }
    return Message;
}());
module.exports = Chat;
//# sourceMappingURL=chat.js.map