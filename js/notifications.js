/**
 * Notifications - Модуль для отправки уведомлений в Telegram
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
     * Инициализация
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
     * Проверка дедлайнов
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
     * Запуск периодической проверки
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

        console.log(`Telegram notifications started (every ${intervalMinutes} min)`);
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

    /**
     * Отправка сводки по проекту
     */
    async sendProjectSummary() {
        if (!this.isConfigured()) return false;

        const tasks = store.getAll();
        const projectName = store.getProjectName();

        const total = tasks.length;
        const completed = tasks.filter(t => t.progress === 100).length;
        const inProgress = tasks.filter(t => t.progress > 0 && t.progress < 100).length;
        const notStarted = tasks.filter(t => t.progress === 0).length;
        const avgProgress = total > 0 
            ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / total) 
            : 0;

        const criticalCount = tasks.filter(t => store.isCritical(t.id)).length;

        return await this.send(
            `📊 <b>Сводка по проекту</b>\n\n` +
            `<b>${projectName}</b>\n\n` +
            `📋 Всего задач: ${total}\n` +
            `✅ Завершено: ${completed}\n` +
            `🔄 В работе: ${inProgress}\n` +
            `⏳ Не начато: ${notStarted}\n` +
            `🔥 Критических: ${criticalCount}\n\n` +
            `📈 Средний прогресс: ${avgProgress}%\n\n` +
            `_Обновлено: ${new Date().toLocaleString('ru-RU')}_`
        );
    }

    /**
     * Уведомление о новой задаче
     */
    async notifyNewTask(task) {
        if (!this.isConfigured()) return false;

        return await this.send(
            `➕ <b>Новая задача</b>\n\n` +
            `📋 ${task.task}\n` +
            `📦 Тип: ${task.type || '-'}\n` +
            `📅 Начало: ${new Date(task.start).toLocaleString('ru-RU')}\n` +
            `📅 Конец: ${new Date(task.end).toLocaleString('ru-RU')}\n` +
            `👤 Ответственный: ${task.owner || '-'}`
        );
    }

    /**
     * Уведомление о завершении задачи
     */
    async notifyTaskCompleted(task) {
        if (!this.isConfigured()) return false;

        return await this.send(
            `✅ <b>Задача завершена!</b>\n\n` +
            `📋 ${task.task}\n` +
            `📦 Тип: ${task.type || '-'}\n` +
            `👤 Ответственный: ${task.owner || '-'}`
        );
    }
}

// Экспорт singleton
export const notifications = new Notifications();
