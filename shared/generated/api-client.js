"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackendApiClient = exports.FrontendApiClient = exports.BaseApiClient = void 0;
exports.createApiClient = createApiClient;
class BaseApiClient {
    async getAssets(params) {
        return this.request('GET', '/api/assets', params);
    }
    async getFolders() {
        return this.request('GET', '/api/folders');
    }
    async getFolder(folderId) {
        return this.request('GET', `/api/folders/${folderId}`);
    }
    async getFolderMembers(folderId) {
        return this.request('GET', `/api/folders/${folderId}/members`);
    }
    async getDashboards() {
        return this.request('GET', '/api/dashboards');
    }
    async getDatasets() {
        return this.request('GET', '/api/datasets');
    }
    async getUsers() {
        return this.request('GET', '/api/users');
    }
    async getLineage(assetType, assetId) {
        return this.request('GET', `/api/lineage/${assetType}/${assetId}`);
    }
    async getFields(params) {
        return this.request('GET', '/api/fields', params);
    }
    async getExportData(assetType, assetId) {
        return this.request('GET', `/api/export/${assetType}/${assetId}`);
    }
}
exports.BaseApiClient = BaseApiClient;
class FrontendApiClient extends BaseApiClient {
    baseUrl;
    constructor(baseUrl = '') {
        super();
        this.baseUrl = baseUrl;
    }
    async request(method, path, params, body) {
        const baseOrigin = this.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
        const url = new URL(path, baseOrigin);
        if (params && method === 'GET') {
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined) {
                    url.searchParams.append(key, String(value));
                }
            });
        }
        const response = await fetch(url.toString(), {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(body && { 'Content-Type': 'application/json' }),
            },
            ...(body && { body: JSON.stringify(body) }),
        });
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
}
exports.FrontendApiClient = FrontendApiClient;
class BackendApiClient extends BaseApiClient {
    baseUrl;
    constructor(baseUrl = process.env.API_BASE_URL || 'http://localhost:3000') {
        super();
        this.baseUrl = baseUrl;
    }
    async request(_method, _path, _params, _body) {
        throw new Error('Backend API client should use direct service calls, not HTTP');
    }
}
exports.BackendApiClient = BackendApiClient;
function createApiClient(environment = 'frontend', baseUrl) {
    switch (environment) {
        case 'frontend':
            return new FrontendApiClient(baseUrl);
        case 'backend':
            return new BackendApiClient(baseUrl);
        default:
            throw new Error(`Unknown environment: ${environment}`);
    }
}
//# sourceMappingURL=api-client.js.map