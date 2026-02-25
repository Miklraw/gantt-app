import { store } from './store.js';

export const Notifier = {
    botToken: 'ТВОЙ_ТОКЕН_ОТ_BOTFATHER',
    chatId: 'ТВОЙ_CHAT_ID',

    async send(message) {
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: this.chatId, text: message, parse_mode: 'HTML' })
        });
    },

    checkDeadlines() {
        const now = new Date();
        store.data.forEach(task => {
            const end = new Date(task.end);
            if ((end - now) < 86400000 && task.progress < 100) {
                this.send(`⚠️ Дедлайн по задаче: <b>${task.task}</b>`);
            }
        });
    }
};