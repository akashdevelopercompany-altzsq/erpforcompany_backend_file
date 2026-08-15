async function testLogin() {
    try {
        const response = await fetch('http://127.0.0.1:3000/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'admin@artibots.com',
                password: 'admin123'
            })
        });

        console.log('Status:', response.status);
        if (response.ok) {
            const data = await response.json();
            console.log('Login successful!');
            console.log('Data:', data);
        } else {
            console.log('Login failed!');
            const text = await response.text();
            console.log('Error:', text);
        }
    } catch (error) {
        console.error('Network error:', error);
    }
}

testLogin();
