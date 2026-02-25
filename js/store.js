/**
 * Store - Центральное хранилище данных
 * Управляет состоянием приложения, историей изменений и уведомлениями
 */

// Типы работ по умолчанию
const DEFAULT_TYPES = {
    'Транспорт': '#5da7ff',
    'Разгрузка': '#90be6d',
    'Погрузка': '#80ffea',
    'Монтаж': '#ffd166',
    'Демонтаж': '#ff6b6b',
    'Пуско-наладка': '#f9c74f',
    'Уборка': '#bdb2ff',
    'Репетиция': '#a0c4ff',
    'Веха': '#d56cff'
};

// Пользователи для авторизации
const USERS = [
    { username: 'admin', password: 'admin123', name: 'Администратор' },
    { username: 'manager', password: 'manager123', name: 'Менеджер' },
    { username: 'user', password: 'user123', name: 'Пользователь' }
];

class Store {
    constructor() {
        // Основные данные
        this.data = [];
        this.nextId = 1;
        
        // Типы работ
        this.types = this.loadTypes();
        
        // История изменений
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        
        // Критический путь
        this.criticalTasks = new Set();
        
        // Текущий пользователь
        this.currentUser = this.loadSession();
        
        // Настройки проекта
        this.projectName = localStorage.getItem('gantt_project_name') || 'Мой проект';
        
        // Подписчики на изменения
        this.subscribers = [];
    }

    // ===== ЗАГРУЗКА ДАННЫХ =====
    
    loadTypes() {
        try {
            const saved = localStorage.getItem('gantt_types');
            return saved ? JSON.parse(saved) : { ...DEFAULT_TYPES };
        } catch {
            return { ...DEFAULT_TYPES };
        }
    }

    loadSession() {
        try {
            const session = localStorage.getItem('gantt_session');
            return session ? JSON.parse(session) : null;
        } catch {
            return null;
        }
    }

    // ===== АВТОРИЗАЦИЯ =====
    
    login(username, password) {
        const user = USERS.find(u => u.username === username && u.password === password);
        if (user) {
            this.currentUser = { username: user.username, name: user.name };
            localStorage.setItem('gantt_session', JSON.stringify(this.currentUser));
            return true;
        }
        return false;
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('gantt_session');
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    // ===== ДАННЫЕ =====
    
    // Получить все задачи
    getAll() {
        return [...this.data];
    }

    // Получить задачу по ID
    getById(id) {
        return this.data.find(t => t.id === id);
    }

    // Добавить задачу
    add(task) {
        const newTask = {
            id: this.nextId++,
            type: task.type || '',
            task: task.task || 'Новая работа',
            start: task.start || new Date().toISOString().slice(0, 16),
            end: task.end || new Date(Date.now() + 3600000).toISOString().slice(0, 16),
            progress: task.progress || 0,
            priority: task.priority || 'medium',
            milestone: task.milestone || false,
            owner: task.owner || '',
            dependencies: task.dependencies || [],
            color: task.color || this.types[task.type] || '#5da7ff'
        };
        this.data.push(newTask);
        this.saveState('Добавление работы');
        this.notify('add', newTask);
        return newTask;
    }

    // Обновить задачу
    update(id, fields) {
        const task = this.getById(id);
        if (task) {
            Object.assign(task, fields);
            if (fields.type && !fields.color) {
                task.color = this.types[fields.type] || task.color;
            }
            this.saveState('Обновление работы');
            this.notify('update', task);
            return task;
        }
        return null;
    }

    // Удалить задачу
    delete(id) {
        const index = this.data.findIndex(t => t.id === id);
        if (index !== -1) {
            const deleted = this.data.splice(index, 1)[0];
            this.criticalTasks.delete(id);
            this.saveState('Удаление работы');
            this.notify('delete', deleted);
            return deleted;
        }
        return null;
    }

    // Дублировать задачу
    duplicate(id) {
        const task = this.getById(id);
        if (task) {
            const newTask = { ...task, task: task.task + ' (копия)' };
            delete newTask.id;
            return this.add(newTask);
        }
        return null;
    }

    // ===== ФИЛЬТРАЦИЯ =====
    
    filter(options = {}) {
        let result = [...this.data];
        
        if (options.search) {
            const search = options.search.toLowerCase();
            result = result.filter(t => 
                t.task.toLowerCase().includes(search) ||
                t.type.toLowerCase().includes(search)
            );
        }
        
        if (options.type) {
            result = result.filter(t => t.type === options.type);
        }
        
        if (options.priority) {
            result = result.filter(t => t.priority === options.priority);
        }
        
        if (options.criticalOnly) {
            result = result.filter(t => this.criticalTasks.has(t.id));
        }
        
        return result;
    }

    // ===== ИСТОРИЯ =====
    
    saveState(description = '') {
        const state = {
            data: JSON.parse(JSON.stringify(this.data)),
            nextId: this.nextId,
            criticalTasks: Array.from(this.criticalTasks)
        };
        
        // Удаляем будущие состояния если были undo
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        this.history.push({ state, description, timestamp: Date.now() });
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
        
        this.notify('history-change');
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex].state);
            this.notify('undo');
            return true;
        }
        return false;
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex].state);
            this.notify('redo');
            return true;
        }
        return false;
    }

    restoreState(state) {
        this.data = JSON.parse(JSON.stringify(state.data));
        this.nextId = state.nextId;
        this.criticalTasks = new Set(state.criticalTasks || []);
    }

    canUndo() {
        return this.historyIndex > 0;
    }

    canRedo() {
        return this.historyIndex < this.history.length - 1;
    }

    // ===== ТИПЫ РАБОТ =====
    
    getTypes() {
        return { ...this.types };
    }

    addType(name, color = '#5da7ff') {
        this.types[name] = color;
        localStorage.setItem('gantt_types', JSON.stringify(this.types));
        this.notify('types-change');
    }

    updateType(oldName, newName, color) {
        if (oldName !== newName) {
            delete this.types[oldName];
            // Обновляем задачи с этим типом
            this.data.forEach(t => {
                if (t.type === oldName) {
                    t.type = newName;
                    t.color = color;
                }
            });
        }
        this.types[newName] = color;
        localStorage.setItem('gantt_types', JSON.stringify(this.types));
        this.notify('types-change');
    }

    deleteType(name) {
        delete this.types[name];
        localStorage.setItem('gantt_types', JSON.stringify(this.types));
        this.notify('types-change');
    }

    // ===== КРИТИЧЕСКИЙ ПУТЬ =====
    
    calculateCriticalPath() {
        // Простая реализация - задачи с высоким приоритетом и зависимостями
        this.criticalTasks.clear();
        
        // Находим задачи с высоким приоритетом
        this.data.forEach(task => {
            if (task.priority === 'high') {
                this.criticalTasks.add(task.id);
            }
        });
        
        // Находим задачи от которых зависят другие
        this.data.forEach(task => {
            if (task.dependencies && task.dependencies.length > 0) {
                task.dependencies.forEach(depId => {
                    const depTask = this.getById(parseInt(depId));
                    if (depTask) {
                        this.criticalTasks.add(depTask.id);
                    }
                });
            }
        });
        
        // Не вызываем notify здесь, чтобы избежать бесконечного цикла
        return Array.from(this.criticalTasks);
    }

    isCritical(id) {
        return this.criticalTasks.has(id);
    }

    toggleCritical(id) {
        if (this.criticalTasks.has(id)) {
            this.criticalTasks.delete(id);
        } else {
            this.criticalTasks.add(id);
        }
        // Не уведомляем, чтобы избежать циклов
    }

    // ===== ПРОЕКТ =====
    
    setProjectName(name) {
        this.projectName = name;
        localStorage.setItem('gantt_project_name', name);
        this.notify('project-change');
    }

    getProjectName() {
        return this.projectName;
    }

    // ===== ПОДПИСКИ =====
    
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    notify(action, data) {
        this.subscribers.forEach(cb => cb(action, data));
    }

    // ===== ИМПОРТ/ЭКСПОРТ =====
    
    exportData() {
        return {
            projectName: this.projectName,
            data: this.data,
            types: this.types,
            exportedAt: new Date().toISOString()
        };
    }

    importData(json) {
        try {
            const imported = typeof json === 'string' ? JSON.parse(json) : json;
            
            if (imported.projectName) {
                this.projectName = imported.projectName;
            }
            
            if (imported.types) {
                this.types = { ...DEFAULT_TYPES, ...imported.types };
                localStorage.setItem('gantt_types', JSON.stringify(this.types));
            }
            
            if (Array.isArray(imported.data)) {
                this.data = imported.data;
                this.nextId = Math.max(...this.data.map(t => t.id), 0) + 1;
            } else if (Array.isArray(imported)) {
                // Старый формат - просто массив
                this.data = imported;
                this.nextId = Math.max(...this.data.map(t => t.id), 0) + 1;
            }
            
            this.history = [];
            this.historyIndex = -1;
            this.saveState('Импорт данных');
            this.notify('import');
            return true;
        } catch (e) {
            console.error('Import error:', e);
            return false;
        }
    }
}

// Экспортируем singleton instance
export const store = new Store();
export { DEFAULT_TYPES, USERS };
