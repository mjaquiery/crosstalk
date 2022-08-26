import {Server, Socket} from 'socket.io'
import {
    Connection,
    ConnectionProperties,
    OpenVidu,
    OpenViduRole,
    Recording,
    RecordingMode,
    Session,
    SessionProperties
} from "openvidu-node-client";

const log4js = require("log4js")

const stage_delay: number = 1000
const player_timeout_delay: number = 60000

type DecisionLabel = {
    text: string,
    icon?: string
}

type Move = {
    index: number,
    label: DecisionLabel,
    player_index: number
}

type Hook = {
    stage: GameStage,
    fun: Function,
    when?: "pre" | "post",
    context_arg?: any
}

type GameState = {
    name: string,
    description: string,
    prompt: string,
    stage: GameStage,
    rules: Partial<{[k in GameRules]: EnabledStatus}>,
    decision_labels: [DecisionLabel, DecisionLabel],
    moves: Move[],
    payoffs: Payoff[],
    resultString: string,
    number?: number,
    timestamp: number
}

type ClientPlayer = {
    index: number,
    score: number,
    you: boolean,
    name: string
}

type ClientGameState = {
    players: ClientPlayer[],
    game: GameState | null,
    game_count: number,
    ov_token: string|null
}


/**
 * A value for the payoff, and a label to be displayed to the receiver of the payoff
 */
type Payoff = { value: number, label?: string }
type ResultString = (player1: Player, player2: Player) => string
type PayoffSet = {
    resultString: ResultString,
    payoffs: [Payoff, Payoff]
}
type PayoffMatrix = [
    PayoffSet, PayoffSet,
    PayoffSet, PayoffSet
]

enum GameStage {
    Pre_begin = 'Pre-begin',
    Initial_presentation = 'Initial presentation',
    Player_moves_enabled = 'Player moves enabled',
    Player_moves_in_progress = 'Player moves in progress',
    Player_moves_complete = 'Player moves complete',
    Reveal_moves = 'Reveal moves',
    Reveal_payoff = 'Reveal payoff',
    End = 'End',
    Cleanup = 'Cleanup',
}
enum EnabledStatus {
    Force_off = -1,
    Unset = 0,
    Force_on = 1
}

enum GameRules {
    allow_chat = 'allow chat',
    allow_video = 'allow video',
    allow_player_move = 'allow player move',
    show_description = 'show description',
    show_own_score = 'show own score',
    show_payoff_matrix = 'show payoff matrix',
    show_partner_moves = 'show partner moves',
    show_partner_payoff = 'show partner payoff',
    show_partner_score = 'show partner score'
}

class GameRule {
    name: GameRules
    values: { [k in GameStage]: EnabledStatus }

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
    constructor(name: GameRules, values: EnabledStatus | Partial<{ [k in GameStage]: EnabledStatus }>) {
        this.name = name
        const _values: Partial<{ [k in GameStage]: EnabledStatus }> = {}

        if(values instanceof Object) {
            let last_value
            const backfill = []
            for(const gamestage in GameStage) {
                const stage: GameStage = GameStage[gamestage as keyof typeof GameStage]
                if(values[stage] in EnabledStatus) {
                    _values[stage] = values[stage]
                    last_value = values[stage]
                    while(backfill.length) {
                        _values[backfill.pop()] = last_value
                    }
                } else if(typeof last_value !== 'undefined') {
                    _values[stage] = last_value
                } else {
                    backfill.push(stage)
                }
            }
        } else {
            // Single value supplied
            for(const gamestage in GameStage) {
                const stage: GameStage = GameStage[gamestage as keyof typeof GameStage]
                _values[stage] = values
            }
        }
        // @ts-ignore -- we know we have a full set of values here because we iterated through
        this.values = _values
    }
}

class Manager {
    private server: Server
    players: Player[]
    games: Game[]
    id: string
    name: string
    logger
    private messages: Message[]
    private videoManager: VideoManager

    constructor(server: Server, room_name: string = "game") {
        this.server = server
        this.players = []
        this.games = []
        this.messages = []
        this.id = `${room_name}_${new Date().getTime().toString()}`
        this.name = room_name

        log4js.configure({
            appenders: {
                ...log4js.appenders,
                [this.id]: {
                    type: "file",
                    filename: `${process.env.GAME_LOG}/${this.id}.log`,
                    // layout: { type: "basic" }
                }
            },
            categories: { default: { appenders: [this.id], level: "error", enableCallStack: true } },
        });

        const logger = log4js.getLogger(this.id);
        logger.level = log4js.DEBUG
        this.logger = console // logger
        this.logger.debug(`Manger initialized.`)

        this.videoManager = new VideoManager(this)
    }

    add_player(socket: Socket, network_token: string) {
        const self = this
        if(this.players.length === 2) {
            this.logger.error(`Refusing to allow ${network_token} to join: too many players.`)
            throw new Error("Too many players!")
        }

        const player = new Player(this, {socket, network_token, index: this.players.length})
        const existing_player = this.players.find(p => p.id === player.id)
        if(existing_player) {
            this.logger.debug(`Refreshing socket for ${player.name} [${player.index}]`)
            existing_player.socket = socket
        } else {
            this.logger.debug(`Accepted new player: ${player.name} [${player.index}]`)
            this.players.push(player)
            this.logger.debug(`${player.name} joined [${player.id}]`)
            socket.on('leave', () => setTimeout(
                (manager, player, socket) => manager.remove_player(player, socket),
                player_timeout_delay,
                this,
                player,
                socket
            ))
            socket.on('disconnect', () => setTimeout(
                (manager, player, socket) => manager.remove_player(player, socket),
                player_timeout_delay,
                this,
                player,
                socket
            ))
            this.videoManager.get_token(player)
                .then(() => self.broadcast())
                .catch(err => self.logger.error(err))
        }

        if(this.players.length === 2) {
            this.next_game()
        }
        this.broadcast()
    }

    remove_player(player: Player, socket: Socket) {
        if(this.getPlayerById(player.id)) {
            if(player.socket !== socket) {
                // Player already relogged on
                return
            }
            this.players = this.players.filter(p => p.id !== player.id)
            this.logger.debug(`Player ${player.name} left [${player.id}]`)
            this.broadcast()
        }
    }

    add_games(games: Game | Game[]) {
        if(!(games instanceof Array)) {
            games = [games]
        }
        this.games.push(...games)
    }

    get current_game(): Game | null {
        try {
            return this.games.filter(g => g.active === true)[0]
        } catch (e) {
            return null
        }
    }

    next_game() {
        if(this.current_game instanceof Game) {
            const i = this.games.indexOf(this.current_game) + 1
            this.current_game.active = false
            if(this.games.length > i) {
                console.debug(`Starting game ${i}`)
                this.games[i].active = true
            }
        } else {
            console.debug(`Starting game 0`)
            this.games[0].active = true
        }
        if(this.current_game instanceof Game) {
            console.debug(`Starting game ${this.current_game.name}`)
            this.current_game.advance_stage(GameStage.Pre_begin)
        } else {
            console.debug(`All ${this.games.length} game(s) complete.`)
            this.broadcast()
        }
    }

    /**
     * Game state view for a player, redacted as necessary
     */
    get_game_state(player: Player): ClientGameState {
        const manager: Manager = this
        let players
        let game

        if(this.current_game instanceof Game) {
            players = this.players.map(p => {
                let showScore = false
                if(p === player && manager.current_game.get_rule(GameRules.show_own_score)) {
                    showScore = true
                } else if(player !== p && manager.current_game.get_rule(GameRules.show_partner_score)) {
                    showScore = true
                }
                return {
                    index: p.index,
                    name: p.name,
                    score: showScore? p.score : null,
                    you: p === player
                }
            })
            game = {
                ...this.current_game.state,
                moves: this.current_game.get_rule(GameRules.show_partner_moves)?
                    this.current_game.state.moves : {[player.index]: this.current_game.state.moves[player.index]},
                payoffs: this.current_game.get_rule(GameRules.show_partner_payoff)?
                    this.current_game.payoffs : this.current_game.state.payoffs.map(
                        (po, i) => i === player.index? po : null
                    ),
                number: this.current_game.index + 1
            }
        } else {
            players = this.players.map(p => {
                return {index: p.index, name: p.name, you: p === player, score: p.score}
            })
        }
        const ov = this.videoManager.connections.find(c => c.player === player)
        let ov_token: string|null = null
        if(ov) {
            ov_token = ov.connection.token
        }
        return {
            players,
            game,
            game_count: this.games.length,
            ov_token
        }
    }

    log_game_state() {
        if(this.current_game instanceof Game) {
            this.logger.info(`<< [${this.id}] Broadcast game state >>`)
            this.logger.info(this.current_game.loggable)
            this.logger.info(this.players.map(p => p.loggable))
            this.logger.info(this.videoManager.loggable)
            this.logger.info("<< Broadcast ends >>")
        } else {
            this.logger.info(`<< [${this.id}] Broadcast game state >>`)
            this.logger.info("No game currently active")
            this.logger.info(this.players.map(p => p.loggable))
            this.logger.info(this.videoManager.loggable)
            this.logger.info("<< Broadcast ends >>")
        }
    }

    broadcast(): void {
        this.log_game_state()
        for(let p of this.players) {
            // redact gamestate if necessary
            p.socket.emit('gameStateUpdate', JSON.stringify(this.get_game_state(p)))
        }
    }

    getPlayerById(id: string): Player {
        return this.players.find(p => p.id === id)
    }

    getPlayerByIndex(index: number): Player {
        return this.players.find(p => p.index === index)
    }

    get is_open(): boolean {
        return this.players.length < 2
    }
}

class ManagerComponent {
    protected _manager: Manager

    constructor(manager) {
        this._manager = manager
    }

    get state() { return null }

    get loggable(): any { return this.state? this.state : this }
}

class Player extends ManagerComponent {
    socket: Socket
    public score: number = 0
    readonly index: number = 0
    private _name: string
    private readonly _id: string

    constructor(manager: Manager, props: {socket: Socket, network_token: string, index: number}) {
        super(manager);
        this.socket = props.socket
        this._id = props.network_token
        this.index = props.index? 1 : 0
        this._name = `Player ${this.index + 1}`
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

/**
 * A Game is a single round of a game theory interaction.
 * It progresses through the GameStages.
 * Each GameStage can be hooked by including a function with that GameStage name.
 */
class Game extends ManagerComponent {
    active: boolean = false
    stage: GameStage = GameStage.Pre_begin
    moves: Move[] = []
    payoffs: Payoff[] = []
    resultString: string = ""
    readonly name: string
    readonly description: string
    readonly prompt: string
    readonly payoff_matrix: PayoffMatrix
    readonly decision_labels: [DecisionLabel, DecisionLabel] = [{text: 'cooperate'}, {text: 'defect'}]
    readonly rules: GameRule[] = [
        new GameRule(GameRules.allow_chat, EnabledStatus.Force_off),
        new GameRule(GameRules.allow_video, EnabledStatus.Force_on),
        new GameRule(GameRules.show_description, EnabledStatus.Force_on),
        new GameRule(GameRules.show_payoff_matrix, {
            [GameStage.Pre_begin]: EnabledStatus.Force_off,
            [GameStage.Initial_presentation]: EnabledStatus.Force_on,
            [GameStage.Player_moves_complete]: EnabledStatus.Force_off
        }),
        new GameRule(GameRules.allow_player_move, {
            [GameStage.Pre_begin]: EnabledStatus.Force_off,
            [GameStage.Player_moves_enabled]: EnabledStatus.Force_on,
            [GameStage.Player_moves_complete]: EnabledStatus.Force_off
        }),
        new GameRule(GameRules.show_partner_moves, {
            [GameStage.Pre_begin]: EnabledStatus.Force_off,
            [GameStage.Reveal_moves]: EnabledStatus.Force_on
        }),
        new GameRule(GameRules.show_partner_payoff, {
            [GameStage.Pre_begin]: EnabledStatus.Force_off,
            [GameStage.Reveal_payoff]: EnabledStatus.Force_on
        }),
        new GameRule(GameRules.show_own_score, EnabledStatus.Force_on),
        new GameRule(GameRules.show_partner_score, EnabledStatus.Force_on),
    ]
    readonly hooks: Hook[] = [
        {
            stage: GameStage.Pre_begin,
            fun: function (game: Game) {
                setTimeout(game => game.advance_stage(), 100, game)
            }
        },
        {
            stage: GameStage.Initial_presentation,
            fun: function (game: Game) {
                setTimeout(game => game.advance_stage(), stage_delay, game)
            }
        },
        {
            stage: GameStage.Player_moves_enabled,
            fun: function (game: Game) {
                // Set up move listeners for the sockets
                function do_move(move) {
                    function reject(socket: Socket, error: string) {
                        game._manager.logger.error(`Socket ${socket.id} error: ${error}`)
                        socket.emit('error', error)
                        socket.once('makeMove', do_move)
                    }
                    // Check move is valid
                    let new_move: Move
                    try {
                        new_move = {
                            player_index: game._manager.players.find(p => p.socket === this).index,
                            index: move? 1 : 0,
                            label: game.decision_labels[move? 1 : 0]
                        }
                    } catch (e) {
                        return reject(this, "That is not a valid move.")
                    }
                    // Record move
                    game._manager.logger.debug(`New move: ${new_move.player_index} selects '${new_move.label.text}' [${new_move.index}]`)
                    game.moves.push(new_move)
                    // If both players have moved, proceed
                    if(game.moves.length === 2) {
                        game.advance_stage()
                    }
                }

                game._manager.players.forEach(p => p.socket.once('makeMove', do_move))
                game.advance_stage()
            }
        },
        {
            stage: GameStage.Player_moves_complete,
            fun: game => game.advance_stage()
        },
        {
            stage: GameStage.Reveal_moves,
            fun: game => setTimeout(game => game.advance_stage(), stage_delay, game)
        },
        {
            stage: GameStage.Reveal_payoff,
            fun: game => {
                // Matrix indexed by player move values
                // Player 2 (index=1) first because P1 is columns and P2 is rows!
                const payoffs = game.payoff_matrix[
                    game.moves.find(m => game._manager.getPlayerByIndex(m.player_index).index === 1).index
                    ][
                    game.moves.find(m => game._manager.getPlayerByIndex(m.player_index).index === 0).index
                    ]
                game.payoffs = payoffs.payoffs
                game.resultString = payoffs.resultString(...game._manager.players)
                game._manager.logger.debug(`${game.resultString} [P1=${game.payoffs[0].value}, P2=${game.payoffs[1].value}]`)
                game.moves.forEach(m => {
                    const p = game._manager.getPlayerByIndex(m.player_index)
                    p.score += game.payoffs[p.index].value
                })
                // setTimeout(game => game.advance_stage(), stage_delay, game)
            }
        },
        {
            stage: GameStage.End,
            fun: game => setTimeout(game => game.advance_stage(), stage_delay, game)
        },
        {
            stage: GameStage.Cleanup,
            fun: game => game._manager.next_game()
        }
    ]

    constructor(manager, props) {
        super(manager);
        for(let p in props) {
            this[p] = props[p]
        }
    }

    get state(): GameState {
        const rules: Partial<{ [k in GameRules]: EnabledStatus }> = {}
        for(const r of this.rules) {
            rules[r.name] = r.values[this.stage]
        }
        return  {
            name: this.name,
            description: this.description,
            prompt: this.prompt,
            stage: this.stage,
            rules,
            decision_labels: this.decision_labels,
            moves: this.moves,
            payoffs: this.payoffs,
            resultString: this.resultString,
            timestamp: new Date().getTime()
        }
    }

    advance_stage(force_stage?: GameStage) {
        let found = false
        let new_stage
        if(typeof force_stage === 'undefined') {
            for(const gamestage in GameStage) {
                const stage = GameStage[gamestage as keyof typeof GameStage]
                if(found) {
                    new_stage = stage
                    break
                } else if(stage === this.stage) {
                    found = true
                }
            }
        } else {
            new_stage = force_stage
        }

        if(!new_stage) {
            this._manager.logger.debug(`No next stage found from ${this.stage}`)
        }

        this._manager.logger.debug(`Stage ${this.stage} -> ${new_stage}`)
        let hooks = this.hooks.filter(h => h.stage === this.stage && h.when === "post")
        if(hooks.length) {
            this._manager.logger.debug(`Executing ${hooks.length} hooked functions for post_${this.stage}`)
            hooks.forEach(h => h.fun(this, h.context_arg))
        }
        this.stage = new_stage

        // Execute hooked functions
        hooks = this.hooks.filter(h => h.stage === this.stage && h.when === "pre")
        if(hooks.length) {
            this._manager.logger.debug(`Executing ${hooks.length} hooked functions for pre_${this.stage}`)
            hooks.forEach(h => h.fun(this, h.context_arg))
        }
        hooks = this.hooks.filter(h => h.stage === this.stage && !h.when)
        if(hooks.length) {
            this._manager.logger.debug(`Executing ${hooks.length} hooked functions for ${this.stage}`)
            hooks.forEach(h => h.fun(this, h.context_arg))
        }
        this._manager.broadcast()
    }

    get_rule(rule: GameRules): EnabledStatus {
        try {
            return this.rules.find(r => r.name === rule).values[this.stage]
        } catch (e) {
            return EnabledStatus.Unset
        }
    }

    get index() {
        return this._manager.games.indexOf(this)
    }
}

class Message extends ManagerComponent {

}

class VideoManager extends ManagerComponent {
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
        const self = this
        this.ov = new OpenVidu(process.env.OPENVIDU_URL, process.env.OPENVIDU_SECRET)
        this.ov.createSession(this.ov_session_props)
            .then(session => self.ov_session = session)
            .then(() => self._manager.logger.info(self.ov_session))
            .catch(err => {
                self._manager.logger.error("Unable to connect to OpenVidu server.")
                throw new Error(err)
            })
    }

    get_token(player: Player, i: number = 0): Promise<string|null> {
        const self = this
        // Handle connection requests where session not yet initialized
        if(!this.ov_session) {
            this._manager.logger.debug(`Delaying generation of ov_token for ${player.id} due to uninitalized session [${i}]`)
            return new Promise((resolve, reject) => {
                const retry_delay = 50
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
        if(!conn) {
            return this.ov_session.createConnection({
                ...self.ov_connection_props,
                data: JSON.stringify({id: player.id, index: player.index})
            })
                .then(connection => {
                    self.connections.push({player, connection})
                    return connection.token
                })
                .catch(err => {
                    self._manager.logger.error(err)
                    return null
                })
        } else {
            return new Promise(resolve => resolve(conn.connection.token))
        }
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

export { Manager, Game, GameRules }