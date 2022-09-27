var session = require('supertest-session');
var server = require('../data-server.ts');
var testSession = null;
beforeEach(function () {
    testSession = session(server);
});
describe('without authorisation', function () {
    it('should render login for /', function (done) {
        testSession.get("/")
            .expect(200)
            .expect(function (res) { return expect(res.text).toContain("<title>Crosstalk Data - Login</title>"); })
            .end(done);
    });
    it('should render login for /download/...', function (done) {
        testSession.get("/download/video/TestGameName.zip")
            .expect(200)
            .expect(function (res) { return expect(res.text).toContain("<title>Crosstalk Data - Login</title>"); })
            .end(done);
    });
    it('should render /login', function (done) {
        testSession.get("/login")
            .expect(function (res) { return expect(res.text).toContain("<title>Crosstalk Data - Login</title>"); })
            .end(done);
    });
});
describe('after authenticating session', function () {
    var authenticatedSession;
    beforeEach(function (done) {
        testSession.post('/login_post')
            .send("pass=".concat(process.env.ACCESS_PASSWORD))
            .expect(302)
            .expect('location', '/')
            .end(function (err) {
            if (err)
                return done(err);
            authenticatedSession = testSession;
            return done();
        });
    });
    it('should get listings', function (done) {
        authenticatedSession.get('/')
            .expect(200)
            .expect(function (res) {
            expect(res.text).toContain("download/data/TestGameName.json");
            expect(res.text).toContain("download/data/TestGameName.tsv");
            expect(res.text).toContain("download/video/TestGameName.zip");
        })
            .end(done);
    });
    it('should download json', function (done) {
        authenticatedSession.get('/download/data/TestGameName.json')
            .expect(200)
            .expect(function (res) {
            expect(res.headers["content-disposition"]).toEqual("attachment; filename=\"TestGameName.json\"");
        })
            .end(done);
    });
    it('should download tsv', function (done) {
        authenticatedSession.get('/download/data/TestGameName.tsv')
            .expect(200)
            .expect(function (res) {
            expect(res.headers["content-disposition"]).toEqual("attachment; filename=\"TestGameName.tsv\"");
        })
            .end(done);
    });
    it('should download video', function (done) {
        authenticatedSession.get('/download/video/TestGameName.zip')
            .expect(200)
            .expect(function (res) {
            expect(res.headers["content-disposition"]).toEqual("attachment; filename=\"TestGameName.zip\"");
        })
            .end(done);
    });
});
//# sourceMappingURL=game.test.js.map