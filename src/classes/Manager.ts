import {Server, Socket} from 'socket.io'
import { writeFile } from 'node:fs/promises';

import { ClientGameState } from "../types/types";
import {GameRules, GameStage} from "../enums/enums";
import {Player} from "./Player";
import {Game} from "./Game";
import {VideoManager} from "./VideoManager";

const log4js = require("log4js")

export const player_timeout_delay: number = 60000

export class Manager {
    private server: Server
    players: Player[]
    games: Game[]
    id: string
    name: string
    logger
    private videoManager: VideoManager

    constructor(
        server: Server,
        room_name: string = "game",
        props: {
            server?: Server,
            players?: Player[],
            games?: Game[],
            id?: string,
            name?: string,
            logger?: object,
            video_manager?: VideoManager
        } = {}
    ) {
        this.server = props.server || server
        this.players = props.players || []
        this.games = props.games || []
        this.id = props.id || `${room_name}_${new Date().getTime().toString()}`
        this.name = props.name || room_name

        if(!props.logger) {
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
            this.logger = logger
        } else {
            this.logger = props.logger
        }

        //this.logger = console
        this.logger.debug(`Manger initialized.`)

        this.videoManager = props.video_manager || new VideoManager(this)
    }

    add_player(socket: Socket, player_name: string, network_token: string) {
        const self = this
        const player = new Player(this, {socket, name: player_name, network_token, index: this.players.length})
        const existing_player = this.players.find(p => p.id === player.id)
        if(existing_player) {
            this.logger.debug(`Refreshing socket for ${player.name} [${player.index}]`)
            existing_player.socket = socket
        } else {
            if(this.players.length === 2) {
                this.logger.error(`Refusing to allow ${network_token} to join: too many players.`)
                throw new Error("Too many players!")
            }
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
            if(this.players.length === 2) {
                this.next_game()
            }
            this.broadcast()
        }

        this.videoManager.get_token(existing_player || player)
            .then(() => self.broadcast())
            .catch(err => self.logger.error(err))
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
            this.end()
        }
    }

    end() {
        console.debug(`All ${this.games.length} game(s) complete.`)
        this.broadcast()
        this.players.forEach(p => p.socket.emit("gameOver"))
        this.videoManager.close_all()
        // Save all the game data neatly into a .csv file
        const tsv_data = this.games.map((g, i) => {
            const s = g.state
            const moves = s.moves
            const rewritten_moves = s.rewritten_moves

            const f = (a, b) => a.player_index > b.player_index? 1 : -1
            moves.sort(f)
            rewritten_moves.sort(f)

            const baseline = g.stage_timestamps[`${GameStage.Pre_begin}_pre`]
            const timings = {
                time_game_start: baseline,
                t_player_1_intended_move_ms: s.moves[0].timestamp - baseline,
                t_player_2_intended_move_ms: s.moves[1].timestamp - baseline,
                t_player_1_rewritten_move_ms: s.rewritten_moves[0].timestamp - baseline,
                t_player_2_rewritten_move_ms: s.rewritten_moves[1].timestamp - baseline,
            }
            for(const k in g.stage_timestamps) {
                if(g.stage_timestamps.hasOwnProperty(k) && /_end$/.test(k)) {
                    timings[`t_${k}_ms`] = g.stage_timestamps[k] - baseline
                }
            }

            return {
                game_name: s.name,
                game_number: i,
                player_1_name: this.players[0].name,
                player_2_name: this.players[1].name,
                player_1_intended_move_index: s.moves[0].index,
                player_2_intended_move_index: s.moves[1].index,
                player_1_rewritten_move_index: s.rewritten_moves[0].index,
                player_2_rewritten_move_index: s.rewritten_moves[1].index,
                resultString: s.resultString,
                player_1_payoff_value: s.payoffs[0].value,
                player_2_payoff_value: s.payoffs[1].value,
                player_1_payoff_name: s.payoffs[0].label,
                player_2_payoff_name: s.payoffs[1].label,
                player_1_intended_move_text: s.moves[0].label.text,
                player_2_intended_move_text: s.moves[1].label.text,
                player_1_intended_move_icon: s.moves[0].label.icon,
                player_2_intended_move_icon: s.moves[1].label.icon,
                player_1_rewritten_move_text: s.rewritten_moves[0].label.text,
                player_2_rewritten_move_text: s.rewritten_moves[1].label.text,
                player_1_rewritten_move_icon: s.rewritten_moves[0].label.icon,
                player_2_rewritten_move_icon: s.rewritten_moves[1].label.icon,
                ...timings,
                player_1_id: this.players[0].id,
                player_2_id: this.players[1].id,
                game_description: s.description,
                game_prompt: s.prompt,
                decision_1_text: s.decision_labels[0].text,
                decision_2_text: s.decision_labels[1].text,
                decision_1_icon: s.decision_labels[0].icon,
                decision_2_icon: s.decision_labels[1].icon,
                ...s.rules,
            }
        })
        // Convert to CSV object
        const headers = []
        for(const k in tsv_data[0]) {
            if(tsv_data[0].hasOwnProperty(k)) {
                headers.push(k.replace(/\t/, ' '))
            }
        }
        const tsv = [
            headers.join('\t'),
            ...tsv_data.map(x => {
                return headers.map(h => JSON.stringify(x[h]).replace(/\t/, ' ')).join('\t')
            })
        ].join('\n')
        const self = this
        writeFile(`${process.env.GAME_DATA}/${this.id}.tsv`, tsv)
            .then(() => writeFile(
                `${process.env.GAME_DATA}/${this.id}.json`,
                JSON.stringify(tsv_data)
            ))
            .then(() => self.logger.info('Game data saved.'))
            .catch(e => self.logger.error(`Error saving game data.`, e))
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
                moves: this.current_game.rewritten_moves.filter(m =>
                    m.player_index === player.index || this.current_game.get_rule(GameRules.show_partner_moves)
                ),
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
}
