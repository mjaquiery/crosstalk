import {Express} from "express";
import { readdir } from 'node:fs/promises';

const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path')

const app = express()

app.set('view engine', 'ejs');
app.set('views', `${__dirname}/views`)
app.use(express.static(`${__dirname}/static`))
console.debug(`Serving static from ${__dirname}/static`)

app.use(session({
    secret: 'h4ber0453RRie',
    saveUninitialized: true,
    resave: false,
    cookie: { secure: process.env.NODE_ENV !== 'test' }
}))

// middleware to test if authenticated
function isAuthenticated (req: Express.Request, res: Express.Response, next: Express.NextFunction) {

    if (req.session.logged_on) next()
    else {
        console.debug(`Authentication failed; redirecting to /login`, req.session)
        res.render('login', { warning: "You must log in to continue." })
    }
}

app.get('/login', function (req: Express.Request, res: Express.Response) {
    res.render('login')
})

app.post(
    '/login_post',
    express.urlencoded({ extended: false }),
    function (req: Express.Request, res: Express.Response, next: Express.NextFunction) {
        // login logic to validate req.body.user and req.body.pass
        // would be implemented here. for this example any combo works
        try {
            if (req.body.pass === process.env.ACCESS_PASSWORD) {
                // regenerate the session, which is good practice to help
                // guard against forms of session fixation
                req.session.regenerate(function (err) {
                    if (err) next(err)

                    // store user information in session, typically a user id
                    req.session.logged_on = true

                    // save the session before redirection to ensure page
                    // load does not happen before session is saved
                    req.session.save(function (err) {
                        console.debug(req.session)
                        if (err) return next(err)
                        res.redirect('/')
                    })
                })
            } else {
                req.session.destroy()
                res.render('login', { error: `Invalid password '${req.body.pass}'` })
            }
        } catch (e) {
            req.session.destroy()
            console.error(e)
            res.render('login', { error: e.message })
        }

    }
)

app.get('/logout', function (req: Express.Request, res: Express.Response, next: Express.NextFunction) {
    // logout logic

    // clear the user from the session object and save.
    // this will ensure that re-using the old session id
    // does not have a logged in user
    req.session.user = null
    req.session.save(function (err) {
        if (err) next(err)

        // regenerate the session, which is good practice to help
        // guard against forms of session fixation
        req.session.regenerate(function (err) {
            if (err) next(err)
            res.redirect('/login')
        })
    })
})

app.get('/', isAuthenticated, function (req: Express.Request, res: Express.Response) {
    // this is only called when there is an authentication user due to isAuthenticated
    let game_data: {type: string, file: string}[],
        video_data: {type: string, file: string}[]
    const games: {[name: string]: { data?: {[ext: string]: string}, video?: {[ext: string]: string}}} = {}
    readdir(process.env.GAME_DATA)
        .then(game_dir => game_data = game_dir.map(x => {return {type: 'data', file: x}}))
        .then(() => readdir(process.env.VIDEO_DATA))
        .then(video_dir => video_data = video_dir.map(x => {
                return {
                    type: 'video',
                    file: fs.readdirSync(`${process.env.VIDEO_DATA}/${x}`).find(f => /\.zip$/.test(f))
                }
            }))
        .then(() => {
            const data: {type: string, file: string}[] = [...game_data, ...video_data]
            data.forEach(({type, file}) => {
                const match = /(.+?)(?:_video)?\.([^.]+)$/.exec(file)
                if (!match) return
                const base_name = match[1]
                const ext = match[2]
                if (games[base_name]) {
                    games[base_name][type] = games[base_name][type]?
                        {...games[base_name][type], [ext]: file} : {[ext]: file}
                } else {
                    games[base_name] = {[type]: {[ext]: file}}
                }
            })
            console.debug(games)
        })
        .then(() => res.render('listings', {games}))
})

app.get('/download/:type/:file', isAuthenticated, function (req: Express.Request, res: Express.Response) {
    try {
        const dir = req.params.type === 'data' ?
            path.join(process.env.GAME_DATA) : path.join(process.env.VIDEO_DATA, path.parse(req.params.file).name)
        const file = path.join(dir, req.params.file)
        if(path.dirname(file) === dir) res.download(file)
        else throw new Error(`${file} not in ${dir}`)
    } catch (e) {
        console.error(`Download rejected`, e)
        res.redirect('/')
    }
})

module.exports = app
