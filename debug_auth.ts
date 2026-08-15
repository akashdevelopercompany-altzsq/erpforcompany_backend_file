
async function testAuth() {
    const API_URL = 'http://localhost:3000/';

    try {
        console.log('1. Attempting login as admin...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@artibots.com',
                password: 'password123'
            })
        });

        if (!loginRes.ok) {
            console.error('Login failed with status:', loginRes.status);
            console.error('Response:', await loginRes.text());
            return;
        }

        const loginData = await loginRes.json();
        const token = loginData.access_token;
        console.log('Login successful. Token obtained.');
        console.log('Decoded token payload (partial):', JSON.parse(atob(token.split('.')[1])));

        console.log('\n2. Attempting to register employee...');
        const registerRes = await fetch(`${API_URL}/auth/register-employee`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                email: 'designer@artibots.com',
                password: 'artibots123',
                firstName: 'Designer',
                lastName: 'User',
                gender: 'OTHER',
                // departmentId: 'dept-123' 
            })
        });

        if (!registerRes.ok) {
            console.error('Register failed with status:', registerRes.status);
            console.error('Response:', await registerRes.text());
        } else {
            console.log('Register successful:', await registerRes.json());
        }

    } catch (error) {
        console.error('Request failed:', error);
    }

    console.log('\n3. Attempting login as designer...');
    try {
        const designerLoginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'designer@artibots.com',
                password: 'artibots123'
            })
        });

        if (designerLoginRes.ok) {
            const data = await designerLoginRes.json();
            console.log('Designer login SUCCESS! Token:', data.access_token.substring(0, 20) + '...');
        } else {
            console.error('Designer login FAILED:', designerLoginRes.status, await designerLoginRes.text());
        }
    } catch (e) {
        console.error('Designer login error:', e);
    }
}

testAuth();
