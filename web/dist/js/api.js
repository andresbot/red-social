import { CONFIG } from './config.js';
import { AppState } from './state.js';
import { Utils } from './utils.js';

// API Client
export const API = {
    // Headers con autenticación
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (AppState.token) {
            headers['Authorization'] = `Bearer ${AppState.token}`;
        }
        return headers;
    },
    
    // POST multipart (FormData)
    async postMultipart(endpoint, formData) {
        try {
            const headers = {};
            if (AppState.token) headers['Authorization'] = `Bearer ${AppState.token}`;
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers, // No set Content-Type; browser sets multipart boundaries
                body: formData
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('POST Multipart Error:', error);
            Utils.showToast(error.message || 'Error al enviar archivos', 'error');
            throw error;
        }
    },
    
    // GET request
    async get(endpoint) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
                method: 'GET',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('GET Error:', error);
            Utils.showToast('Error al cargar datos', 'error');
            throw error;
        }
    },
    
    // POST request
    async post(endpoint, data) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('POST Error:', error);
            Utils.showToast(error.message || 'Error al enviar datos', 'error');
            throw error;
        }
    },
    
    // PUT request
    async put(endpoint, data) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('PUT Error:', error);
            Utils.showToast('Error al actualizar', 'error');
            throw error;
        }
    },
    
    // PATCH request
    async patch(endpoint, data) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('PATCH Error:', error);
            Utils.showToast('Error al actualizar', 'error');
            throw error;
        }
    },
    
    // DELETE request
    async delete(endpoint) {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
                method: 'DELETE',
                headers: this.getHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('DELETE Error:', error);
            Utils.showToast('Error al eliminar', 'error');
            throw error;
        }
    },
    
    // Health check
    async checkHealth() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/health`);
            return response.ok;
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }
};
