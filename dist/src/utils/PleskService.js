"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubdomain = createSubdomain;
exports.deleteSubdomain = deleteSubdomain;
exports.sanitizeSubdomainName = sanitizeSubdomainName;
exports.validateSubdomainName = validateSubdomainName;
exports.enableNodeJsOnDomain = enableNodeJsOnDomain;
exports.executePleskCli = executePleskCli;
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
// Create HTTPS agent that accepts self-signed certificates (for local Plesk)
const httpsAgent = new https_1.default.Agent({ rejectUnauthorized: false });
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
async function sendPleskRequest(xmlPacket) {
    const { apiKey, apiUrl } = getPleskConfig();
    if (!apiKey) {
        throw new Error('PLESK_API_KEY is not configured. Please set it in your .env file.');
    }
    try {
        const response = await axios_1.default.post(apiUrl, xmlPacket, {
            headers: {
                'Content-Type': 'text/xml',
                'KEY': apiKey,
            },
            httpsAgent: httpsAgent,
        });
        return response.data;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Plesk API request failed:', message);
        throw new Error(`Plesk API request failed: ${message}`);
    }
}
/**
 * Parse the Plesk XML response to check for errors.
 * Returns the result or throws an error if the operation failed.
 */
function parsePleskResponse(responseXml, operation) {
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
async function createSubdomain(subdomainName) {
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
async function deleteSubdomain(subdomainName) {
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
function sanitizeSubdomainName(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-') // Replace spaces/underscores with hyphens
        .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric/hyphen chars
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .replace(/-{2,}/g, '-') // Collapse multiple hyphens
        .substring(0, 63); // DNS label max length
}
/**
 * Validate a subdomain name.
 * Returns null if valid, or an error message string if invalid.
 */
function validateSubdomainName(name) {
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
 * Enable Node.js support for a domain using the Plesk CLI via XML API.
 *
 * @param subdomainName - The subdomain prefix (e.g., "api-myschool")
 */
async function enableNodeJsOnDomain(subdomainName) {
    const { parentDomain } = getPleskConfig();
    const sanitized = sanitizeSubdomainName(subdomainName);
    const fullSubdomain = `${sanitized}.${parentDomain}`;
    console.log(`Enabling Node.js for subdomain: ${fullSubdomain}`);
    const xmlPacket = `<?xml version="1.0" encoding="UTF-8"?>
<packet>
  <extension>
    <call>
      <nodejs>
        <enable>
          <domain>${fullSubdomain}</domain>
        </enable>
      </nodejs>
    </call>
  </extension>
</packet>`;
    const response = await sendPleskRequest(xmlPacket);
    parsePleskResponse(response, 'enable node.js');
}
/**
 * Execute a Plesk CLI command utilizing the Plesk REST API.
 * This expertly bypasses the Linux 'sudo' restriction by submitting commands
 * directly to the authenticated internal Plesk system.
 *
 * @param utility - The CLI utility name (e.g., 'nodejs' or 'domain')
 * @param args - Array of string arguments to pass to the utility
 */
async function executePleskCli(utility, args) {
    const { host, port, apiKey } = getPleskConfig();
    const apiUrl = `https://${host}:${port}/api/v2/cli/${utility}/call`;
    if (!apiKey) {
        throw new Error('PLESK_API_KEY is not configured in .env');
    }
    console.log(`[Plesk API] Executing CLI command via REST: plesk bin ${utility} ${args.join(' ')}`);
    try {
        const response = await axios_1.default.post(apiUrl, { params: args }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey,
                'Accept': 'application/json'
            },
            httpsAgent: httpsAgent,
        });
        const data = response.data;
        // Even if HTTP is 200 OK, the internal command might have failed (code != 0)
        if (data && data.code !== 0) {
            console.warn(`[Plesk API Warning] Command returned code ${data.code}. Stderr: ${data.stderr}`);
            throw new Error(`Command failed with code ${data.code}: ${data.stderr || data.stdout}`);
        }
        return data;
    }
    catch (error) {
        const message = error.response?.data?.message || error.message;
        const stderr = error.response?.data?.stderr || '';
        console.error(`[Plesk REST API Error] Failed to execute ${utility}: ${message}. Stderr: ${stderr}`);
        throw new Error(`Plesk CLI execution failed: ${message} - ${stderr}`);
    }
}
