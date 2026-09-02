"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSslInstallation = exports.diagnoseClient = exports.installClientDependencies = void 0;
exports.provisionNewClient = provisionNewClient;
exports.generateBackendEnv = generateBackendEnv;
exports.rebuildFrontendForClient = rebuildFrontendForClient;
exports.rebuildFrontend = rebuildFrontend;
exports.deployBackendForClient = deployBackendForClient;
exports.getPleskSystemUser = getPleskSystemUser;
exports.getClientLogoBase64 = getClientLogoBase64;
exports.updateClientLogo = updateClientLogo;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const PleskService_1 = require("./PleskService");
const Client_1 = require("../models/schema/auth/Client");
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const execAsync = util_1.default.promisify(child_process_1.exec);
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
async function provisionNewClient(clientName, dbConfig, logoBase64) {
    console.log(`[Provisioning] Starting for client: ${clientName}`);
    // 1. Create the dual subdomains in Plesk via our XML API
    const frontendSubdomainUrl = await (0, PleskService_1.createSubdomain)(clientName);
    const backendSubdomainUrl = await (0, PleskService_1.createSubdomain)(`api-${clientName}`);
    console.log(`[Provisioning] Created subdomains: ${frontendSubdomainUrl} & ${backendSubdomainUrl}`);
    try {
        const frontendDestDir = path_1.default.join(PLESK_VHOSTS_DIR, clientName);
        const backendDestDir = path_1.default.join(PLESK_VHOSTS_DIR, `api-${clientName}`);
        // 3. Copy Frontend template (React JS build)
        console.log(`[Provisioning] Copying frontend files to ${frontendDestDir}`);
        await copyDirectory(MASTER_FRONTEND_DIR, frontendDestDir);
        // 3.5 If a custom logo was provided, overwrite the Vite logo asset
        if (logoBase64) {
            console.log(`[Provisioning] Injecting custom client logo...`);
            await replaceClientLogo(frontendDestDir, logoBase64);
            // Also replace logo in sub-projects (point-of-sale, ecommerce)
            for (const subProject of ['point-of-sale', 'ecommerce']) {
                const subDir = path_1.default.join(frontendDestDir, subProject);
                try {
                    await promises_1.default.access(subDir);
                    console.log(`[Provisioning] Injecting custom client logo into ${subProject} project...`);
                    await replaceClientLogo(subDir, logoBase64);
                }
                catch {
                    console.log(`[Provisioning] No ${subProject} directory found, skipping logo`);
                }
            }
        }
        // 4. Create the necessary .htaccess for the React frontend
        await generateFrontendHtaccess(frontendDestDir);
        // 4.5. Generate client-specific .env file for the React frontend (fallback)
        await generateFrontendEnv(frontendDestDir, backendSubdomainUrl);
        // 4.6. Also generate .env for sub-projects (point-of-sale, ecommerce)
        for (const subProject of ['point-of-sale', 'ecommerce']) {
            const subFrontendDir = path_1.default.join(frontendDestDir, subProject);
            try {
                await promises_1.default.access(subFrontendDir);
                console.log(`[Provisioning] Generating ${subProject} .env file...`);
                await generateFrontendEnv(subFrontendDir, backendSubdomainUrl);
            }
            catch {
                console.log(`[Provisioning] No ${subProject} directory found, skipping .env`);
            }
        }
        // 4.7. INJECT the API URL directly into the compiled Vite bundles!
        // This scans recursively, covering both admin and POS bundles
        console.log(`[Provisioning] Injecting dynamic API URLs into React bundles...`);
        await injectApiUrlIntoBundle(frontendDestDir, `https://${backendSubdomainUrl}`);
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
    }
    catch (error) {
        console.error(`[Provisioning] Error provisioning files for ${clientName}`, error);
        // Optional: Rollback subdomain creation if file copy fails
        // console.log(`[Provisioning] Rolling back subdomains...`);
        // await deleteSubdomain(clientName);
        // await deleteSubdomain(`api-${clientName}`);
        throw error;
    }
}
/**
 * Helper: Installs a free Let's Encrypt SSL certificate for a subdomain via Plesk CLI.
 * Uses the legacy letsencrypt extension which is installed on the Plesk server.
 * Non-fatal — logs a warning if it fails so provisioning can continue.
 */
async function installSslCertificate(subdomainUrl) {
    try {
        console.log(`[Provisioning] Installing Let's Encrypt SSL for ${subdomainUrl}...`);
        await (0, PleskService_1.executePleskCli)('extension', [
            '--exec', 'letsencrypt',
            'cli.php',
            '-d', subdomainUrl,
            '-m', process.env.SSL_ADMIN_EMAIL || 'systego.eg@gmail.com'
        ]);
        console.log(`[Provisioning] ✅ SSL certificate installed for ${subdomainUrl}`);
    }
    catch (error) {
        console.warn(`[Provisioning] ⚠️ SSL certificate installation failed for ${subdomainUrl}: ${error.message}`);
        console.warn(`[Provisioning] The site will still work over HTTP. You can manually install SSL later via Plesk.`);
    }
}
/**
 * Helper: Recursively copy a directory (Requires Node 16.7+)
 */
async function copyDirectory(src, dest) {
    try {
        await promises_1.default.access(src);
    }
    catch {
        throw new Error(`Master template directory not found at: ${src}. You must create this folder and place the files inside it before provisioning.`);
    }
    try {
        // recursive: true copies all contents inside the source directory
        // filter: ignores heavy folders like node_modules which timeout Nginx proxies
        await promises_1.default.cp(src, dest, {
            recursive: true,
            force: true,
            filter: (source) => {
                const name = path_1.default.basename(source);
                // Do not copy these heavy/unnecessary folders
                if (['node_modules', '.git', 'tmp', '.vite', 'dist_cache'].includes(name)) {
                    return false;
                }
                return true;
            }
        });
    }
    catch (copyError) {
        throw new Error(`Failed to copy files from ${src} to ${dest}. Error: ${copyError.message}`);
    }
}
/**
 * Helper: Generates the specialized .env file for the client's backend
 */
async function generateBackendEnv(destDir, clientName, frontendUrl, dbConfig, superSystegoApiKey) {
    const envPath = path_1.default.join(destDir, '.env');
    // Customize this based on your backend's required environment variables
    const envContent = `
# Environment Variables for ${clientName}
PORT=3000
NODE_ENV=production

# Security & CORS
FRONTEND_URL=https://${frontendUrl}
JWT_SECRET=${generateRandomSecret()}

VERSION_UPDATER_URL=https://updater.systego.net
VERSION_UPDATER_API_KEY=${process.env.VERSION_UPDATER_API_KEY}

# Super Systego Integration (Package Verification)
SUPER_SYSTEGO_URL=${process.env.SUPER_SYSTEGO_URL || 'https://superback.systego.net'}
SUPER_SYSTEGO_API_KEY=${superSystegoApiKey || 'NOT_SET'}

# MongoDB Configuration
MongoDB_URI=mongodb://${dbConfig.dbUser}:${dbConfig.dbPass}@127.0.0.1:27017/${dbConfig.dbName}?authSource=admin

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
    // Normalize Windows \r\n to Unix \n before writing — dotenv on Linux needs this for multiline values
    await promises_1.default.writeFile(envPath, envContent.replace(/\r\n/g, '\n'), 'utf-8');
    console.log(`[Provisioning] Wrote backend .env file to ${envPath}`);
}
/**
 * Helper: Generates .htaccess for both the Admin SPA and the Point-of-Sale SPA.
 * Uses the same proven configuration as the main systego.net domain.
 */
async function generateFrontendHtaccess(destDir) {
    const htaccessPath = path_1.default.join(destDir, '.htaccess');
    const content = `
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # 1. Add trailing slash for sub-projects if missing
    RewriteCond %{REQUEST_URI} ^/(point-of-sale|admin-login|ecommerce)$
    RewriteRule ^(.*)$ /%1/ [R=301,L]

    # 2. Handle Point of Sale SPA
    RewriteCond %{REQUEST_URI} ^/point-of-sale/
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^point-of-sale/(.*)$ /point-of-sale/index.html [L]

    # 3. Handle Admin Login SPA
    RewriteCond %{REQUEST_URI} ^/admin-login/
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^admin-login/(.*)$ /admin-login/index.html [L]

    # 4. Handle Ecommerce SPA
    RewriteCond %{REQUEST_URI} ^/ecommerce/
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ecommerce/(.*)$ /ecommerce/index.html [L]

    # 5. Handle main project (Next.js style .html extension fallback)
    RewriteCond %{REQUEST_URI} !^/(point-of-sale|admin-login|ecommerce)
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME}.html -f
    RewriteRule ^(.*)$ $1.html [L]

    # 6. Fallback to root index.html for main project
    RewriteCond %{REQUEST_URI} !^/(point-of-sale|admin-login|ecommerce)
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)$ /index.html [L]
</IfModule>
    `.trim();
    await promises_1.default.writeFile(htaccessPath, content, 'utf-8');
    console.log(`[Provisioning] Wrote frontend .htaccess file`);
}
/**
 * Helper: Generates the specialized .env file for the client's React frontend
 */
async function generateFrontendEnv(destDir, backendUrl) {
    const envPath = path_1.default.join(destDir, '.env');
    // Vite injects these variables into the React build at runtime/build-time
    const envContent = `
# Automatically generated for this specific client instance
VITE_API_BASE_URL=https://${backendUrl}
`.trim();
    await promises_1.default.writeFile(envPath, envContent, 'utf-8');
    console.log(`[Provisioning] Wrote frontend .env file to ${envPath}`);
}
/**
 * Helper: Touch tmp/restart.txt to restart Plesk Passenger Node.js app
 */
async function triggerNodeRestart(destDir) {
    const tmpDir = path_1.default.join(destDir, 'tmp');
    await promises_1.default.mkdir(tmpDir, { recursive: true }).catch(() => { }); // Ignore if exists
    const restartFile = path_1.default.join(tmpDir, 'restart.txt');
    // Change the modified time of the file, or create it if it doesn't exist
    const time = new Date();
    try {
        await promises_1.default.utimes(restartFile, time, time);
    }
    catch (e) {
        await promises_1.default.writeFile(restartFile, 'restart time: ' + time.toISOString());
    }
    console.log(`[Provisioning] Triggered Node.js restart (tmp/restart.txt)`);
}
/**
 * Utility: Generate a cryptographically secure random string for JWT secret (64 characters hex)
 */
function generateRandomSecret() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
}
/**
 * Helper: Replaces the generated Vite logo with a base64 uploaded image
 */
async function replaceClientLogo(destDir, logoBase64) {
    try {
        // 1. Strip the data URI metadata if present (e.g. data:image/png;base64,)
        const base64Data = logoBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');
        // 2. Find the assets folder in the React build
        const assetsDir = path_1.default.join(destDir, 'assets');
        const files = await promises_1.default.readdir(assetsDir);
        // 3. Find the hashed logo file (e.g., logo-bexWFceL.png)
        const logoFile = files.find(f => f.startsWith('logo-') && f.endsWith('.png'));
        if (logoFile) {
            const logoPath = path_1.default.join(assetsDir, logoFile);
            // 4. Overwrite the file with the new buffer!
            await promises_1.default.writeFile(logoPath, imageBuffer);
            console.log(`[Provisioning] Successfully replaced ${logoFile} with custom client logo`);
        }
        else {
            console.warn(`[Provisioning] Could not find a file matching 'logo-*.png' in ${assetsDir} to replace.`);
        }
    }
    catch (e) {
        console.error(`[Provisioning] Failed to replace custom logo: ${e.message}`);
    }
}
/**
 * Helper: Recursively scans a directory and replaces the old API URL with the new one
 * directly inside the pre-compiled JS and HTML files.
 */
async function injectApiUrlIntoBundle(dirPath, newApiUrl) {
    const oldUrlBase = 'https://bcknd.systego.net';
    // Some React apps might use /api appended, some might not. 
    // It's safest to just replace the base domain globally.
    // NOTE: The POS project uses "Bcknd" (capital B), so we must match case-insensitively.
    async function scanAndReplace(currentDir) {
        const entries = await promises_1.default.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path_1.default.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await scanAndReplace(fullPath);
            }
            else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html') || entry.name.endsWith('.json') || entry.name === '.env')) {
                try {
                    let content = await promises_1.default.readFile(fullPath, 'utf8');
                    // Case-insensitive check to catch both "bcknd" and "Bcknd"
                    if (content.toLowerCase().includes(oldUrlBase.toLowerCase())) {
                        // Replace all occurrences globally, case-insensitive
                        const regex = new RegExp(oldUrlBase.replace(/[.*\/+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                        content = content.replace(regex, newApiUrl);
                        await promises_1.default.writeFile(fullPath, content, 'utf8');
                        console.log(`[Provisioning] Injected new API URL into: ${entry.name}`);
                    }
                }
                catch (err) {
                    console.warn(`[Provisioning] Skipping file ${entry.name} during injection: ${err.message}`);
                }
            }
        }
    }
    await scanAndReplace(dirPath);
    console.log(`[Provisioning] Finished injecting ${newApiUrl} into compiled React bundles.`);
}
/**
 * Helper: Rebuilds the frontend by client name
 */
async function rebuildFrontendForClient(clientName) {
    const destDir = path_1.default.join(PLESK_VHOSTS_DIR, clientName);
    const apiSubdomain = `https://api-${clientName}.systego.net`;
    return rebuildFrontend(destDir, apiSubdomain);
}
/**
 * Helper: Injects the new URL without reinstalling frontend dependencies
 */
async function rebuildFrontend(destDir, apiSubdomain) {
    try {
        console.log(`[Provisioning] Manually injecting API URL into ${destDir}...`);
        await injectApiUrlIntoBundle(destDir, apiSubdomain);
        console.log(`[Provisioning] Frontend URLs explicitly set successfully!`);
    }
    catch (err) {
        throw new Error(`Failed to inject frontend URLs: ${err.message}`);
    }
}
/**
 * Automates the Plesk Node.js Backend deployment process exactly as you would do manually.
 *
 * 1. Enables Node.js extension for the backend subdomain
 * 2. Sets startup file and app mode
 * 3. Disables Nginx Proxy Mode
 * 4. Installs Production NPM dependencies
 * 5. Restarts the application
 */
async function deployBackendForClient(clientName, backendSubdomainUrl, backendDestDir) {
    console.log(`[Provisioning] Deploying Node.js backend for ${backendSubdomainUrl}...`);
    try {
        // 1. Create an empty 'public' folder to act as the Document Root
        console.log(`[Provisioning] Creating public directory for Document Root...`);
        const publicDir = path_1.default.join(backendDestDir, 'public');
        await promises_1.default.mkdir(publicDir, { recursive: true }).catch(() => { });
        // 2. Trick Plesk into setting the correct App Root by updating the Document Root first.
        // Plesk natively sets the Node.js App Root to the PARENT folder of the Document Root.
        console.log(`[Provisioning] Updating Document Root to configure App Root...`);
        await (0, PleskService_1.executePleskCli)('site', [
            '--update', backendSubdomainUrl,
            '-www-root', `subdomains/api-${clientName}/public` // No leading slash, relative to subscription root
        ]);
        // 3. DO NOT enable Node.js here! node_modules don't exist yet.
        // Enabling causes Passenger to immediately try to boot the app, which crashes.
        // Node.js will be enabled in the "Install Dependencies" step AFTER node_modules are in place.
        // 4. Generate app.js shim for Plesk default startup (with error logging)
        console.log(`[Provisioning] Generating app.js shim...`);
        const appJsPath = path_1.default.join(backendDestDir, 'app.js');
        const appJsLines = [
            "const fs = require('fs');",
            "const path = require('path');",
            "const logFile = path.join(__dirname, 'startup-error.log');",
            "",
            "process.on('uncaughtException', (err) => {",
            "    const msg = new Date().toISOString() + ' [UNCAUGHT EXCEPTION] ' + err.stack + '\\n';",
            "    fs.appendFileSync(logFile, msg);",
            "    console.error(msg);",
            "    process.exit(1);",
            "});",
            "",
            "process.on('unhandledRejection', (reason) => {",
            "    const msg = new Date().toISOString() + ' [UNHANDLED REJECTION] ' + String(reason) + '\\n';",
            "    fs.appendFileSync(logFile, msg);",
            "    console.error(msg);",
            "});",
            "",
            "try {",
            "    require('./dist/src/server.js');",
            "} catch (err) {",
            "    const msg = new Date().toISOString() + ' [STARTUP CRASH] ' + err.stack + '\\n';",
            "    fs.appendFileSync(logFile, msg);",
            "    console.error(msg);",
            "    process.exit(1);",
            "}",
            ""
        ];
        await promises_1.default.writeFile(appJsPath, appJsLines.join('\n'), 'utf-8');
        // 5. Disable Nginx proxy mode (often recommended for Node apps in Plesk)
        console.log(`[Provisioning] Disabling Nginx proxy mode...`);
        await (0, PleskService_1.executePleskCli)('domain', ['--update-web-server-settings', backendSubdomainUrl, '-nginx-proxy-mode', 'false']);
        // 6. Install Production NPM dependencies
        // console.log(`[Provisioning] Installing NPM dependencies for backend...`);
        // await execAsync('npm install --production', { cwd: backendDestDir });
        // // --- NEW SYMLINK LOGIC ---
        // console.log(`[Provisioning] Symlinking node_modules to save time and disk space...`);
        // const masterNodeModules = '/var/www/vhosts/systego.net/master-builds/backend-latest/node_modules';
        // const clientNodeModules = path.join(backendDestDir, 'node_modules');
        // // Create a symlink pointing the client's node_modules to the master node_modules
        // await execAsync(`ln -s ${masterNodeModules} ${clientNodeModules}`);
        // // -------------------------
        // 7. FIX PERMISSIONS: Give ownership back to the Plesk user
        console.log(`[Provisioning] Fixing file ownership for Plesk Passenger...`);
        await execAsync(`chown -R systego:psacln ${backendDestDir}`);
        // 8. DO NOT restart here — node_modules are not installed yet.
        // The app will be started by the "Install Dependencies" step after copying node_modules.
        console.log(`[Provisioning] Backend configured. Waiting for dependency installation before starting...`);
    }
    catch (error) {
        console.error(`[Provisioning] Error deploying nodejs backend for ${clientName}`, error);
        throw error;
    }
}
/**
 * Helper: Dynamically fetches the Plesk system user (owner) of the vhosts directory.
 * This ensures file permissions align perfectly with Phusion Passenger.
 */
async function getPleskSystemUser(vhostsDir) {
    try {
        // 'stat -c "%U"' returns just the username of the folder's owner
        const { stdout } = await execAsync(`stat -c "%U" ${vhostsDir}`);
        const sysUser = stdout.trim();
        if (!sysUser || sysUser === 'root') {
            throw new Error(`Invalid system user detected: ${sysUser}. Check directory paths.`);
        }
        return sysUser;
    }
    catch (error) {
        throw new Error(`Failed to dynamically fetch Plesk system user: ${error.message}`);
    }
}
const installClientDependencies = async (req, res) => {
    const clientId = req.params.id;
    if (!clientId) {
        return res.status(400).json({ success: false, message: "Client ID is required" });
    }
    const client = await Client_1.ClientModel.findById(clientId);
    if (!client || !client.subdomain) {
        return res.status(404).json({ success: false, message: "Client not found or subdomain not set" });
    }
    const clientName = client.subdomain;
    const PLESK_VHOSTS_DIR = '/var/www/vhosts/systego.net/subdomains';
    const backendDestDir = path_1.default.join(PLESK_VHOSTS_DIR, `api-${clientName}`);
    // 1. IMMEDIATELY return a success response to the frontend so Nginx doesn't timeout!
    res.status(202).json({
        success: true,
        message: "Dependency installation started in the background. The backend will be live shortly."
    });
    // 2. Run the heavy lifting asynchronously in the background
    (async () => {
        try {
            console.log(`[Install Job] Starting background node_modules copy for ${clientName}...`);
            // --- THE FIX: USE NATIVE LINUX COPY INSTEAD OF NPM INSTALL ---
            // 'cp -a' cleanly copies the folder, preserving inner symlinks.
            const masterNodeModules = '/var/www/vhosts/systego.net/master-builds/backend-latest/node_modules';
            await execAsync(`cp -a ${masterNodeModules} ${backendDestDir}/`);
            console.log(`[Install Job] Fixing Plesk file ownership...`);
            // CRITICAL: Give ownership back to Plesk so Passenger doesn't crash!
            await execAsync(`chown -R systego:psacln ${backendDestDir}`);
            // NOW enable Node.js for the first time — node_modules are in place,
            // so Passenger will boot the app successfully.
            console.log(`[Install Job] Enabling Node.js extension via Plesk CLI...`);
            const apiSubdomain = `api-${clientName}.systego.net`;
            await (0, PleskService_1.executePleskCli)('extension', ['--call', 'nodejs', '--enable', '-domain', apiSubdomain]);
            console.log(`[Install Job] ✅ Backend for ${clientName} is now fully live!`);
        }
        catch (error) {
            console.error(`[Install Job] ❌ Failed to copy dependencies for ${clientName}:`, error.message);
        }
    })();
};
exports.installClientDependencies = installClientDependencies;
/**
 * Diagnostic endpoint: Reads the startup-error.log and checks key files for a client backend.
 * Use this to debug "Incomplete response" errors when you don't have terminal access.
 */
const diagnoseClient = async (req, res) => {
    const { clientName } = req.body;
    if (!clientName) {
        return res.status(400).json({ success: false, message: "clientName is required" });
    }
    const PLESK_VHOSTS_DIR = '/var/www/vhosts/systego.net/subdomains';
    const backendDestDir = path_1.default.join(PLESK_VHOSTS_DIR, `api-${clientName}`);
    const diagnostics = { clientName, backendDestDir };
    try {
        // 1. Check if backend directory exists
        try {
            await promises_1.default.access(backendDestDir);
            diagnostics.directoryExists = true;
        }
        catch {
            diagnostics.directoryExists = false;
            return res.json({ success: true, data: diagnostics });
        }
        // 2. List top-level files/folders
        try {
            const entries = await promises_1.default.readdir(backendDestDir);
            diagnostics.contents = entries;
        }
        catch (e) {
            diagnostics.contents = `Error: ${e.message}`;
        }
        // 3. Check key files exist
        const keyFiles = ['app.js', '.env', 'dist/src/server.js', 'node_modules', 'package.json'];
        diagnostics.fileChecks = {};
        for (const file of keyFiles) {
            try {
                const stat = await promises_1.default.stat(path_1.default.join(backendDestDir, file));
                diagnostics.fileChecks[file] = stat.isDirectory() ? 'directory exists' : `file exists (${stat.size} bytes)`;
            }
            catch {
                diagnostics.fileChecks[file] = 'MISSING';
            }
        }
        // 4. Read startup-error.log (the most important bit!)
        try {
            const errorLog = await promises_1.default.readFile(path_1.default.join(backendDestDir, 'startup-error.log'), 'utf-8');
            diagnostics.startupErrorLog = errorLog;
        }
        catch {
            diagnostics.startupErrorLog = 'No startup-error.log found (app may not have crashed, or app.js shim is old)';
        }
        // 5. Read the .env (mask sensitive values)
        try {
            const envContent = await promises_1.default.readFile(path_1.default.join(backendDestDir, '.env'), 'utf-8');
            // Show variable names but mask values for security
            const maskedEnv = envContent.split('\n').map(line => {
                if (line.startsWith('#') || !line.includes('='))
                    return line;
                const [key] = line.split('=');
                return `${key}=***`;
            }).join('\n');
            diagnostics.envFile = maskedEnv;
        }
        catch {
            diagnostics.envFile = 'MISSING';
        }
        // 6. Read app.js content
        try {
            const appJs = await promises_1.default.readFile(path_1.default.join(backendDestDir, 'app.js'), 'utf-8');
            diagnostics.appJsContent = appJs;
        }
        catch {
            diagnostics.appJsContent = 'MISSING';
        }
        return res.json({ success: true, data: diagnostics });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.diagnoseClient = diagnoseClient;
/**
 * Endpoint to manually test SSL installation and capture the exact raw error from Plesk.
 */
const testSslInstallation = async (req, res) => {
    const { subdomainUrl } = req.body;
    if (!subdomainUrl) {
        return res.status(400).json({ success: false, message: "subdomainUrl is required (e.g. kars.systego.net)" });
    }
    try {
        console.log(`[SSL Test] Attempting to install Let's Encrypt SSL for ${subdomainUrl}...`);
        // Let's try the modern sslit extension command first
        const sslitResult = await (0, PleskService_1.executePleskCli)('extension', [
            '--exec', 'sslit',
            '--certificate', '-issue',
            '-domain', subdomainUrl,
            '-registrationEmail', process.env.SSL_ADMIN_EMAIL || 'systego.eg@gmail.com'
        ]);
        return res.json({
            success: true,
            message: `SSL installed successfully on ${subdomainUrl} via sslit`,
            rawResult: sslitResult
        });
    }
    catch (error) {
        // Fallback to the older letsencrypt extension command if sslit fails
        console.warn(`[SSL Test] sslit failed: ${error.message}. Trying legacy letsencrypt command...`);
        try {
            const leResult = await (0, PleskService_1.executePleskCli)('extension', [
                '--exec', 'letsencrypt',
                'cli.php',
                '-d', subdomainUrl,
                '-m', process.env.SSL_ADMIN_EMAIL || 'systego.eg@gmail.com'
            ]);
            return res.json({
                success: true,
                message: `SSL installed successfully on ${subdomainUrl} via legacy letsencrypt`,
                rawResult: leResult
            });
        }
        catch (leError) {
            return res.status(500).json({
                success: false,
                message: "Both SSL installation methods failed",
                sslitError: error.message,
                letsencryptError: leError.message
            });
        }
    }
};
exports.testSslInstallation = testSslInstallation;
/**
 * Gets the base64 string of the client's current logo from the provisioned frontend.
 */
async function getClientLogoBase64(clientName) {
    try {
        const destDir = path_1.default.join(PLESK_VHOSTS_DIR, clientName);
        const assetsDir = path_1.default.join(destDir, 'assets');
        const files = await promises_1.default.readdir(assetsDir);
        const logoFile = files.find(f => f.startsWith('logo-') && f.endsWith('.png'));
        if (logoFile) {
            const logoPath = path_1.default.join(assetsDir, logoFile);
            const imageBuffer = await promises_1.default.readFile(logoPath);
            return `data:image/png;base64,${imageBuffer.toString('base64')}`;
        }
    }
    catch (e) {
        console.warn(`[Provisioning] Could not get client logo: ${e.message}`);
    }
    return null;
}
/**
 * Updates the client's logo on an existing provisioned frontend.
 * Also updates the logo in sub-projects (point-of-sale, ecommerce) if they exist.
 */
async function updateClientLogo(clientName, logoBase64) {
    const destDir = path_1.default.join(PLESK_VHOSTS_DIR, clientName);
    await replaceClientLogo(destDir, logoBase64);
    // Also replace logo in sub-projects
    for (const subProject of ['point-of-sale', 'ecommerce']) {
        const subDir = path_1.default.join(destDir, subProject);
        try {
            await promises_1.default.access(subDir);
            await replaceClientLogo(subDir, logoBase64);
            console.log(`[Provisioning] Also updated logo in ${subProject} project`);
        }
        catch {
            // Sub-project directory doesn't exist, skip silently
        }
    }
}
