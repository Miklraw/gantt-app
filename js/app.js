/**
 * App - Главный модуль приложения
 * Инициализация, маршрутизация, связывание всех модулей
 */

import { store } from './store.js';
import { $, showToast, getTheme, applyTheme, toggleTheme, getBaseUrl, timeAgo, escapeHtml, formatDateTimeDisplay, parseDateTime } from './utils.js';
import { api } from './api.js';
import { Table } from './table.js';
import { Gantt } from './gantt.js';
import { exporter } from './export.js';
import { broadcast } from './broadcast.js';

class App {
    constructor() {
        this.table = new Table();
        this.gantt = new Gantt();
        this.currentTab = 'table';
        this.initialized = false;
    }

    /**
     * Инициализация приложения
     */
    async init() {
        console.log('🚀 Gantt ULTRA PRO initializing...');

        // Проверяем режим просмотра (shared view)
        if (api.isSharedView()) {
            await this.initSharedView();
            return;
        }

        // Проверяем авторизацию
        if (!store.isLoggedIn()) {
            this.showLogin();
            return;
        }

        // Инициализируем основное приложение
        await this.initMainApp();
    }

    /**
     * Инициализация режима просмотра
     */
    async initSharedView() {
        try {
            const binId = api.getSharedBinId();
            if (!binId) {
                showToast('Неверная ссылка', 'error');
                return;
            }

            const { data, projectName, lastUpdated } = await api.loadById(binId);
            this.renderSharedView(data, projectName, lastUpdated);
        } catch (error) {
            console.error('Shared view error:', error);
            showToast('Ошибка загрузки данных', 'error');
        }
    }

    /**
     * Отрисовка режима просмотра
     */
    renderSharedView(data, projectName, lastUpdated) {
        // Скрываем основной интерфейс
        const mainApp = $('mainApp');
        const loginScreen = $('loginScreen');
        if (mainApp) mainApp.style.display = 'none';
        if (loginScreen) loginScreen.classList.remove('active');

        // Показываем shared view
        const sharedView = $('sharedView');
        if (sharedView) sharedView.classList.add('active');

        // Заполняем заголовок
        const sharedTitle = $('sharedTitle');
        if (sharedTitle) sharedTitle.textContent = '📊 ' + projectName;

        const sharedDate = $('sharedDate');
        if (sharedDate) {
            const date = new Date(lastUpdated);
            sharedDate.innerHTML = `
                <span style="color:#5ef38c">✅ Актуально: ${timeAgo(date)}</span><br>
                <span style="font-size:14px;color:var(--muted)">Обновлено: ${date.toLocaleString('ru-RU')}</span>
            `;
        }

        // Заполняем таблицу
        const tbody = $('sharedTableBody');
        if (tbody) {
            // Сортируем по дате
            const sorted = [...data].sort((a, b) => {
                const dateA = parseDateTime(a.start) || 0;
                const dateB = parseDateTime(b.start) || 0;
                return dateA - dateB;
            });

            tbody.innerHTML = sorted.map(task => {
                const start = parseDateTime(task.start);
                const end = parseDateTime(task.end);
                
                const dateStr = start ? start.toLocaleDateString('ru-RU', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                }) : '-';
                
                const timeStr = start ? start.toLocaleTimeString('ru-RU', {
                    hour: '2-digit', minute: '2-digit'
                }) : '-';

                return `
                    <tr>
                        <td><strong>${dateStr}</strong></td>
                        <td>${timeStr}</td>
                        <td>${escapeHtml(task.type || '-')}</td>
                        <td>
                            <div style="font-weight:600">${escapeHtml(task.task || '')}</div>
                        </td>
                        <td>${escapeHtml(task.owner || '-')}</td>
                        <td>${task.progress || 0}%</td>
                    </tr>
                `;
            }).join('');
        }

        // Кнопка скачивания
        const downloadBtn = $('downloadSharedBtn');
        if (downloadBtn) {
            downloadBtn.onclick = () => this.downloadSharedTable();
        }

        // Кнопка стиля
        const styleBtn = $('toggleSharedStyleBtn');
        if (styleBtn) {
            styleBtn.onclick = () => {
                sharedView.classList.toggle('classic-mode');
                styleBtn.textContent = sharedView.classList.contains('classic-mode') ? '🎨 Цветной' : '🎨 Классика';
            };
        }
    }

    /**
     * Скачивание таблицы просмотра
     */
    async downloadSharedTable() {
        const container = document.querySelector('.shared-table-container');
        if (!container) return;

        showToast('📥 Подготовка изображения...', 'info');

        try {
            const canvas = await html2canvas(container, {
                backgroundColor: '#0b0d12',
                scale: 2
            });

            const link = document.createElement('a');
            link.download = 'расписание_' + new Date().toISOString().slice(0, 10) + '.png';
            link.href = canvas.toDataURL('image/png');
            link.click();

            showToast('✅ Скачано!', 'success');
        } catch (e) {
            console.error('Download error:', e);
            showToast('❌ Ошибка', 'error');
        }
    }

    /**
     * Показать экран входа
     */
    showLogin() {
        const loginScreen = $('loginScreen');
        if (loginScreen) loginScreen.classList.add('active');

        const loginBtn = $('loginBtn');
        if (loginBtn) {
            loginBtn.onclick = () => this.handleLogin();
        }

        const passwordInput = $('loginPassword');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleLogin();
            });
        }
    }

    /**
     * Обработка входа
     */
    async handleLogin() {
        const username = $('loginUsername')?.value?.trim();
        const password = $('loginPassword')?.value;
        const errorEl = $('loginError');

        if (!username || !password) {
            if (errorEl) errorEl.classList.add('show');
            return;
        }

        if (store.login(username, password)) {
            const loginScreen = $('loginScreen');
            if (loginScreen) loginScreen.classList.remove('active');
            await this.initMainApp();
        } else {
            if (errorEl) errorEl.classList.add('show');
        }
    }

    /**
     * Инициализация основного приложения
     */
    async initMainApp() {
        if (this.initialized) return;
        this.initialized = true;

        // Показываем основной интерфейс
        const mainApp = $('mainApp');
        if (mainApp) mainApp.style.display = 'flex';

        // Применяем тему
        applyTheme(getTheme());

        // Устанавливаем название проекта
        this.updateProjectName();

        // Инициализируем модули
        this.table.init();
        this.gantt.init();
        broadcast.init();

        // Загружаем данные из облака
        await this.loadFromCloud();

        // Привязываем события
        this.bindEvents();

        // Добавляем демо данные если пусто
        if (store.getAll().length === 0) {
            this.addDemoData();
        }

        // Подписываемся на изменения store
        store.subscribe((action, data) => {
            if (action === 'project-change') {
                this.updateProjectName();
            }
        });

        showToast('🚀 Добро пожаловать!', 'success', 3000);
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        // Табы
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Кнопки
        this.bindButton('addRowBtn', () => this.table.addTask(false));
        this.bindButton('addMilestoneBtn', () => this.table.addTask(true));
        this.bindButton('duplicateBtn', () => this.table.duplicateSelected());
        this.bindButton('undoBtn', () => this.handleUndo());
        this.bindButton('redoBtn', () => this.handleRedo());
        this.bindButton('themeToggleBtn', () => this.handleThemeToggle());
        this.bindButton('logoutBtn', () => this.handleLogout());
        this.bindButton('shareBtn', () => this.handleShare());
        this.bindButton('saveBtn', () => this.handleSave());
        this.bindButton('copyShareLinkBtn', () => this.copyShareLink());
        this.bindButton('closeShareModalBtn', () => this.closeShareModal());
        this.bindButton('exportExcelBtn', () => exporter.toExcel());
        this.bindButton('exportPdfBtn', () => exporter.toPDF());
        this.bindButton('exportJsonBtn', () => exporter.toJSON());
        this.bindButton('refreshBtn', () => this.loadFromCloud());
        this.bindButton('backToTableBtn', () => this.switchTab('table'));
        this.bindButton('saveProjectNameBtn', () => this.saveProjectName());
        this.bindButton('addTypeBtn', () => this.addType());

        // Чекбокс "Продолжать от последней работы"
        const continueCheck = $('continueFromLastCheck');
        if (continueCheck) {
            continueCheck.checked = store.getSetting('continueFromLast');
            continueCheck.addEventListener('change', (e) => {
                store.setSetting('continueFromLast', e.target.checked);
                showToast(e.target.checked ? '✅ Продолжение включено' : '❌ Продолжение выключено', 'info');
            });
        }

        // Чекбокс "Показывать прогресс"
        const progressCheck = $('showProgressCheck');
        if (progressCheck) {
            progressCheck.checked = store.getSetting('showProgress');
            progressCheck.addEventListener('change', (e) => {
                store.setSetting('showProgress', e.target.checked);
                this.table.updateColumnVisibility();
            });
        }

        // Чекбокс "Показывать приоритет"
        const priorityCheck = $('showPriorityCheck');
        if (priorityCheck) {
            priorityCheck.checked = store.getSetting('showPriority');
            priorityCheck.addEventListener('change', (e) => {
                store.setSetting('showPriority', e.target.checked);
                this.table.updateColumnVisibility();
            });
        }

        // Импорт JSON
        const importInput = $('importJsonInput');
        if (importInput) {
            importInput.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    exporter.fromJSON(e.target.files[0]);
                }
            });
        }
        this.bindButton('importJsonBtn', () => $('importJsonInput')?.click());

        // Горячие клавиши
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Отрисовка типов в настройках
        this.renderTypeSettings();
    }

    /**
     * Привязка кнопки
     */
    bindButton(id, handler) {
        const btn = $(id);
        if (btn) btn.addEventListener('click', handler);
    }

    /**
     * Переключение вкладки
     */
    switchTab(tab) {
        this.currentTab = tab;

        // Скрываем все вкладки
        document.querySelectorAll('[id^="tab-"]').forEach(el => {
            el.style.display = 'none';
        });

        // Показываем нужную
        const tabEl = $(`tab-${tab}`);
        if (tabEl) tabEl.style.display = 'block';

        // Обновляем кнопки
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Отрисовка
        if (tab === 'gantt') {
            setTimeout(() => this.gantt.render(), 100);
        }
    }

    /**
     * Загрузка из облака
     */
    async loadFromCloud() {
        const refreshBtn = $('refreshBtn');
        if (refreshBtn) {
            refreshBtn.textContent = '⏳ Загрузка...';
            refreshBtn.disabled = true;
        }

        try {
            const { data, projectName, lastUpdated } = await api.load();

            if (data && data.length > 0) {
                store.importData({ data, projectName });
                showToast(`📥 Загружено ${data.length} задач`, 'success');
            }
        } catch (error) {
            console.error('Load from cloud error:', error);
            showToast('⚠️ Не удалось загрузить из облака', 'warning');
        } finally {
            if (refreshBtn) {
                refreshBtn.textContent = '🔄 Обновить';
                refreshBtn.disabled = false;
            }
        }
    }

    /**
     * Сохранение в облако
     */
    async saveToCloud() {
        try {
            await api.save(store.getAll(), store.getProjectName());
            return true;
        } catch (error) {
            console.error('Save to cloud error:', error);
            return false;
        }
    }

    /**
     * Обработка сохранения (кнопка Сохранить)
     */
    async handleSave() {
        const saveBtn = $('saveBtn');
        if (saveBtn) {
            saveBtn.textContent = '⏳ Сохранение...';
            saveBtn.disabled = true;
        }

        const success = await this.saveToCloud();

        if (saveBtn) {
            saveBtn.textContent = '💾 Сохранить';
            saveBtn.disabled = false;
        }

        if (success) {
            showToast('✅ Сохранено в облако!', 'success');
        } else {
            showToast('❌ Ошибка сохранения', 'error');
        }
    }

    /**
     * Поделиться
     */
    async handleShare() {
        // Сначала сохраняем в облако
        const saved = await this.saveToCloud();
        if (!saved) {
            showToast('❌ Ошибка сохранения', 'error');
            return;
        }

        // Показываем ссылку
        const linkInput = $('shareLinkInput');
        if (linkInput) {
            linkInput.value = api.createShareLink();
        }

        const modal = $('shareModal');
        if (modal) modal.classList.add('active');

        // Автокопирование
        this.copyShareLink();
    }

    /**
     * Копировать ссылку
     */
    copyShareLink() {
        const linkInput = $('shareLinkInput');
        if (!linkInput) return;

        linkInput.select();
        document.execCommand('copy');
        showToast('📋 Ссылка скопирована!', 'success');
    }

    /**
     * Закрыть модал шаринга
     */
    closeShareModal() {
        const modal = $('shareModal');
        if (modal) modal.classList.remove('active');
    }

    /**
     * Обработка Undo
     */
    handleUndo() {
        if (store.undo()) {
            showToast('↶ Отменено', 'info');
        } else {
            showToast('Нет действий для отмены', 'warning');
        }
        this.updateHistoryButtons();
    }

    /**
     * Обработка Redo
     */
    handleRedo() {
        if (store.redo()) {
            showToast('↷ Повторено', 'info');
        } else {
            showToast('Нет действий для повтора', 'warning');
        }
        this.updateHistoryButtons();
    }

    /**
     * Обновление кнопок истории
     */
    updateHistoryButtons() {
        const undoBtn = $('undoBtn');
        const redoBtn = $('redoBtn');

        if (undoBtn) undoBtn.disabled = !store.canUndo();
        if (redoBtn) redoBtn.disabled = !store.canRedo();
    }

    /**
     * Переключение темы
     */
    handleThemeToggle() {
        const newTheme = toggleTheme();
        showToast(newTheme === 'light' ? '☀️ Светлая тема' : '🌙 Темная тема', 'info');
    }

    /**
     * Выход
     */
    handleLogout() {
        if (confirm('Выйти из системы?')) {
            store.logout();
            location.reload();
        }
    }

    /**
     * Обработка клавиатуры
     */
    handleKeyboard(e) {
        // Пропускаем ввод в поля
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        // Ctrl+S - сохранить
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.saveToCloud();
            showToast('💾 Сохранено в облако', 'success');
        }

        // Ctrl+Z - отменить
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            this.handleUndo();
        }

        // Ctrl+Y - повторить
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.handleRedo();
        }

        // Ctrl+N - новая задача
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            this.table.addTask(false);
        }

        // Escape - закрыть модалы
        if (e.key === 'Escape') {
            this.closeShareModal();
        }

        // 1-4 - переключение вкладок
        if (!e.ctrlKey && !e.altKey) {
            const tabs = { '1': 'table', '2': 'gantt', '3': 'broadcast', '4': 'settings' };
            if (tabs[e.key]) {
                this.switchTab(tabs[e.key]);
            }
        }
    }

    /**
     * Обновление названия проекта
     */
    updateProjectName() {
        const title = $('projectTitle');
        if (title) title.textContent = '🚀 ' + store.getProjectName();

        const input = $('projectNameInput');
        if (input) input.value = store.getProjectName();
    }

    /**
     * Сохранение названия проекта
     */
    saveProjectName() {
        const input = $('projectNameInput');
        if (input) {
            store.setProjectName(input.value.trim() || 'Мой проект');
            showToast('📁 Название сохранено', 'success');
        }
    }

    /**
     * Отрисовка настроек типов
     */
    renderTypeSettings() {
        const typeList = $('typeList');
        if (!typeList) return;

        const types = store.getTypes();
        typeList.innerHTML = '';

        Object.entries(types).forEach(([name, typeInfo]) => {
            const color = typeInfo.color || '#5da7ff';
            const defaultText = typeInfo.defaultText || '';
            
            const item = document.createElement('div');
            item.className = 'type-item type-item-row';
            item.innerHTML = `
                <input type="text" value="${escapeHtml(name)}" data-old="${escapeHtml(name)}" class="type-name-input" placeholder="Название">
                <input type="text" value="${escapeHtml(defaultText)}" data-field="defaultText" class="type-default-input" placeholder="Текст по умолчанию">
                <input type="color" value="${color}" class="type-color-input">
                <button class="btn ghost delete-type-btn type-delete-btn">✕</button>
            `;

            // Удаление
            item.querySelector('.delete-type-btn').onclick = () => {
                if (confirm(`Удалить тип "${name}"?`)) {
                    store.deleteType(name);
                    this.renderTypeSettings();
                }
            };

            // Изменение цвета
            item.querySelector('input[type="color"]').onchange = (e) => {
                const nameInput = item.querySelector('.type-name-input');
                const defaultTextInput = item.querySelector('[data-field="defaultText"]');
                store.updateType(nameInput.dataset.old, nameInput.value, e.target.value, defaultTextInput.value);
                nameInput.dataset.old = nameInput.value;
            };

            // Изменение названия
            item.querySelector('.type-name-input').onchange = (e) => {
                const colorInput = item.querySelector('input[type="color"]');
                const defaultTextInput = item.querySelector('[data-field="defaultText"]');
                store.updateType(e.target.dataset.old, e.target.value, colorInput.value, defaultTextInput.value);
                e.target.dataset.old = e.target.value;
            };

            // Изменение текста по умолчанию
            item.querySelector('[data-field="defaultText"]').onchange = (e) => {
                const nameInput = item.querySelector('.type-name-input');
                const colorInput = item.querySelector('input[type="color"]');
                store.updateType(nameInput.dataset.old, nameInput.value, colorInput.value, e.target.value);
            };

            typeList.appendChild(item);
        });
    }

    /**
     * Добавить тип
     */
    addType() {
        const name = prompt('Название нового типа:');
        if (name && name.trim()) {
            store.addType(name.trim(), '#5da7ff', '');
            this.renderTypeSettings();
            showToast(`Тип "${name}" добавлен`, 'success');
        }
    }

    /**
     * Добавление демо данных
     */
    addDemoData() {
        const now = new Date();

        store.add({
            type: 'Транспорт',
            task: 'Доставка оборудования',
            start: now.toISOString().slice(0, 16),
            end: new Date(now.getTime() + 7200000).toISOString().slice(0, 16),
            progress: 100,
            priority: 'high',
            owner: 'Иванов'
        });

        store.add({
            type: 'Монтаж',
            task: 'Установка сцены',
            start: new Date(now.getTime() + 7200000).toISOString().slice(0, 16),
            end: new Date(now.getTime() + 18000000).toISOString().slice(0, 16),
            progress: 60,
            priority: 'medium',
            dependencies: ['1'],
            owner: 'Петров'
        });

        store.add({
            type: 'Репетиция',
            task: 'Техническая репетиция',
            start: new Date(now.getTime() + 18000000).toISOString().slice(0, 16),
            end: new Date(now.getTime() + 25200000).toISOString().slice(0, 16),
            progress: 20,
            priority: 'high',
            dependencies: ['2'],
            owner: 'Сидоров'
        });

        store.add({
            type: 'Веха',
            task: 'Начало мероприятия',
            milestone: true,
            start: new Date(now.getTime() + 28800000).toISOString().slice(0, 16),
            end: new Date(now.getTime() + 28800000).toISOString().slice(0, 16),
            progress: 0,
            priority: 'high'
        });

        showToast('📋 Демо данные добавлены', 'info');
    }
}

// Запуск приложения
const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
