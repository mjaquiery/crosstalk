import {EnabledStatus, GameRules, GameStage} from "../enums/enums";
import {DecisionLabel, GameState, Hook, Move, Payoff, PayoffMatrix, PayoffSet, RewriteRule} from "../types/types";
import {Socket} from "socket.io";
import {Manager} from "./Manager";
import {ManagerComponent} from "./ManagerComponent";
import {GameRule} from "./GameRule";

export const stage_delay_default: number = 1000

/**
 * A Game is a single round of a game theory interaction.
 * It progresses through the GameStages.
 * Each GameStage can be hooked by including a function with that GameStage name.
 */
export class Game extends ManagerComponent {
    active: boolean = false
    stage: GameStage = GameStage.Pre_begin
    moves: Move[] = []
    payoffs: Payoff[] = []
    resultString: string = ""
    rules: GameRule[] = [
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
    rewrite_rule: RewriteRule = (move, game) => move
    timings: Partial<{[k in GameStage]: number}> = {
        [GameStage.Pre_begin]: 100,
        [GameStage.Initial_presentation]: 1000,
        [GameStage.Reveal_moves]: 1000,
        [GameStage.Reveal_payoff]: 1000
    }
    default_timing: number = stage_delay_default
    stage_timestamps: {[k: string]: number} = {}
    readonly name: string
    readonly description: string
    readonly prompt: string
    readonly payoff_matrix: PayoffMatrix
    readonly decision_labels: [DecisionLabel, DecisionLabel] = [{text: 'cooperate'}, {text: 'defect'}]
    readonly hooks: Hook[] = [
        {
            stage: GameStage.Pre_begin,
            fun: function (game: Game) {
                setTimeout(game => game.advance_stage(), game.delay, game)
            }
        },
        {
            stage: GameStage.Initial_presentation,
            fun: function (game: Game) {
                setTimeout(game => game.advance_stage(), game.delay, game)
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
                            label: game.decision_labels[move? 1 : 0],
                            timestamp: new Date().getTime()
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
            fun: game => setTimeout(game => game.advance_stage(), game.delay, game)
        },
        {
            stage: GameStage.Reveal_payoff,
            fun: game => {
                // Matrix indexed by player move values
                // Player 2 (index=1) first because P1 is columns and P2 is rows!
                const payoffs: PayoffSet = game.payoff_matrix[
                    game.rewritten_moves.find(m => game._manager.getPlayerByIndex(m.player_index).index === 1).index
                    ][
                    game.rewritten_moves.find(m => game._manager.getPlayerByIndex(m.player_index).index === 0).index
                    ]
                game.payoffs = payoffs.payoffs
                game.resultString = payoffs.resultString(game._manager.players[0], game._manager.players[1])
                game._manager.logger.debug(`${game.resultString} [P1=${game.payoffs[0].value}, P2=${game.payoffs[1].value}]`)
                game.moves.forEach(m => {
                    const p = game._manager.getPlayerByIndex(m.player_index)
                    p.score += game.payoffs[p.index].value
                })
                setTimeout(game => game.advance_stage(), game.delay, game)
            }
        },
        {
            stage: GameStage.End,
            fun: game => setTimeout(game => game.advance_stage(), game.delay, game)
        },
        {
            stage: GameStage.Cleanup,
            fun: game => game._manager.next_game()
        }
    ]

    constructor(manager: Manager, props: {
        name?: string,
        description?: string,
        prompt?: string,
        decision_labels?: DecisionLabel[],
        rewrite_rule?: RewriteRule,
        payoff_matrix?: PayoffMatrix,
    }) {
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
            rewritten_moves: this.rewritten_moves,
            payoffs: this.payoffs,
            resultString: this.resultString,
            timestamp: new Date().getTime()
        }
    }

    get rewritten_moves() {
        return this.moves.map(m => this.rewrite_rule(m, this))
    }

    advance_stage(force_stage?: GameStage) {
        this._manager.logger.debug(`advance_stage(${force_stage})`)
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
        this.stage_timestamps[`${this.stage}_end`] = new Date().getTime()
        let hooks = this.hooks.filter(h => h.stage === this.stage && h.when === "post")
        if(hooks.length) {
            this._manager.logger.debug(`Executing ${hooks.length} hooked functions for post_${this.stage}`)
            hooks.forEach(h => h.fun(this, h.context_arg))
        }
        this.stage_timestamps[`${this.stage}_post_complete`] = new Date().getTime()
        this.stage = new_stage

        // Execute hooked functions
        this.stage_timestamps[`${this.stage}_pre`] = new Date().getTime()
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
        this.stage_timestamps[`${this.stage}_start`] = new Date().getTime()
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

    get delay() {
        if(typeof this.timings[this.stage] === 'number')
            return this.timings[this.stage]
        return this.default_timing
    }
}