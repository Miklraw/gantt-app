/**
 * Broadcast - Модуль для работы с Telegram ботом и рассылками
 * Управляет подписчиками, отправкой сообщений и настройками бота
 */

import { store } from './store.js';
import { $, showToast, escapeHtml } from './utils.js';

class Broadcast {
    constructor() {
        this.config = this.loadConfig();
        this.initialized = false;
    }

    /**
     * Загрузка конфигурации
     */
    loadConfig() {
        try {
            const saved = localStorage.getItem('telegram_config');
            return saved ? JSON.parse(saved) : {
                botToken: '',
                chatId: ''
            };
        } catch {
            return { botToken: '', chatId: '' };
        }
    }

    /**
     * Сохранение конфигурации
     */
    saveConfig() {
        localStorage.setItem('telegram_config', JSON.stringify(this.config));
    }

    /**
     * Инициализация модуля
     */
    init() {
        if (this.initialized) return;
        this.initialized = true;

        this.bindEvents();
        this.loadConfigToUI();
        this.renderSubscribers();

        // Подписка на изменения списка подписчиков
        store.subscribe((action, data) => {
            if (action === 'subscribers-change') {
                this.renderSubscribers();
            }
        });
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        // Добавление подписчика
        const addBtn = $('addSubscriberBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addSubscriber());
        }

        // Enter в полях добавления
        const nameInput = $('newSubscriberName');
        const chatIdInput = $('newSubscriberChatId');
        
        if (nameInput) {
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addSubscriber();
            });
        }
        if (chatIdInput) {
            chatIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addSubscriber();
            });
        }

        // Кнопка "Разослать всем"
        const sendBtn = $('sendToAllBtn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendBroadcast());
        }

        // Тест бота
        const testBtn = $('testTelegramBroadcastBtn');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testConnection());
        }

        // Быстрые сообщения
        document.querySelectorAll('.quick-msg').forEach(btn => {
            btn.addEventListener('click', () => this.insertQuickMessage(btn.dataset.msg));
        });

        // Синхронизация полей токена между вкладками
        this.syncTokenFields();
    }

    /**
     * Синхронизация полей токена
     */
    syncTokenFields() {
        const tokenBroadcast = $('telegramTokenBroadcast');
        const tokenSettings = $('telegramToken');
        const chatIdBroadcast = $('telegramChatIdBroadcast');
        const chatIdSettings = $('telegramChatId');

        if (tokenBroadcast && tokenSettings) {
            tokenBroadcast.value = this.config.botToken || '';
            tokenBroadcast.addEventListener('input', () => {
                this.config.botToken = tokenBroadcast.value;
                tokenSettings.value = tokenBroadcast.value;
                this.saveConfig();
            });
        }

        if (chatIdBroadcast && chatIdSettings) {
            chatIdBroadcast.value = this.config.chatId || '';
            chatIdBroadcast.addEventListener('input', () => {
                this.config.chatId = chatIdBroadcast.value;
                chatIdSettings.value = chatIdBroadcast.value;
                this.saveConfig();
            });
        }

        // Синхронизация из настроек
        if (tokenSettings) {
            tokenSettings.value = this.config.botToken || '';
            tokenSettings.addEventListener('input', () => {
                this.config.botToken = tokenSettings.value;
                if (tokenBroadcast) tokenBroadcast.value = tokenSettings.value;
                this.saveConfig();
            });
        }

        if (chatIdSettings) {
            chatIdSettings.value = this.config.chatId || '';
            chatIdSettings.addEventListener('input', () => {
                this.config.chatId = chatIdSettings.value;
                if (chatIdBroadcast) chatIdBroadcast.value = chatIdSettings.value;
                this.saveConfig();
            });
        }
    }

    /**
     * Загрузка конфигурации в UI
     */
    loadConfigToUI() {
        const tokenBroadcast = $('telegramTokenBroadcast');
        const tokenSettings = $('telegramToken');
        const chatIdBroadcast = $('telegramChatIdBroadcast');
        const chatIdSettings = $('telegramChatId');

        if (tokenBroadcast) tokenBroadcast.value = this.config.botToken || '';
        if (tokenSettings) tokenSettings.value = this.config.botToken || '';
        if (chatIdBroadcast) chatIdBroadcast.value = this.config.chatId || '';
        if (chatIdSettings) chatIdSettings.value = this.config.chatId || '';
    }

    /**
     * Проверка настроен ли бот
     */
    isConfigured() {
        return this.config.botToken !== '';
    }

    /**
     * Отправка сообщения конкретному chatId
     */
    async sendTo(chatId, message) {
        if (!this.config.botToken) {
            console.warn('Telegram bot token not configured');
            return false;
        }

        try {
            const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
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
     * Отправка сообщения (основной chatId)
     */
    async send(message) {
        if (!this.isConfigured() || !this.config.chatId) {
            console.warn('Telegram not configured');
            return false;
        }
        return await this.sendTo(this.config.chatId, message);
    }

    /**
     * Массовая рассылка всем подписчикам
     */
    async sendToAll(message) {
        const subscribers = store.getTelegramSubscribers();
        
        if (subscribers.length === 0) {
            showToast('Нет подписчиков для рассылки', 'warning');
            return { success: 0, failed: 0 };
        }

        if (!this.config.botToken) {
            showToast('Не указан Bot Token', 'error');
            return { success: 0, failed: subscribers.length };
        }

        showToast(`📤 Рассылка ${subscribers.length} подписчикам...`, 'info');

        let success = 0;
        let failed = 0;

        for (const subscriber of subscribers) {
            const result = await this.sendTo(subscriber.chatId, message);
            if (result) {
                success++;
            } else {
                failed++;
            }
            // Небольшая пауза между отправками
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (success > 0 && failed === 0) {
            showToast(`✅ Отправлено всем ${success} подписчикам!`, 'success');
        } else if (success > 0) {
            showToast(`✅ Отправлено: ${success}, ❌ Ошибок: ${failed}`, 'warning');
        } else {
            showToast('❌ Не удалось отправить сообщения', 'error');
        }

        return { success, failed };
    }

    /**
     * Тестовое подключение
     */
    async testConnection() {
        // Сохраняем текущие значения
        const tokenInput = $('telegramTokenBroadcast') || $('telegramToken');
        const chatIdInput = $('telegramChatIdBroadcast') || $('telegramChatId');

        if (tokenInput) this.config.botToken = tokenInput.value?.trim() || '';
        if (chatIdInput) this.config.chatId = chatIdInput.value?.trim() || '';
        this.saveConfig();

        if (!this.config.botToken || !this.config.chatId) {
            showToast('Введите Bot Token и Chat ID', 'warning');
            return false;
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

        return success;
    }

    // ===== ПОДПИСЧИКИ =====

    /**
     * Добавление подписчика
     */
    addSubscriber() {
        const nameInput = $('newSubscriberName');
        const chatIdInput = $('newSubscriberChatId');

        const name = nameInput?.value?.trim();
        const chatId = chatIdInput?.value?.trim();

        if (!name || !chatId) {
            showToast('Введите имя и Chat ID', 'warning');
            return;
        }

        if (store.addTelegramSubscriber(name, chatId)) {
            nameInput.value = '';
            chatIdInput.value = '';
            showToast(`✅ ${name} добавлен в рассылку`, 'success');
        } else {
            showToast('Такой Chat ID уже есть', 'warning');
        }
    }

    /**
     * Удаление подписчика
     */
    removeSubscriber(id) {
        if (store.removeTelegramSubscriber(id)) {
            showToast('Подписчик удален', 'info');
        }
    }

    /**
     * Отрисовка списка подписчиков
     */
    renderSubscribers() {
        const list = $('subscribersList');
        const countEl = $('broadcastCount');
        if (!list) return;

        const subscribers = store.getTelegramSubscribers();

        if (countEl) {
            countEl.textContent = `Подписчиков: ${subscribers.length}`;
        }

        if (subscribers.length === 0) {
            list.innerHTML = '<div class="note" style="text-align:center;padding:20px">Нет подписчиков.<br>Добавьте имя и Chat ID выше.</div>';
            return;
        }

        list.innerHTML = subscribers.map(s => `
            <div class="subscriber-item">
                <div class="subscriber-info">
                    <div class="subscriber-name">${escapeHtml(s.name)}</div>
                    <div class="subscriber-chat-id">${escapeHtml(s.chatId)}</div>
                </div>
                <button class="subscriber-delete" data-id="${s.id}">✕</button>
            </div>
        `).join('');

        // Привязка удаления
        list.querySelectorAll('.subscriber-delete').forEach(btn => {
            btn.onclick = () => this.removeSubscriber(parseInt(btn.dataset.id));
        });
    }

    // ===== РАССЫЛКА =====

    /**
     * Отправка сообщения всем подписчикам
     */
    async sendBroadcast() {
        const subjectInput = $('broadcastSubject');
        const messageInput = $('broadcastMessage');

        const subject = subjectInput?.value?.trim();
        const message = messageInput?.value?.trim();

        if (!message) {
            showToast('Введите текст сообщения', 'warning');
            return;
        }

        const subscribers = store.getTelegramSubscribers();
        if (subscribers.length === 0) {
            showToast('Нет подписчиков для рассылки', 'warning');
            return;
        }

        // Формируем сообщение
        const fullMessage = subject 
            ? `📢 <b>${escapeHtml(subject)}</b>\n\n${escapeHtml(message)}`
            : escapeHtml(message);

        await this.sendToAll(fullMessage);
    }

    /**
     * Вставка быстрого сообщения
     */
    insertQuickMessage(type) {
        const subjectInput = $('broadcastSubject');
        const messageInput = $('broadcastMessage');

        const messages = {
            summary: {
                subject: '📊 Сводка по проекту',
                message: this.generateProjectSummary()
            },
            reminder: {
                subject: '⏰ Напоминание',
                message: 'Пожалуйста, проверьте статус ваших задач и обновите прогресс.'
            },
            urgent: {
                subject: '🚨 СРОЧНО',
                message: 'Требуется немедленное внимание! Проверьте задачи с высоким приоритетом.'
            }
        };

        const msg = messages[type];
        if (msg) {
            if (subjectInput) subjectInput.value = msg.subject;
            if (messageInput) messageInput.value = msg.message;
        }
    }

    /**
     * Генерация сводки по проекту
     */
    generateProjectSummary() {
        const tasks = store.getAll();
        const total = tasks.length;
        const completed = tasks.filter(t => t.progress === 100).length;
        const inProgress = tasks.filter(t => t.progress > 0 && t.progress < 100).length;
        const notStarted = tasks.filter(t => t.progress === 0).length;
        const projectName = store.getProjectName();

        return `Проект: ${projectName}

📋 Всего задач: ${total}
✅ Завершено: ${completed}
🔄 В работе: ${inProgress}
⏳ Не начато: ${notStarted}

📅 Обновлено: ${new Date().toLocaleString('ru-RU')}`;
    }

    // ===== УВЕДОМЛЕНИЯ О СОБЫТИЯХ =====

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
}

// Экспорт singleton
export const broadcast = new Broadcast();
