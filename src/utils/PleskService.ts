import axios from 'axios';
import https from 'https';

// Create HTTPS agent that accepts self-signed certificates (for local Plesk)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * PleskService - Manages subdomain creation/deletion via the Plesk XML API.
 * 
 * Uses HTTP POST to the Plesk XML API endpoint with API Key authentication.
 * Endpoint: https://<PLESK_HOST>:<PLESK_PORT>/enterprise/control/agent.php
 */

/**
 * Read Plesk config at call time (after dotenv has loaded).
 */
function getPleskConfig() {
    const host = process.env.PLESK_HOST || 'localhost';
    const port = process.env.PLESK_PORT || '8443';
    const apiKey = process.env.PLESK_API_KEY || '';
    const parentDomain = process.env.PLESK_PARENT_DOMAIN || 'systego.net';
    const apiUrl = `https://${host}:${port}/enterprise/control/agent.php`;
    return { host, port, apiKey, parentDomain, apiUrl };
}

/**
 * Send an XML packet to the Plesk API.
 */
async function sendPleskRequest(xmlPacket: string): Promise<string> {
    const { apiKey, apiUrl } = getPleskConfig();

    if (!apiKey) {
        throw new Error('PLESK_API_KEY is not configured. Please set it in your .env file.');
    }

    try {
        const response = await axios.post(apiUrl, xmlPacket, {
            headers: {
                'Content-Type': 'text/xml',
                'KEY': apiKey,
            },
            httpsAgent: httpsAgent,
        } as any);

        return response.data as string;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Plesk API request failed:', message);
        throw new Error(`Plesk API request failed: ${message}`);
    }
}

/**
 * Parse the Plesk XML response to check for errors.
 * Returns the result or throws an error if the operation failed.
 */
function parsePleskResponse(responseXml: string, operation: string): void {
    // Check for error status in the response
    const statusMatch = responseXml.match(/<status>(.*?)<\/status>/);
    const errorCodeMatch = responseXml.match(/<errcode>(.*?)<\/errcode>/);
    const errorTextMatch = responseXml.match(/<errtext>(.*?)<\/errtext>/);

    if (statusMatch && statusMatch[1] === 'error') {
        const errCode = errorCodeMatch ? errorCodeMatch[1] : 'unknown';
        const errText = errorTextMatch ? errorTextMatch[1] : 'Unknown Plesk error';
        throw new Error(`Plesk ${operation} failed [${errCode}]: ${errText}`);
    }

    if (statusMatch && statusMatch[1] === 'ok') {
        console.log(`Plesk ${operation} completed successfully.`);
        return;
    }

    // If we can't parse the status, log the raw response for debugging
    console.warn(`Plesk ${operation} response could not be fully parsed:`, responseXml);
}

/**
 * Create a subdomain under the parent domain (systego.net).
 * 
 * @param subdomainName - The subdomain prefix (e.g., "myschool")
 * @returns The full subdomain URL (e.g., "myschool.systego.net")
 */
export async function createSubdomain(subdomainName: string): Promise<string> {
    const { parentDomain } = getPleskConfig();
    const sanitized = sanitizeSubdomainName(subdomainName);
    const fullSubdomain = `${sanitized}.${parentDomain}`;

    console.log(`Creating subdomain: ${fullSubdomain}`);

    const xmlPacket = `<?xml version="1.0" encoding="UTF-8"?>
<packet>
  <subdomain>
    <add>
      <parent>${parentDomain}</parent>
      <name>${sanitized}</name>
      <property>
        <name>www_root</name>
        <value>/subdomains/${sanitized}</value>
      </property>
    </add>
  </subdomain>
</packet>`;

    const response = await sendPleskRequest(xmlPacket);
    parsePleskResponse(response, 'subdomain creation');

    return fullSubdomain;
}

/**
 * Delete a subdomain from the parent domain.
 * 
 * @param subdomainName - The subdomain prefix (e.g., "myschool")
 */
export async function deleteSubdomain(subdomainName: string): Promise<void> {
    const { parentDomain } = getPleskConfig();
    const sanitized = sanitizeSubdomainName(subdomainName);
    const fullSubdomain = `${sanitized}.${parentDomain}`;

    console.log(`Deleting subdomain: ${fullSubdomain}`);

    const xmlPacket = `<?xml version="1.0" encoding="UTF-8"?>
<packet>
  <subdomain>
    <del>
      <filter>
        <name>${fullSubdomain}</name>
      </filter>
    </del>
  </subdomain>
</packet>`;

    const response = await sendPleskRequest(xmlPacket);
    parsePleskResponse(response, 'subdomain deletion');
}

/**
 * Sanitize a subdomain name for DNS compatibility.
 * - Converts to lowercase
 * - Replaces spaces and underscores with hyphens
 * - Removes invalid characters (only allows a-z, 0-9, hyphens)
 * - Removes leading/trailing hyphens
 * - Limits to 63 characters
 */
export function sanitizeSubdomainName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')       // Replace spaces/underscores with hyphens
        .replace(/[^a-z0-9-]/g, '')    // Remove non-alphanumeric/hyphen chars
        .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
        .replace(/-{2,}/g, '-')        // Collapse multiple hyphens
        .substring(0, 63);             // DNS label max length
}

/**
 * Validate a subdomain name.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateSubdomainName(name: string): string | null {
    if (!name || name.trim().length === 0) {
        return 'Subdomain name is required';
    }

    const sanitized = sanitizeSubdomainName(name);

    if (sanitized.length < 3) {
        return 'Subdomain name must be at least 3 characters long';
    }

    if (sanitized.length > 63) {
        return 'Subdomain name cannot exceed 63 characters';
    }

    // Check for reserved names that might conflict with existing subdomains
    const reserved = ['www', 'mail', 'ftp', 'admin', 'super', 'superback', 'api', 'ns1', 'ns2', 'cpanel', 'webmail'];
    if (reserved.includes(sanitized)) {
        return `Subdomain name "${sanitized}" is reserved and cannot be used`;
    }

    return null;
}

/**
 * Execute a Plesk CLI command utilizing the Plesk XML API's <cli> operator.
 * This brilliantly avoids Linux 'sudo' permission errors AND avoids REST API 
 * authorization issues, relying entirely on the proven XML API system!
 * 
 * @param utility - The CLI utility name (e.g., 'extension' or 'domain')
 * @param args - Array of string arguments to pass to the utility
 */
export async function executePleskCli(utility: string, args: string[]): Promise<any> {
    console.log(`[Plesk API] Executing CLI command via XML: plesk bin ${utility} ${args.join(' ')}`);

    // The Plesk XML API supports a <cli> node that acts exactly like the server terminal.
    // It takes a <command> (the utility) and an array of <arg> elements.
    const argsXml = args.map(arg => `<arg>${arg}</arg>`).join('\n          ');

    const xmlPacket = `<?xml version="1.0" encoding="UTF-8"?>
<packet>
  <server>
    <cli>
      <call>
        <command>${utility}</command>
        <arguments>
          ${argsXml}
        </arguments>
      </call>
    </cli>
  </server>
</packet>`;

    try {
        const response = await sendPleskRequest(xmlPacket);

        // Use regex to look for <result><status>ok</status> inside <cli>
        const statusMatch = response.match(/<status>(.*?)<\/status>/);
        const resultMatch = response.match(/<result>(.*?)<\/result>/s);

        if (statusMatch && statusMatch[1] === 'error') {
            const errTextMatch = response.match(/<errtext>(.*?)<\/errtext>/);
            const errText = errTextMatch ? errTextMatch[1] : 'Unknown error';
            throw new Error(errText);
        }

        return { code: 0, response: resultMatch ? resultMatch[1] : 'Success' };
    } catch (error: any) {
        console.error(`[Plesk XML CLI Error] Failed to execute ${utility}: ${error.message}`);
        throw new Error(`Plesk XML CLI execution failed: ${error.message}`);
    }
}
