/**
 * API - Работа с JSONBin.io для облачного хранения данных
 */

// Конфигурация JSONBin.io
const JSONBIN_CONFIG = {
    binId: '6996fea1ae596e708f37294a',
    masterKey: '$2a$10$tVHd9xtbmreg9CM50EUxdeg3QYJTt.cDKIJyrG4DKIBh.MgIl19g2',
    apiBaseUrl: 'https://api.jsonbin.io/v3/b'
};

/**
 * Класс для работы с API JSONBin
 */
class Api {
    constructor(config = JSONBIN_CONFIG) {
        this.config = config;
    }

    /**
     * Проверить соединение с JSONBin
     */
    async testConnection() {
        try {
            const response = await fetch(
                `${this.config.apiBaseUrl}/${this.config.binId}/latest`,
                {
                    headers: {
                        'X-ACCESS-KEY': this.config.masterKey
                    }
                }
            );
            return response.ok;
        } catch (error) {
            console.error('JSONBin connection test failed:', error);
            return false;
        }
    }

    /**
     * Загрузить данные из JSONBin
     */
    async load() {
        try {
            const response = await fetch(
                `${this.config.apiBaseUrl}/${this.config.binId}/latest`,
                {
                    headers: {
                        'X-ACCESS-KEY': this.config.masterKey
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                data: result.record.data || [],
                lastUpdated: result.record.lastUpdated || Date.now(),
                projectName: result.record.projectName || 'Мой проект'
            };
        } catch (error) {
            console.error('Error loading from JSONBin:', error);
            throw error;
        }
    }

    /**
     * Сохранить данные в JSONBin
     */
    async save(data, projectName = 'Мой проект') {
        try {
            const payload = {
                data: data,
                lastUpdated: Date.now(),
                projectName: projectName,
                version: Date.now().toString()
            };

            const response = await fetch(
                `${this.config.apiBaseUrl}/${this.config.binId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-ACCESS-KEY': this.config.masterKey
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error saving to JSONBin:', error);
            throw error;
        }
    }

    /**
     * Загрузить данные по конкретному Bin ID (для просмотра shared)
     */
    async loadById(binId) {
        try {
            const response = await fetch(
                `${this.config.apiBaseUrl}/${binId}/latest`,
                {
                    headers: {
                        'X-ACCESS-KEY': this.config.masterKey
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                data: result.record.data || [],
                lastUpdated: result.record.lastUpdated || Date.now(),
                projectName: result.record.projectName || 'Расписание'
            };
        } catch (error) {
            console.error('Error loading bin by ID:', error);
            throw error;
        }
    }

    /**
     * Создать ссылку для шаринга
     */
    createShareLink() {
        const baseUrl = this.getBaseUrl();
        return `${baseUrl}?shared=${this.config.binId}&source=jsonbin`;
    }

    /**
     * Получить базовый URL с исправлением для file://
     */
    getBaseUrl() {
        let origin = window.location.origin;
        if (!origin || origin === 'null') {
            origin = window.location.protocol + '//' + (window.location.hostname || 'localhost');
            if (window.location.port) {
                origin += ':' + window.location.port;
            }
        }
        return origin + window.location.pathname;
    }

    /**
     * Проверить, является ли текущий URL ссылкой для просмотра
     */
    isSharedView() {
        const params = new URLSearchParams(window.location.search);
        return params.has('shared') && params.get('source') === 'jsonbin';
    }

    /**
     * Получить Bin ID из URL для просмотра
     */
    getSharedBinId() {
        const params = new URLSearchParams(window.location.search);
        return params.get('shared');
    }
}

// Экспортируем singleton instance
export const api = new Api();
export { JSONBIN_CONFIG };
