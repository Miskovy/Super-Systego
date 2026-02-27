import fs from 'fs/promises';
import path from 'path';
import { createSubdomain, deleteSubdomain, executePleskCli } from './PleskService';
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

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
    dbConfig: { dbName: string; dbUser: string; dbPass: string },
    logoBase64?: string
) {
    console.log(`[Provisioning] Starting for client: ${clientName}`);

    // 1. Create the dual subdomains in Plesk via our XML API
    const frontendSubdomainUrl = await createSubdomain(clientName);
    const backendSubdomainUrl = await createSubdomain(`api-${clientName}`);

    console.log(`[Provisioning] Created subdomains: ${frontendSubdomainUrl} & ${backendSubdomainUrl}`);

    try {
        const frontendDestDir = path.join(PLESK_VHOSTS_DIR, clientName);
        const backendDestDir = path.join(PLESK_VHOSTS_DIR, `api-${clientName}`);

        // 3. Copy Frontend template (React JS build)
        console.log(`[Provisioning] Copying frontend files to ${frontendDestDir}`);
        await copyDirectory(MASTER_FRONTEND_DIR, frontendDestDir);

        // 3.5 If a custom logo was provided, overwrite the Vite logo asset
        if (logoBase64) {
            console.log(`[Provisioning] Injecting custom client logo...`);
            await replaceClientLogo(frontendDestDir, logoBase64);
        }

        // 4. Create the necessary .htaccess for the React frontend
        await generateFrontendHtaccess(frontendDestDir);

        // 4.5. Generate client-specific .env file for the React frontend (fallback)
        await generateFrontendEnv(frontendDestDir, backendSubdomainUrl);

        // 4.6. INJECT the API URL directly into the compiled Vite bundles!
        console.log(`[Provisioning] Injecting dynamic API URLs into React bundles...`);
        await injectApiUrlIntoBundle(frontendDestDir, `https://${backendSubdomainUrl}/api`);


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
        throw new Error(`Master template directory not found at: ${src}. You must create this folder and place the files inside it before provisioning.`);
    }

    try {
        // recursive: true copies all contents inside the source directory
        // filter: ignores heavy folders like node_modules which timeout Nginx proxies
        await fs.cp(src, dest, {
            recursive: true,
            force: true,
            filter: (source) => {
                const name = path.basename(source);
                // Do not copy these heavy/unnecessary folders
                if (['node_modules', '.git', 'tmp', '.vite', 'dist_cache'].includes(name)) {
                    return false;
                }
                return true;
            }
        });
    } catch (copyError: any) {
        throw new Error(`Failed to copy files from ${src} to ${dest}. Error: ${copyError.message}`);
    }
}

/**
 * Helper: Generates the specialized .env file for the client's backend
 */
export async function generateBackendEnv(
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

    // Normalize Windows \r\n to Unix \n before writing — dotenv on Linux needs this for multiline values
    await fs.writeFile(envPath, envContent.replace(/\r\n/g, '\n'), 'utf-8');
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
 * Helper: Generates the specialized .env file for the client's React frontend
 */
async function generateFrontendEnv(destDir: string, backendUrl: string) {
    const envPath = path.join(destDir, '.env');

    // Vite injects these variables into the React build at runtime/build-time
    const envContent = `
# Automatically generated for this specific client instance
VITE_API_BASE_URL=https://${backendUrl}
`.trim();

    await fs.writeFile(envPath, envContent, 'utf-8');
    console.log(`[Provisioning] Wrote frontend .env file to ${envPath}`);
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

/**
 * Helper: Replaces the generated Vite logo with a base64 uploaded image
 */
async function replaceClientLogo(destDir: string, logoBase64: string) {
    try {
        // 1. Strip the data URI metadata if present (e.g. data:image/png;base64,)
        const base64Data = logoBase64.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // 2. Find the assets folder in the React build
        const assetsDir = path.join(destDir, 'assets');
        const files = await fs.readdir(assetsDir);

        // 3. Find the hashed logo file (e.g., logo-bexWFceL.png)
        const logoFile = files.find(f => f.startsWith('logo-') && f.endsWith('.png'));

        if (logoFile) {
            const logoPath = path.join(assetsDir, logoFile);
            // 4. Overwrite the file with the new buffer!
            await fs.writeFile(logoPath, imageBuffer);
            console.log(`[Provisioning] Successfully replaced ${logoFile} with custom client logo`);
        } else {
            console.warn(`[Provisioning] Could not find a file matching 'logo-*.png' in ${assetsDir} to replace.`);
        }
    } catch (e: any) {
        console.error(`[Provisioning] Failed to replace custom logo: ${e.message}`);
    }
}

/**
 * Helper: Recursively scans a directory and replaces the old API URL with the new one 
 * directly inside the pre-compiled JS and HTML files.
 */
async function injectApiUrlIntoBundle(dirPath: string, newApiUrl: string) {
    const oldUrlBase = 'https://bcknd.systego.net';

    // Some React apps might use /api appended, some might not. 
    // It's safest to just replace the base domain globally.

    async function scanAndReplace(currentDir: string) {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                await scanAndReplace(fullPath);
            } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html') || entry.name.endsWith('.json'))) {
                try {
                    let content = await fs.readFile(fullPath, 'utf8');

                    if (content.includes(oldUrlBase)) {
                        // Replace all occurrences globally
                        // Use a global regex to catch every instance
                        const regex = new RegExp(oldUrlBase.replace(/[.*/+?^${}()|[\]\\]/g, '\\$&'), 'g');
                        content = content.replace(regex, newApiUrl);

                        await fs.writeFile(fullPath, content, 'utf8');
                        console.log(`[Provisioning] Injected new API URL into: ${entry.name}`);
                    }
                } catch (err: any) {
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
export async function rebuildFrontendForClient(clientName: string) {
    const destDir = path.join(PLESK_VHOSTS_DIR, clientName);
    const apiSubdomain = `https://api-${clientName}.systego.net`;
    return rebuildFrontend(destDir, apiSubdomain);
}

/**
 * Helper: Injects the new URL without reinstalling frontend dependencies
 */
export async function rebuildFrontend(destDir: string, apiSubdomain: string) {
    try {
        console.log(`[Provisioning] Manually injecting API URL into ${destDir}...`);
        await injectApiUrlIntoBundle(destDir, apiSubdomain);
        console.log(`[Provisioning] Frontend URLs explicitly set successfully!`);
    } catch (err: any) {
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
// export async function deployBackendForClient(clientName: string, backendSubdomainUrl: string, backendDestDir: string) {
//     console.log(`[Provisioning] Deploying Node.js backend for ${backendSubdomainUrl}...`);

//     // REPLACE THIS with your actual Plesk system user for the subscription (e.g., 'systego', 'admin', etc.)
//     const PLESK_SYSUSER = 'YOUR_PLESK_SYSUSER';

//     try {
//         console.log(`[Provisioning] Enabling Node.js extension...`);
//         await executePleskCli('extension', ['--call', 'nodejs', '--enable', '-domain', backendSubdomainUrl]);

//         console.log(`[Provisioning] Configuring Node.js Application Root...`);
//         const relativeAppRoot = `/subdomains/api-${clientName}`;
//         await executePleskCli('extension', [
//             '--call', 'nodejs', '--update',
//             '-domain', backendSubdomainUrl,
//             '-app-root', relativeAppRoot
//         ]);

//         console.log(`[Provisioning] Generating app.js shim for Plesk default startup...`);
//         const appJsPath = path.join(backendDestDir, 'app.js');
//         // If your backend is CommonJS, keep require(). If ESM, use: await fs.writeFile(appJsPath, `import('./dist/server.js');\n`, 'utf-8');
//         await fs.writeFile(appJsPath, `require('./dist/server.js');\n`, 'utf-8');

//         console.log(`[Provisioning] Disabling Nginx proxy mode...`);
//         await executePleskCli('domain', ['--update-web-server-settings', backendSubdomainUrl, '-nginx-proxy-mode', 'false']);

//         console.log(`[Provisioning] Installing NPM dependencies for backend...`);
//         // We run npm install first. It might run as root, which is why the next step is crucial.
//         await execAsync('npm install --production', { cwd: backendDestDir });

//         console.log(`[Provisioning] Fixing file ownership for Plesk Passenger...`);
//         // This is the magic bullet for Plesk 502s. It ensures Passenger can read your app.
//         // psacln is the standard Plesk group for web files.
//         await execAsync(`chown -R ${PLESK_SYSUSER}:psacln ${backendDestDir}`);

//         console.log(`[Provisioning] Restarting backend Node.js app...`);
//         await triggerNodeRestart(backendDestDir);

//         console.log(`[Provisioning] Backend successfully deployed and started up.`);
//     } catch (error: any) {
//         console.error(`[Provisioning] Error deploying nodejs backend for ${clientName}`, error);
//         throw error;
//     }
// }
export async function deployBackendForClient(clientName: string, backendSubdomainUrl: string, backendDestDir: string) {
    console.log(`[Provisioning] Deploying Node.js backend for ${backendSubdomainUrl}...`);

    try {
        // ... (Your existing Node.js extension and app root setup code) ...

        // console.log(`[Provisioning] Installing NPM dependencies for backend...`);
        // // We run npm install first. (Runs as root/admin)
        // await execAsync('npm install --production', { cwd: backendDestDir });

        // console.log(`[Provisioning] Fetching dynamic system user for permissions...`);
        // 1. Grab the system user dynamically!
        // We pass the parent path (PLESK_VHOSTS_DIR) because the new backendDestDir might temporarily be owned by root
        const pleskSysUser = await getPleskSystemUser(PLESK_VHOSTS_DIR);
        console.log(`[Provisioning] Detected Plesk system user: ${pleskSysUser}`);
        return pleskSysUser;
        // console.log(`[Provisioning] Fixing file ownership for Plesk Passenger...`);
        // // 2. Apply the dynamic user to the chown command
        // // 'psacln' is the standard Plesk group for web files
        // await execAsync(`chown -R ${pleskSysUser}:psacln ${backendDestDir}`);

        // console.log(`[Provisioning] Restarting backend Node.js app...`);
        // await triggerNodeRestart(backendDestDir);

        // console.log(`[Provisioning] Backend successfully deployed and started up.`);
    } catch (error: any) {
        console.error(`[Provisioning] Error deploying nodejs backend for ${clientName}`, error);
        throw error;
    }
}

/**
 * Helper: Dynamically fetches the Plesk system user (owner) of the vhosts directory.
 * This ensures file permissions align perfectly with Phusion Passenger.
 */
async function getPleskSystemUser(vhostsDir: string): Promise<string> {
    try {
        // 'stat -c "%U"' returns just the username of the folder's owner
        const { stdout } = await execAsync(`stat -c "%U" ${vhostsDir}`);
        const sysUser = stdout.trim();

        if (!sysUser || sysUser === 'root') {
            throw new Error(`Invalid system user detected: ${sysUser}. Check directory paths.`);
        }

        return sysUser;
    } catch (error: any) {
        throw new Error(`Failed to dynamically fetch Plesk system user: ${error.message}`);
    }
}