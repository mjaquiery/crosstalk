import {
    DecisionLabel,
    Game,
    Manager,
    Move,
    Payoff,
    PayoffMatrix,
    PayoffSet,
    ResultString,
    RewriteRule
} from "./src/manager"
import {Server} from "socket.io";
let managers: {[game_name: string]: Manager} = {}

const express = require('express');
const session = require('express-session');
const fs = require('fs');
const cors = require('cors');
const https = require('https');
const socketIO = require("socket.io");

const origins = ["https://localhost:8080", "https://192.168.0.84:8080"]
const corsOptions = {
    origin: origins,
    credentials: true
};
const sshOptions = {
    key: fs.readFileSync('openvidukey.pem'),
    cert: fs.readFileSync('openviducert.pem')
};

const http = https.createServer(sshOptions, express()).listen(3000, () => {
    console.log('Listening on port *:3000')
});

const io: Server = new socketIO.Server(http, {
    cors: corsOptions,
    allowEIO3: true,
    cookie: {
        sameSite: "none",
        secure: true
    }
})

function new_manger(room_name: string = "game", game_count: number = 2): Manager {
    const manager = new Manager(io, room_name)

    const coop: Payoff = {value: 2, label: 'Small fine'}
    const betrayed: Payoff = {value: 0, label: 'Huge sentence'}
    const betrayer: Payoff = {value: 10, label: 'No punishment'}
    const mutual_defection: Payoff = {value: 1, label: 'Heavy sentence'}
    const cooperate: PayoffSet = {
        resultString: (p1, p2) => `
    <span data-player-index="${p1.index}">${p1.name}</span>
     and 
    <span data-player-index="${p2.index}">${p2.name}</span>
     cooperate`,
        payoffs: [coop, coop]
    }
    const p1_betrays: PayoffSet = {
        resultString: (p1, p2) => `
    <span data-player-index="${p1.index}">${p1.name}</span>
     betrays 
    <span data-player-index="${p2.index}">${p2.name}</span>`,
        payoffs: [betrayer, betrayed]
    }
    const p2_betrays: PayoffSet = {
        resultString: (p1, p2) => `
    <span data-player-index="${p2.index}">${p2.name}</span>
     betrays 
    <span data-player-index="${p1.index}">${p1.name}</span>`,
        payoffs: [betrayed, betrayer]
    }
    const both_defect: PayoffSet = {
        resultString: (p1, p2) => `
    <span data-player-index="${p1.index}">${p1.name}</span>
     and 
    <span data-player-index="${p2.index}">${p2.name}</span>
     betray one another`,
        payoffs: [mutual_defection, mutual_defection]
    }

    const game = () => new Game(manager, {
        name: 'Prisoner\'s dilemma',
        description: `
    <p>
        You are sat at a table being interrogated. 
        Across the hall you can see your partner, also being interrogated.
        You know there isn't much evidence against you; 
        if neither you nor your partner talk, the most you'll get is a small fine.
    </p>
    <p>
        If one of you talks and the other doesn't, 
        whoever talks walks away and lets the other bear a much heavier sentence.
        If you both talk, though, you're both in for a heavy sentence.
    </p>
    `,
        prompt: `
    <p>
        The pressure is on. What are you going to do?
    </p>
    `,
        decision_labels: [
            {text: 'Keep quiet', icon: '&#129296;'},
            {text: 'Talk', icon: '&#128516;'}
        ],
        payoff_matrix: [
            // Payoff values [P1, P2] for:
            // P1 Co-op     P1 Defect
            [cooperate,     p1_betrays],    // P2 Co-op
            [p2_betrays,    both_defect],   // P2 Defect
        ]
    })

    for(let i = 0; i < game_count; i++) {
        manager.add_games(game())
    }
    return manager
}

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`)
    socket.on('joinGame', ({game_room, player_name, network_token}) => {
        try {
            if (typeof game_room !== 'string') {
                socket.emit("error", "room_name must be a string")
                return
            } else {
                game_room = game_room.replace(/\s/, '_')
            }
            if (typeof player_name !== 'string') {
                socket.emit("warning", "invalid name sent, using default")
                player_name = ""
            } else {
                if(player_name.length > 24) {
                    socket.emit("warning", "player names longer than 24 characters are truncated")
                    player_name = player_name.substr(0,24)
                }
            }
            if (typeof network_token !== 'string') {
                socket.emit("error", "network_token must be a string")
            }
            console.debug(`joinGame(${socket.id}, {game_room: ${game_room}, network_token: ${network_token}})`)
            if (!managers.hasOwnProperty(game_room)) {
                managers[game_room] = new_manger(game_room)
            }
            const manager = managers[game_room]
            try {
                manager.add_player(socket, player_name, network_token)
            } catch (e) {
                console.error("Cannot add player", e)
                socket.emit("error", e.message)
            }
        } catch (e) {
            console.error(e)
        }
    });
});

