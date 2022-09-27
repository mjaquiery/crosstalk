"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var promises_1 = require("node:fs/promises");
var express = require('express');
var session = require('express-session');
var fs = require('fs');
var path = require('path');
var app = express();
app.set('view engine', 'ejs');
app.set('views', "".concat(__dirname, "/views"));
app.use(express.static("".concat(__dirname, "/static")));
console.debug("Serving static from ".concat(__dirname, "/static"));
app.use(session({
    secret: 'h4ber0453RRie',
    saveUninitialized: true,
    resave: false,
    cookie: { secure: process.env.NODE_ENV !== 'test' }
}));
// middleware to test if authenticated
function isAuthenticated(req, res, next) {
    if (req.session.logged_on)
        next();
    else {
        console.debug("Authentication failed; redirecting to /login", req.session);
        res.render('login', { warning: "You must log in to continue." });
    }
}
app.get('/login', function (req, res) {
    res.render('login');
});
app.post('/login_post', express.urlencoded({ extended: false }), function (req, res, next) {
    // login logic to validate req.body.user and req.body.pass
    // would be implemented here. for this example any combo works
    try {
        if (req.body.pass === process.env.ACCESS_PASSWORD) {
            // regenerate the session, which is good practice to help
            // guard against forms of session fixation
            req.session.regenerate(function (err) {
                if (err)
                    next(err);
                // store user information in session, typically a user id
                req.session.logged_on = true;
                // save the session before redirection to ensure page
                // load does not happen before session is saved
                req.session.save(function (err) {
                    console.debug(req.session);
                    if (err)
                        return next(err);
                    res.redirect('/');
                });
            });
        }
        else {
            req.session.destroy();
            res.render('login', { error: "Invalid password '".concat(req.body.pass, "'") });
        }
    }
    catch (e) {
        req.session.destroy();
        console.error(e);
        res.render('login', { error: e.message });
    }
});
app.get('/logout', function (req, res, next) {
    // logout logic
    // clear the user from the session object and save.
    // this will ensure that re-using the old session id
    // does not have a logged in user
    req.session.user = null;
    req.session.save(function (err) {
        if (err)
            next(err);
        // regenerate the session, which is good practice to help
        // guard against forms of session fixation
        req.session.regenerate(function (err) {
            if (err)
                next(err);
            res.redirect('/login');
        });
    });
});
app.get('/', isAuthenticated, function (req, res) {
    // this is only called when there is an authentication user due to isAuthenticated
    var game_data, video_data;
    var games = {};
    (0, promises_1.readdir)(process.env.GAME_DATA)
        .then(function (game_dir) { return game_data = game_dir.map(function (x) { return { type: 'data', file: x }; }); })
        .then(function () { return (0, promises_1.readdir)(process.env.VIDEO_DATA); })
        .then(function (video_dir) { return video_data = video_dir.map(function (x) {
        return {
            type: 'video',
            file: fs.readdirSync("".concat(process.env.VIDEO_DATA, "/").concat(x)).find(function (f) { return /\.zip$/.test(f); })
        };
    }); })
        .then(function () {
        var data = __spreadArray(__spreadArray([], game_data, true), video_data, true);
        data.forEach(function (_a) {
            var _b, _c, _d, _e;
            var type = _a.type, file = _a.file;
            var match = /(.+?)(?:_video)?\.([^.]+)$/.exec(file);
            if (!match)
                return;
            var base_name = match[1];
            var ext = match[2];
            if (games[base_name]) {
                games[base_name][type] = games[base_name][type] ? __assign(__assign({}, games[base_name][type]), (_b = {}, _b[ext] = file, _b)) : (_c = {}, _c[ext] = file, _c);
            }
            else {
                games[base_name] = (_d = {}, _d[type] = (_e = {}, _e[ext] = file, _e), _d);
            }
        });
        console.debug(games);
    })
        .then(function () { return res.render('listings', { games: games }); });
});
app.get('/download/:type/:file', isAuthenticated, function (req, res) {
    try {
        var dir = req.params.type === 'data' ?
            path.join(process.env.GAME_DATA) : path.join(process.env.VIDEO_DATA, path.parse(req.params.file).name);
        var file = path.join(dir, req.params.file);
        if (path.dirname(file) === dir)
            res.download(file);
        else
            throw new Error("".concat(file, " not in ").concat(dir));
    }
    catch (e) {
        console.error("Download rejected", e);
        res.redirect('/');
    }
});
module.exports = app;
//# sourceMappingURL=data-server.js.map