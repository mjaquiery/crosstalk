import {Game} from "../classes/Game";
import {Player} from "../classes/Player";
import {GameStage, GameRules, EnabledStatus} from "../enums/enums";

export type DecisionLabel = {
    text: string,
    icon?: string
}

export type Move = {
    index: number,
    label: DecisionLabel,
    player_index: number,
    timestamp: number
}

export type RewriteRule = (move: Move, game: Game) => Move

export type Hook = {
    stage: GameStage,
    fun: Function,
    when?: "pre" | "post",
    context_arg?: any
}

export type GameState = {
    name: string,
    description: string,
    prompt: string,
    stage: GameStage,
    rules: Partial<{[k in GameRules]: EnabledStatus}>,
    decision_labels: [DecisionLabel, DecisionLabel],
    moves: Move[],
    rewritten_moves: Move[],
    payoffs: Payoff[],
    resultString: string,
    number?: number,
    timestamp: number
}

export type ClientPlayer = {
    index: number,
    score: number,
    you: boolean,
    name: string
}

export type ClientGameState = {
    players: ClientPlayer[],
    game: GameState | null,
    game_count: number,
    ov_token: string|null
}


/**
 * A value for the payoff, and a label to be displayed to the receiver of the payoff
 */
export type Payoff = { value: number, label?: string }
export type ResultString = (player1: Player, player2: Player) => string
export type PayoffSet = {
    resultString: ResultString,
    payoffs: [Payoff, Payoff]
}
export type PayoffMatrix = [
    [PayoffSet, PayoffSet],
    [PayoffSet, PayoffSet]
]
