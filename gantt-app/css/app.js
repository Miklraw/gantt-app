import { store } from './store.js';
import { Notifier } from './notifications.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Приложение запущено на сервере");
    Notifier.checkDeadlines();
    // Тут вызов функций отрисовки Gantt.render() и т.д.
});