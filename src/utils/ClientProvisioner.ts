import fs from 'fs/promises';
import path from 'path';
import { createSubdomain, deleteSubdomain } from './PleskService';

// ============================================================================
// Configuration
// ============================================================================

// The directory where Plesk stores virtual hosts. 
// On Linux this is usually /var/www/vhosts/<domain>/
// Note: Since your API script puts them in /subdomains/, we append that here.
// IMPORTANT: Update this to match your actual Plesk linux path
const PLESK_VHOSTS_DIR = process.env.PLESK_VHOSTS_DIR || '/var/www/vhosts/systego.net/subdomains';

// Where your master "template" builds are located
const MASTER_FRONTEND_DIR = process.env.MASTER_FRONTEND_DIR || '/var/www/vhosts/systego.net/master-builds/frontend-latest';
const MASTER_BACKEND_DIR = process.env.MASTER_BACKEND_DIR || '/var/www/vhosts/systego.net/master-builds/backend-latest';

// ============================================================================
// Service Methods
// ============================================================================

/**
 * Provisions a complete new client instance on Plesk (Frontend + Backend)
 * 
 * @param clientName The sanitized name of the client (e.g. "myschool")
 * @param dbConfig The database credentials generated for this client
 */
export async function provisionNewClient(
    clientName: string,
    dbConfig: { dbName: string; dbUser: string; dbPass: string }
) {
    console.log(`[Provisioning] Starting for client: ${clientName}`);

    // 1. Create the dual subdomains in Plesk via our XML API
    const frontendSubdomainUrl = await createSubdomain(clientName);
    const backendSubdomainUrl = await createSubdomain(`api-${clientName}`);

    console.log(`[Provisioning] Created subdomains: ${frontendSubdomainUrl} & ${backendSubdomainUrl}`);

    try {
        // 2. Determine paths for the newly created Plesk subdomains
        // Note: Plesk often puts subdomains in a 'subdomains' folder or directly in vhosts. 
        // Adjust the path resolution below based on your Plesk setup.
        // E.g., C:\Inetpub\vhosts\systego.net\api-myschool
        const frontendDestDir = path.join(PLESK_VHOSTS_DIR, clientName);
        const backendDestDir = path.join(PLESK_VHOSTS_DIR, `api-${clientName}`);

        // 3. Copy Frontend template (React JS build)
        console.log(`[Provisioning] Copying frontend files to ${frontendDestDir}`);
        await copyDirectory(MASTER_FRONTEND_DIR, frontendDestDir);

        // 4. Create the necessary .htaccess for the React frontend
        await generateFrontendHtaccess(frontendDestDir);

        // 5. Copy Backend template (Node.js TypeScript dist folder)
        console.log(`[Provisioning] Copying backend files to ${backendDestDir}`);
        await copyDirectory(MASTER_BACKEND_DIR, backendDestDir);

        // 6. Generate client-specific .env file for the Node.js backend
        await generateBackendEnv(backendDestDir, clientName, frontendSubdomainUrl, dbConfig);

        // 7. Trigger a restart for the Node.js backend
        // Plesk Passenger restarts the app when a tmp/restart.txt file is touched
        await triggerNodeRestart(backendDestDir);

        console.log(`[Provisioning] Successfully completed for ${clientName}!`);

        return {
            frontendUrl: `https://${frontendSubdomainUrl}`,
            backendApiUrl: `https://${backendSubdomainUrl}`
        };

    } catch (error) {
        console.error(`[Provisioning] Error provisioning files for ${clientName}`, error);

        // Optional: Rollback subdomain creation if file copy fails
        // console.log(`[Provisioning] Rolling back subdomains...`);
        // await deleteSubdomain(clientName);
        // await deleteSubdomain(`api-${clientName}`);

        throw error;
    }
}

/**
 * Helper: Recursively copy a directory (Requires Node 16.7+)
 */
async function copyDirectory(src: string, dest: string) {
    try {
        await fs.access(src);
    } catch {
        throw new Error(`Master template directory not found at: ${src}`);
    }

    // recursive: true copies all contents inside the source directory
    await fs.cp(src, dest, { recursive: true, force: true });
}

/**
 * Helper: Generates the specialized .env file for the client's backend
 */
async function generateBackendEnv(
    destDir: string,
    clientName: string,
    frontendUrl: string,
    dbConfig: { dbName: string; dbUser: string; dbPass: string }
) {
    const envPath = path.join(destDir, '.env');

    // Customize this based on your backend's required environment variables
    const envContent = `
# Environment Variables for ${clientName}
PORT=3000
NODE_ENV=production

# Security & CORS
FRONTEND_URL=https://${frontendUrl}
JWT_SECRET=${generateRandomSecret()}

# MongoDB Configuration
MongoDB_URI=mongodb+srv://${dbConfig.dbUser}:${dbConfig.dbPass}@supersystego.pl2xvvc.mongodb.net/${dbConfig.dbName}?retryWrites=true&w=majority&appName=SuperSystego

# QZ Tray Certificates 
QZ_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7rRRvkUfxov4B
GlI1wmfCzfE4LTGM4xi6nYRdxPQdm4Ay/9VFbQHp/RMMP3gNU78fP3LmQaCfQhyP
Lg2Y+cvaqn/PrlctJJ6KT6JPuo6qFwu49auYOv35FomxO73CnGe0k9X3n9tUvuga
3aPwwRTIeZQjlM0OC59rA3WTp9kTcHLMPEL0OQ8jo7hgDqjw4gewVBEOVSRExy7+
WxITv8KbDiLXaSfRm54tdztSxLFrbgOReygfAIBfsnNvh07HGFcjIvsvYihcva/5
JX5CaZ/JeETyPEPIuuPe3zC3hpSLiPyNDNzHM4lBSPBP+JkRTWmMth+FbDZrlyZm
PrqEeuU1AgMBAAECggEABrf4rNEkebPjkvzdvOXzmqeOafvtiQUnlqVanpQVRyq7
dAKboHYkD5E19DDLe/Knu2x6kQqqv44kK+4H95YtuZYeqDvYtsQtAXeTWyEAcs9g
uzje8T60u+JA1f2fr/ldxGWsecZubtdnbhrJf9jHBTGbtOBirOI2oqPyOscoqseX
zqGSQgjV0hanBUoCVQ90anfYPWAykCcygU1ueNIeheMl1Z1FfkBV5Urg9wdD0APi
faNL8ysznLHq4T14HQb195/I4rxw+sagF6nnZ6WOSzF6+Ulwt9ciQ1QGrsAAulaD
mMEp+CJnCaL+rdA2poTb4sNde9zazkyoyT6AN3MauwKBgQD2v3ZfdAZR51Cu8HqH
Z1x1822TSHTtH8X2ZAU6VrZvetNhaT0OdkLa/klomv2ekpSSsslN4M+JsYyE/MH2
WKnYlUVwLF3sfeCh7A3rUyUOdz9JKHgz0tFiFJIGvKcqzUBkRlXcmFZJcOEvK3cV
HPSh4u8HZ/LtJK5bpdEejtJwEwKBgQDCtpYJOXtoJzIN5dGahN8LpR8Up1355Kv3
rhLfCiuRNg1JDIDnx7c9QDm050o6XtHt94FJgbwNskqRRAzUyRjuZ7PXluc9kxJ/
sshG4GVvipYmGGRZuj4rFcI5Xw4+Xp5dncJu62jJmlFHZGLEc7M+91lDFMxy/w+8
hdbDX5dOlwKBgQD1vxRu1shglCeoQ7tU1d2hX7M3J8fETovD7DPEuY3zE3opHz3/
BEtrfiywcQS9BLHSNRwGYytvsJQJ8w5egkmOeoRwxs84dNnfipEGWYWjlaJDA3pL
6uA8dc5FxWgcWdWSyPZEwLfXZwPvDbQJJBCEltaHIsEv7AN3JXtTmtz9XwKBgQCa
mebfRCjcNeLkbgnTKpT+5gibmZhghlSUwD5zodud3NEHo0nmvwibNZecL9kcJ5V/
4PliqAPszBew59tYSKPnB6ggEc1hcplJk2a6AAoKWnuFm/Bx3hLmmswwSW1B0Fbl
9hEfiQMWr9TBXs+dNFCqOjNBtA3xcNvJ0GsJjajR2QKBgBDgWQxIHoBNB6UF3Xbc
xM7JvhRVzkaNjId6Gg0mBgXUvWxrKNFqbqhSjumd9mT835SQGTVS7xC/53SQV9io
OsoH9Ua1HtmbuJ+S9Mt5aVtHmRRuMkpm4gklTSBI0HPDiW+m/YWMFb5gTczdrVvx
VDMPLxWDcbjPeZI9kZ655ioc
-----END PRIVATE KEY-----"

QZ_CERT="-----BEGIN CERTIFICATE-----
MIIECzCCAvOgAwIBAgIGAZsNqYezMA0GCSqGSIb3DQEBCwUAMIGiMQswCQYDVQQG
EwJVUzELMAkGA1UECAwCTlkxEjAQBgNVBAcMCUNhbmFzdG90YTEbMBkGA1UECgwS
UVogSW5kdXN0cmllcywgTExDMRswGQYDVQQLDBJRWiBJbmR1c3RyaWVzLCBMTEMx
HDAaBgkqhkiG9w0BCQEWDXN1cHBvcnRAcXouaW8xGjAYBgNVBAMMEVFaIFRyYXkg
RGVtbyBDZXJ0MB4XDTI1MTIxMDEzNDYxMloXDTQ1MTIxMDEzNDYxMlowgaIxCzAJ
BgNVBAYTAlVTMQswCQYDVQQIDAJOWTESMBAGA1UEBwwJQ2FuYXN0b3RhMRswGQYD
VQQKDBJRWiBJbmR1c3RyaWVzLCBMTEMxGzAZBgNVBAsMElFaIEluZHVzdHJpZXMs
IExMQzEcMBoGCSqGSIb3DQEJARYNc3VwcG9ydEBxei5pbzEaMBgGA1UEAwwRUVog
VHJheSBEZW1vIENlcnQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC7
rRRvkUfxov4BGlI1wmfCzfE4LTGM4xi6nYRdxPQdm4Ay/9VFbQHp/RMMP3gNU78f
P3LmQaCfQhyPLg2Y+cvaqn/PrlctJJ6KT6JPuo6qFwu49auYOv35FomxO73CnGe0
k9X3n9tUvuga3aPwwRTIeZQjlM0OC59rA3WTp9kTcHLMPEL0OQ8jo7hgDqjw4gew
VBEOVSRExy7+WxITv8KbDiLXaSfRm54tdztSxLFrbgOReygfAIBfsnNvh07HGFcj
IvsvYihcva/5JX5CaZ/JeETyPEPIuuPe3zC3hpSLiPyNDNzHM4lBSPBP+JkRTWmM
th+FbDZrlyZmPrqEeuU1AgMBAAGjRTBDMBIGA1UdEwEB/wQIMAYBAf8CAQEwDgYD
VR0PAQH/BAQDAgEGMB0GA1UdDgQWBBRzKTsUXKPMCaJ5xW89SGCjOFQmUTANBgkq
hkiG9w0BAQsFAAOCAQEAOsbrQnHIZ3sJUpbiV+sn+ykVIZ3EjbFPXQn15giZ8kBL
fqbM3Ig7LXZ4R2jfCG5Hb77PaHARcK1uCsnAn2erdcDlJNCCEyeXWBppFR7fn2oZ
cbY6G7lq/eEbQJNl8i7hDi8wRUfZL7kTGqC4vQZB2Bxr7O/Im4X+4SdmSPcc+hAO
0Ud3pqJZXLoSqHVmlA4ex62FEhyRVL/puggIB2QG/fTYzc/KvXMBXQ2rM1+tMdA+
B5DQc2Cg/HUWeYXuz2hgQLNnJRHzWlHxll24g8EYOtA35vLhsXZD221xPNEDB6jo
SSZp2s5zvmcvIGI1rNzab3zbJjwXHx+P00KPIVhcTA==
-----END CERTIFICATE-----"

SHIFT_REPORT_PASSWORD=123456789
`.trim();

    await fs.writeFile(envPath, envContent, 'utf-8');
    console.log(`[Provisioning] Wrote backend .env file to ${envPath}`);
}

/**
 * Helper: Generates .htaccess for React SPA routing
 */
async function generateFrontendHtaccess(destDir: string) {
    const htaccessPath = path.join(destDir, '.htaccess');
    const content = `
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
    `.trim();

    await fs.writeFile(htaccessPath, content, 'utf-8');
    console.log(`[Provisioning] Wrote frontend .htaccess file`);
}

/**
 * Helper: Touch tmp/restart.txt to restart Plesk Passenger Node.js app
 */
async function triggerNodeRestart(destDir: string) {
    const tmpDir = path.join(destDir, 'tmp');
    await fs.mkdir(tmpDir, { recursive: true }).catch(() => { }); // Ignore if exists

    const restartFile = path.join(tmpDir, 'restart.txt');

    // Change the modified time of the file, or create it if it doesn't exist
    const time = new Date();
    try {
        await fs.utimes(restartFile, time, time);
    } catch (e) {
        await fs.writeFile(restartFile, 'restart time: ' + time.toISOString());
    }
    console.log(`[Provisioning] Triggered Node.js restart (tmp/restart.txt)`);
}

/**
 * Utility: Generate a random string for JWT secret
 */
function generateRandomSecret(): string {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}
