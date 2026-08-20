// Test script to debug SMS issues
// Run this with: node test-sms.js

// Load environment variables (simulate Next.js environment)
require('dotenv').config({ path: '.env.local' });

// Check environment variables
console.log('=== SMS Configuration Check ===');
console.log('WIGAL_API_KEY exists:', !!process.env.WIGAL_API_KEY);
console.log('WIGAL_USERNAME exists:', !!process.env.WIGAL_USERNAME);
console.log('WIGAL_API_URL:', process.env.WIGAL_API_URL || 'https://frogapi.wigal.com.gh');
console.log('WIGAL_SENDER_ID:', process.env.WIGAL_SENDER_ID || 'HostelHQ');

if (!process.env.WIGAL_API_KEY) {
    console.log('❌ ERROR: WIGAL_API_KEY is missing from .env.local');
    console.log('Please add: WIGAL_API_KEY=your_api_key_here');
    process.exit(1);
}

if (!process.env.WIGAL_USERNAME) {
    console.log('❌ ERROR: WIGAL_USERNAME is missing from .env.local');
    console.log('Please add: WIGAL_USERNAME=your_username_here');
    process.exit(1);
}

console.log('✅ Environment variables are loaded');

// Test SMS function (copied from your wigal.ts)
async function testSMS() {
    const WIGAL_API_KEY = process.env.WIGAL_API_KEY;
    const WIGAL_USERNAME = process.env.WIGAL_USERNAME;
    const WIGAL_API_URL = process.env.WIGAL_API_URL || 'https://frogapi.wigal.com.gh';
    const WIGAL_SENDER_ID = process.env.WIGAL_SENDER_ID || 'HostelHQ';

    function formatPhoneNumber(phone) {
        let cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('233')) {
            cleaned = cleaned.substring(3);
        }
        while (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }
        if (!cleaned.startsWith('0')) {
            cleaned = '0' + cleaned;
        }
        return cleaned;
    }

    const testPhone = '0542709440'; // Test number
    const testMessage = 'Test message from HostelHQ SMS system';

    console.log('\n=== Testing SMS API ===');
    console.log('Phone:', testPhone);
    console.log('Message:', testMessage);
    console.log('Formatted phone:', formatPhoneNumber(testPhone));

    try {
        const requestBody = {
            senderid: WIGAL_SENDER_ID,
            destinations: [
                {
                    destination: formatPhoneNumber(testPhone),
                    msgid: `TEST${Date.now()}`,
                }
            ],
            message: testMessage,
            smstype: 'text',
        };

        console.log('\nRequest body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(`${WIGAL_API_URL}/api/v3/sms/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'API-KEY': WIGAL_API_KEY,
                'USERNAME': WIGAL_USERNAME,
            },
            body: JSON.stringify(requestBody),
        });

        console.log('\nResponse status:', response.status, response.statusText);
        
        const responseText = await response.text();
        console.log('Response body:', responseText);

        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.log('Could not parse response as JSON');
            responseData = { raw: responseText };
        }

        if (response.ok && (responseData.status === 'ACCEPTD' || responseData.status === 'SUCCESS')) {
            console.log('✅ SMS test successful!');
        } else {
            console.log('❌ SMS test failed');
            console.log('Error details:', responseData);
        }

    } catch (error) {
        console.error('❌ Network error:', error.message);
    }
}

// Run the test
testSMS().catch(console.error);
