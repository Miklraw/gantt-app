/**
 * Notifications - Модуль для автоматических уведомлений о дедлайнах
 * Для ручной рассылки используйте модуль broadcast.js
 */

import { store } from './store.js';
import { $, showToast, loadFromStorage, saveToStorage } from './utils.js';

class Notifications {
    constructor() {
        this.config = loadFromStorage('telegram_config', {
            botToken: '',
            chatId: ''
        });
        this.checkInterval = null;
    }

    /**
     * Инициализация (для настроек)
     */
    init() {
        this.loadConfig();
        this.bindEvents();
    }

    /**
     * Загрузка конфигурации в UI
     */
    loadConfig() {
        const tokenInput = $('telegramToken');
        const chatIdInput = $('telegramChatId');

        if (tokenInput) tokenInput.value = this.config.botToken || '';
        if (chatIdInput) chatIdInput.value = this.config.chatId || '';
    }

    /**
     * Сохранение конфигурации
     */
    saveConfig() {
        const tokenInput = $('telegramToken');
        const chatIdInput = $('telegramChatId');

        this.config.botToken = tokenInput?.value?.trim() || '';
        this.config.chatId = chatIdInput?.value?.trim() || '';

        saveToStorage('telegram_config', this.config);
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        const testBtn = $('testTelegramBtn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.test());
        }

        // Авто-сохранение при изменении полей
        const tokenInput = $('telegramToken');
        const chatIdInput = $('telegramChatId');

        if (tokenInput) {
            tokenInput.addEventListener('change', () => this.saveConfig());
        }
        if (chatIdInput) {
            chatIdInput.addEventListener('change', () => this.saveConfig());
        }
    }

    /**
     * Проверка конфигурации
     */
    isConfigured() {
        return this.config.botToken && this.config.chatId;
    }

    /**
     * Отправка сообщения
     */
    async send(message) {
        if (!this.isConfigured()) {
            console.warn('Telegram not configured');
            return false;
        }

        try {
            const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: this.config.chatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('Telegram send error:', error);
            return false;
        }
    }

    /**
     * Тестовая отправка
     */
    async test() {
        this.saveConfig();

        if (!this.isConfigured()) {
            showToast('Введите Bot Token и Chat ID', 'warning');
            return;
        }

        showToast('📤 Отправка тестового сообщения...', 'info');

        const projectName = store.getProjectName();
        const success = await this.send(
            `✅ <b>Gantt ULTRA PRO</b>\n\n` +
            `Проект: <b>${projectName}</b>\n` +
            `Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
            `Уведомления настроены успешно! 🎉`
        );

        if (success) {
            showToast('✅ Сообщение отправлено!', 'success');
        } else {
            showToast('❌ Ошибка отправки. Проверьте Token и Chat ID', 'error');
        }
    }

    /**
     * Проверка дедлайнов (автоматические уведомления)
     */
    checkDeadlines() {
        if (!this.isConfigured()) return;

        const now = new Date();
        const tasks = store.getAll();
        const alerts = [];

        tasks.forEach(task => {
            if (task.progress === 100) return; // Пропускаем завершенные

            const endTime = new Date(task.end);
            if (isNaN(endTime.getTime())) return;

            const diffHours = (endTime - now) / 3600000;

            // За 24 часа до дедлайна
            if (diffHours > 0 && diffHours <= 24) {
                alerts.push({
                    task: task,
                    type: 'deadline_soon',
                    hours: Math.round(diffHours)
                });
            }
            // Просрочено
            else if (diffHours < 0) {
                alerts.push({
                    task: task,
                    type: 'overdue',
                    hours: Math.round(Math.abs(diffHours))
                });
            }
        });

        // Отправляем уведомления
        alerts.forEach(alert => {
            if (alert.type === 'deadline_soon') {
                this.send(
                    `⚠️ <b>Дедлайн через ${alert.hours}ч</b>\n\n` +
                    `📋 ${alert.task.task}\n` +
                    `📦 Тип: ${alert.task.type || '-'}\n` +
                    `📊 Прогресс: ${alert.task.progress}%`
                );
            } else {
                this.send(
                    `🚨 <b>ПРОСРОЧЕНО на ${alert.hours}ч</b>\n\n` +
                    `📋 ${alert.task.task}\n` +
                    `📦 Тип: ${alert.task.type || '-'}\n` +
                    `📊 Прогресс: ${alert.task.progress}%`
                );
            }
        });

        return alerts.length;
    }

    /**
     * Запуск периодической проверки дедлайнов
     */
    startPeriodicCheck(intervalMinutes = 60) {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        // Первая проверка сразу
        this.checkDeadlines();

        // Периодическая проверка
        this.checkInterval = setInterval(() => {
            this.checkDeadlines();
        }, intervalMinutes * 60000);

        console.log(`Deadline notifications started (every ${intervalMinutes} min)`);
    }

    /**
     * Остановка периодической проверки
     */
    stopPeriodicCheck() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}

// Экспорт singleton
export const notifications = new Notifications();
