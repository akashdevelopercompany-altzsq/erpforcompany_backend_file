const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'recording_debug_v2.log');

if (fs.existsSync(logPath)) {
    console.log('--- LOG START ---');
    console.log(fs.readFileSync(logPath, 'utf8'));
    console.log('--- LOG END ---');
} else {
    console.log('Log file not found.');
}
