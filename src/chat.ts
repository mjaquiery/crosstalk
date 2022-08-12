import {Socket} from 'socket.io'

class Chat {
    private _socket: Socket;
    private _store: any;
    /**
     * A chat handler for crosstalk
     * @param socket
     * @param store generic storage object. Will write to store.Chat.
     */
    constructor(socket: Socket, store: any) {
        this._socket = socket
        if(!store.hasOwnProperty('Chat')) {
            this.initialiseChatStorage(store)
        }
        this._store = store.Chat

        this._socket.on('joined', (user) => {
            console.log(`User ${user} connected.`)
            this._socket.emit('joined', user)
        })

        this._socket.on('leave', (user) => {
            console.log(`User ${user} left.`)
            this._socket.broadcast.emit('leave', user)
        })

        this._socket.on('disconnect', () => {
            console.log("A user disconnected")
        })

        this._socket.on('chat-message', (data) => {
            this._socket.emit('chat-message', data)
        })
    }

    initialiseChatStorage(store) {
        store.Chat = new ChatStorage()
        return store.Chat
    }
}

class ChatStorage {
    public Messages: Message[]
}

class Message {}

module.exports = Chat