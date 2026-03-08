"use strict";
require('dotenv').config();
const axios = require('axios');
const https = require('https');
const fs = require('fs');
const agent = new https.Agent({ rejectUnauthorized: false });
async function checkCommands() {
    try {
        const url = `https://${process.env.PLESK_HOST}:${process.env.PLESK_PORT}/api/v2/cli/commands/`;
        console.log(`Querying ${url}`);
        const response = await axios.get(url, {
            headers: {
                'X-API-Key': process.env.PLESK_API_KEY,
                'Accept': 'application/json'
            },
            httpsAgent: agent
        });
        fs.writeFileSync('plesk-commands.json', JSON.stringify(response.data, null, 2));
        console.log('Saved to plesk-commands.json');
    }
    catch (e) {
        fs.writeFileSync('plesk-commands-error.txt', e.response ? JSON.stringify(e.response.data) : e.message);
        console.log('Error saved to plesk-commands-error.txt');
    }
}
checkCommands();
