/**
 * Utils - Утилиты для работы с датами, форматированием и DOM
 */

// ===== ДАТА И ВРЕМЯ =====

/**
 * Дополнить число до 2 знаков
 */
export const pad2 = n => String(n).padStart(2, '0');

/**
 * Форматировать дату для input datetime-local
 */
export function formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Форматировать дату для отображения
 */
export function formatDateTimeDisplay(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Форматировать дату кратко
 */
export function formatDateShort(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
}

/**
 * Парсить дату из строки datetime-local
 */
export function parseDateTime(str) {
    if (!str) return null;
    const [date, time] = str.split('T');
    if (!date) return null;
    const [y, m, d] = date.split('-').map(Number);
    let hh = 0, mm = 0;
    if (time) {
        [hh, mm] = time.split(':').map(Number);
    }
    return new Date(y, m - 1, d, hh, mm);
}

/**
 * Вычислить длительность между датами
 */
export function calcDuration(start, end) {
    const s = parseDateTime(start);
    const e = parseDateTime(end);
    if (!s || !e) return 0;
    return (e - s) / 60000; // минуты
}

/**
 * Форматировать длительность
 */
export function formatDuration(minutes) {
    if (minutes < 60) return `${Math.round(minutes)}м`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`;
}

/**
 * Получить статус задачи
 */
export function getStatus(progress) {
    if (progress === 0) return 'not-started';
    if (progress === 100) return 'completed';
    return 'in-progress';
}

/**
 * Получить метку времени назад
 */
export function timeAgo(date) {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return then.toLocaleDateString('ru-RU');
}

// ===== СТРОКИ =====

/**
 * Экранировать HTML
 */
export function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

/**
 * Обрезать строку
 */
export function truncate(str, len = 50) {
    if (!str || str.length <= len) return str || '';
    return str.slice(0, len) + '...';
}

// ===== DOM =====

/**
 * Создать элемент с атрибутами
 */
export function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'className') el.className = value;
        else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        }
        else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        }
        else if (key === 'dataset') {
            Object.entries(value).forEach(([k, v]) => el.dataset[k] = v);
        }
        else {
            el.setAttribute(key, value);
        }
    });
    children.forEach(child => {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    });
    return el;
}

/**
 * Получить элемент по ID
 */
export function $(id) {
    return document.getElementById(id);
}

/**
 * Получить элементы по селектору
 */
export function $$(selector) {
    return document.querySelectorAll(selector);
}

// ===== TOAST =====

/**
 * Показать уведомление
 */
export function showToast(message, type = 'info', duration = 3000) {
    const container = $('toastContainer');
    if (!container) return;

    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    const toast = createElement('div', { className: `toast ${type}` }, [
        createElement('span', { style: { fontSize: '20px', marginRight: '8px' } }, [icons[type] || 'ℹ']),
        createElement('span', {}, [message]),
        createElement('button', {
            className: 'toast-close',
            onClick: () => toast.remove()
        }, ['×'])
    ]);

    container.appendChild(toast);

    if (duration > 0) {
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    return toast;
}

// ===== СОБЫТИЯ =====

/**
 * Debounce функция
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle функция
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ===== МАТЕМАТИКА =====

/**
 * Ограничить значение в диапазоне
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Линейная интерполяция
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

// ===== URL =====

/**
 * Получить параметры URL
 */
export function getUrlParams() {
    return new URLSearchParams(window.location.search);
}

/**
 * Установить параметр URL
 */
export function setUrlParam(key, value) {
    const url = new URL(window.location.href);
    if (value) {
        url.searchParams.set(key, value);
    } else {
        url.searchParams.delete(key);
    }
    window.history.replaceState({}, '', url.toString());
}

/**
 * Получить базовый URL
 */
export function getBaseUrl() {
    // Исправление для локальных файлов (file://)
    let origin = window.location.origin;
    if (!origin || origin === 'null') {
        origin = window.location.protocol + '//' + (window.location.hostname || 'localhost');
        if (window.location.port) {
            origin += ':' + window.location.port;
        }
    }
    return origin + window.location.pathname;
}

// ===== ХРАНИЛИЩЕ =====

/**
 * Сохранить в localStorage с префиксом
 */
export function saveToStorage(key, value) {
    try {
        localStorage.setItem('gantt_' + key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

/**
 * Загрузить из localStorage
 */
export function loadFromStorage(key, defaultValue = null) {
    try {
        const saved = localStorage.getItem('gantt_' + key);
        return saved ? JSON.parse(saved) : defaultValue;
    } catch {
        return defaultValue;
    }
}

/**
 * Удалить из localStorage
 */
export function removeFromStorage(key) {
    localStorage.removeItem('gantt_' + key);
}

// ===== ТЕМА =====

/**
 * Применить тему
 */
export function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
    localStorage.setItem('gantt_theme', theme);
}

/**
 * Получить текущую тему
 */
export function getTheme() {
    return localStorage.getItem('gantt_theme') || 'dark';
}

/**
 * Переключить тему
 */
export function toggleTheme() {
    const newTheme = getTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    return newTheme;
}
