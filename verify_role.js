const http = require('http');

const BASE_URL = 'http://localhost:3000/';
const SUPER_ADMIN_EMAIL = 'admin@artibots.com';
const SUPER_ADMIN_PASSWORD = 'admin123';

function request(path, method, body, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                let parsedBody = data;
                try {
                    parsedBody = JSON.parse(data);
                } catch (e) {
                    // keep as string if not json
                }
                resolve({
                    status: res.statusCode,
                    body: parsedBody,
                });
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function main() {
    try {
        // 1. Login as Super Admin
        console.log('Logging in as Super Admin...');
        const loginResponse = await request('/auth/login', 'POST', {
            email: SUPER_ADMIN_EMAIL,
            password: SUPER_ADMIN_PASSWORD,
        });

        if (loginResponse.status !== 201 && loginResponse.status !== 200) {
            throw new Error(`Login failed: ${loginResponse.status} - ${JSON.stringify(loginResponse.body)}`);
        }

        const token = loginResponse.body.access_token;
        console.log('Login successful, token received.');

        // 2. Get Profile to get ID
        const profileResponse = await request('/auth/profile', 'GET', null, token);
        console.log('Profile Response Body:', JSON.stringify(profileResponse.body, null, 2));
        const userId = profileResponse.body.userId;
        console.log(`My ID is ${userId}`);

        // 3. Update Role (Self-update to SUPER_ADMIN to test endpoint)
        console.log('Testing updateRole endpoint...');
        const updateResponse = await request(`/users/${userId}/role`, 'PATCH', { role: 'SUPER_ADMIN' }, token);

        if (updateResponse.status === 200) {
            console.log('SUCCESS: Role update endpoint returned 200 OK.');
            console.log('Updated User:', updateResponse.body);
        } else {
            console.error(`FAILURE: Role update failed with ${updateResponse.status}`);
            console.error('Error details:', updateResponse.body);
        }

    } catch (error) {
        console.error('An error occurred:', error);
    }
}

main();
