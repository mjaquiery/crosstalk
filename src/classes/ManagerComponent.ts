import {Manager} from "./Manager";

export class ManagerComponent {
    protected _manager: Manager

    constructor(manager) {
        this._manager = manager
    }

    get state() { return null }

    get loggable(): any { return this.state? this.state : this }
}