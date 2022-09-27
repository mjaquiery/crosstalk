const https = require('https');
const fs = require('fs');
const app = require('data-server.ts')

const sshOptions = {
    key: fs.readFileSync('openvidukey.pem'),
    cert: fs.readFileSync('openviducert.pem')
};

https.createServer(sshOptions, app).listen(8000, () => {
    console.log('Data server listening on port *:8000')
})