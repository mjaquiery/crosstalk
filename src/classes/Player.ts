import {Socket} from "socket.io";
import {Manager} from "./Manager";
import {ManagerComponent} from "./ManagerComponent";

export class Player extends ManagerComponent {
    socket: Socket
    public score: number = 0
    readonly index: number = 0
    private _name: string
    private readonly _id: string

    constructor(manager: Manager, props: {socket: Socket, name: string, network_token: string, index: number}) {
        super(manager);
        this.socket = props.socket
        this._id = props.network_token
        this.index = props.index? 1 : 0
        if(props.name) {
            this._name = props.name
        } else {
            this._name = `Player ${this.index + 1}`
        }
    }

    get id() { return this._id }

    get name() { return this._name }
    set name(new_name: string) {
        this._name = new_name
    }

    get loggable() {
        return {
            ...this,
            socket: this.socket.id,
        }
    }
}