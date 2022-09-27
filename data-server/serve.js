var https = require('https');
var fs = require('fs');
var app = require('data-server.ts');
var sshOptions = {
    key: fs.readFileSync('openvidukey.pem'),
    cert: fs.readFileSync('openviducert.pem')
};
https.createServer(sshOptions, app).listen(8000, function () {
    console.log('Data server listening on port *:8000');
});
//# sourceMappingURL=serve.js.map