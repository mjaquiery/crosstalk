import {
    Connection,
    ConnectionProperties,
    OpenVidu, OpenViduRole, Recording,
    RecordingMode,
    Session,
    SessionProperties
} from "openvidu-node-client";
import {Manager} from "./Manager";
import {ManagerComponent} from "./ManagerComponent";
import {Player} from "./Player";

export class VideoManager extends ManagerComponent {
    public ov: OpenVidu
    public ov_session: Session
    public connections: { player: Player, connection: Connection }[]
    readonly ov_session_props: SessionProperties
    readonly ov_connection_props: ConnectionProperties

    constructor(manager: Manager) {
        super(manager);

        this.connections = []
        this.ov_session_props = {
            customSessionId: `${manager.id}_video`,
            recordingMode: RecordingMode.ALWAYS,
            defaultRecordingProperties: {
                outputMode: Recording.OutputMode.INDIVIDUAL
            }
        }
        this.ov_connection_props = {
            role: OpenViduRole.PUBLISHER
        }
        this.create_session()
    }

    create_session() {
        const self = this
        this.ov = new OpenVidu(process.env.OPENVIDU_URL, process.env.OPENVIDU_SECRET)
        this.ov.createSession(this.ov_session_props)
            .then(session => self.ov_session = session)
            .then(() => self._manager.logger.info(self.ov_session))
            .catch(err => {
                self._manager.logger.error("Unable to connect to OpenVidu server. Error:")
                self._manager.logger.error(err)
                setTimeout(self => self.create_session(), 10000, self)
            })
    }

    get_token(player: Player, i: number = 0): Promise<string|null> {
        const self = this
        // Handle connection requests where session not yet initialized
        if(!this.ov_session) {
            this._manager.logger.debug(`Delaying generation of ov_token for ${player.id} due to uninitalized session [${i}]`)
            return new Promise((resolve, reject) => {
                const retry_delay = 1000
                const max_delay = 5000
                if(i * retry_delay > max_delay) {
                    return reject(`ov_token generation timed out after ${max_delay}ms.`)
                }
                setTimeout(() => {
                    this.get_token(player, i + 1).then(resolve).catch(reject)
                }, retry_delay, self)
            })
        }
        let conn = this.connections.find(c => c.player === player)
        if(conn) {
            console.log(`Removing old connection for ${player.name}`)
            this.ov_session.forceDisconnect(conn.connection)
                .catch(e => console.warn('forceDisconnect error:', e))
            this.connections = this.connections.filter(c => c.player !== player)
        }
        return this.ov_session.createConnection({
            ...self.ov_connection_props,
            data: JSON.stringify({id: player.id, index: player.index, now: new Date().getTime()})
        })
            .then(connection => {
                self.connections.push({player, connection})
                return connection.token
            })
            .catch(err => {
                self._manager.logger.error(err)
                return null
            })
    }

    close_all() {
        this.connections.forEach(c => {
            this.ov_session.forceDisconnect(c.connection)
                .catch(e => console.warn('forceDisconnect error:', e))
        })
        this.connections = []
    }

    get loggable() {
        return {
            connections: this.connections.map(c => {
                return {
                    player_index: c.player.index,
                    player_id: c.player.id,
                    connection_id: c.connection.connectionId,
                    connection_status: c.connection.status,
                    connection_token: c.connection.token
                }
            })
        }
    }
}