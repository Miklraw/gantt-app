/**
 * Table - Модуль для работы с таблицей задач
 */

import { store } from './store.js';
import { $, escapeHtml, formatDateTime, parseDateTime, calcDuration, formatDuration, showToast, debounce } from './utils.js';

export class Table {
    constructor() {
        this.tbody = $('taskTableBody');
        this.selectedRow = null;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        
        // Фильтры
        this.filters = {
            search: '',
            type: '',
            priority: ''
        };
    }

    /**
     * Инициализация таблицы
     */
    init() {
        this.bindEvents();
        this.render();
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        // Сортировка
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.sort(th.dataset.sort));
        });

        // Фильтры
        const searchInput = $('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                this.filters.search = e.target.value;
                this.render();
            }, 300));
        }

        const filterType = $('filterType');
        if (filterType) {
            filterType.addEventListener('change', (e) => {
                this.filters.type = e.target.value;
                this.render();
            });
        }

        const filterPriority = $('filterPriority');
        if (filterPriority) {
            filterPriority.addEventListener('change', (e) => {
                this.filters.priority = e.target.value;
                this.render();
            });
        }

        const clearFiltersBtn = $('clearFiltersBtn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        }

        // Подписка на изменения store
        store.subscribe((action, data) => {
            if (['add', 'update', 'delete', 'import', 'undo', 'redo'].includes(action)) {
                this.render();
            }
        });
    }

    /**
     * Отрисовка таблицы
     */
    render() {
        if (!this.tbody) return;

        // Получаем отфильтрованные данные
        let data = store.filter(this.filters);

        // Сортировка
        if (this.sortColumn) {
            data = this.sortData(data, this.sortColumn, this.sortDirection);
        }

        // Очищаем таблицу
        this.tbody.innerHTML = '';

        // Отрисовываем строки
        data.forEach(task => {
            const row = this.createRow(task);
            this.tbody.appendChild(row);
        });

        // Обновляем счетчик
        this.updateCount(data.length);

        // Обновляем фильтр типов
        this.updateTypeFilter();
    }

    /**
     * Создание строки таблицы
     */
    createRow(task) {
        const tr = document.createElement('tr');
        tr.dataset.id = task.id;
        
        if (store.isCritical(task.id)) {
            tr.classList.add('critical');
        }
        if (this.selectedRow === task.id) {
            tr.classList.add('selected');
        }

        // Вычисляем длительность
        const duration = calcDuration(task.start, task.end);

        // Генерируем options для типов
        const types = store.getTypes();
        const typeOptions = Object.keys(types).map(typeName => 
            `<option value="${escapeHtml(typeName)}" ${task.type === typeName ? 'selected' : ''}>${escapeHtml(typeName)}</option>`
        ).join('');

        tr.innerHTML = `
            <td>${task.id}</td>
            <td>
                <select class="type-select" data-field="type" style="width:100%">
                    <option value="">-- выберите --</option>
                    ${typeOptions}
                </select>
            </td>
            <td>
                <input type="text" value="${escapeHtml(task.task)}" 
                    class="task-input" data-field="task"
                    placeholder="Название работы" style="width:100%">
            </td>
            <td>
                <input type="datetime-local" value="${formatDateTime(task.start)}" 
                    data-field="start" style="width:100%">
            </td>
            <td>
                <input type="datetime-local" value="${formatDateTime(task.end)}" 
                    data-field="end" style="width:100%">
            </td>
            <td>
                <div class="progress-cell">
                    <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width:${task.progress}%"></div>
                    </div>
                    <input type="number" min="0" max="100" value="${task.progress}" 
                        class="progress-input" data-field="progress">
                </div>
            </td>
            <td>
                <select class="priority-select priority-${task.priority}" data-field="priority">
                    <option value="high" ${task.priority === 'high' ? 'selected' : ''}>🔴</option>
                    <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>🟡</option>
                    <option value="low" ${task.priority === 'low' ? 'selected' : ''}>🔵</option>
                </select>
            </td>
            <td>
                <input type="text" value="${escapeHtml(task.owner || '')}" 
                    data-field="owner" placeholder="Имя" style="width:100%">
            </td>
            <td>
                <button class="btn ghost delete-btn" data-id="${task.id}" 
                    style="padding:4px 8px">✕</button>
            </td>
        `;

        // Привязываем события
        tr.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON') {
                return;
            }
            this.selectRow(task.id);
        });

        // События на поля
        tr.querySelectorAll('input, select').forEach(input => {
            const field = input.dataset.field;
            
            if (field === 'progress') {
                input.addEventListener('input', (e) => {
                    const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                    const fill = tr.querySelector('.progress-bar-fill');
                    if (fill) fill.style.width = value + '%';
                });
            }

            if (field === 'priority') {
                input.addEventListener('change', (e) => {
                    input.className = `priority-select priority-${e.target.value}`;
                });
            }

            // Валидация дат: конец не раньше начала
            if (field === 'start') {
                input.addEventListener('change', (e) => {
                    const endInput = tr.querySelector('[data-field="end"]');
                    if (endInput && e.target.value) {
                        // Устанавливаем min для поля end
                        endInput.min = e.target.value;
                        // Если конец раньше начала - исправляем
                        if (endInput.value && endInput.value < e.target.value) {
                            endInput.value = e.target.value;
                        }
                    }
                    this.saveRow(task.id, tr);
                    // Автосортировка при изменении даты начала
                    this.sortByStart();
                });
            }

            if (field === 'end') {
                input.addEventListener('change', (e) => {
                    const startInput = tr.querySelector('[data-field="start"]');
                    if (startInput && e.target.value) {
                        // Устанавливаем max для поля start
                        startInput.max = e.target.value;
                        // Если начало позже конца - исправляем
                        if (startInput.value && startInput.value > e.target.value) {
                            startInput.value = e.target.value;
                        }
                    }
                    this.saveRow(task.id, tr);
                });
            }

            // Остальные поля сохраняются при change
            if (!['start', 'end'].includes(field)) {
                input.addEventListener('change', () => {
                    this.saveRow(task.id, tr);
                });
            }
        });

        // Кнопка удаления
        const deleteBtn = tr.querySelector('.delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Удалить работу?')) {
                    store.delete(task.id);
                    showToast('Работа удалена', 'info');
                }
            });
        }

        return tr;
    }

    /**
     * Сохранение строки
     */
    saveRow(id, tr) {
        const fields = {};
        tr.querySelectorAll('[data-field]').forEach(input => {
            const field = input.dataset.field;
            if (field === 'progress') {
                fields[field] = Math.max(0, Math.min(100, parseInt(input.value) || 0));
            } else {
                fields[field] = input.value;
            }
        });

        // Обновляем цвет если изменился тип
        if (fields.type) {
            const types = store.getTypes();
            if (types[fields.type]) {
                fields.color = types[fields.type];
            }
        }

        store.update(id, fields);
    }

    /**
     * Выбор строки
     */
    selectRow(id) {
        // Снимаем выделение с предыдущей
        if (this.selectedRow) {
            const prevRow = this.tbody.querySelector(`tr[data-id="${this.selectedRow}"]`);
            if (prevRow) prevRow.classList.remove('selected');
        }

        this.selectedRow = id;
        const row = this.tbody.querySelector(`tr[data-id="${id}"]`);
        if (row) row.classList.add('selected');
    }

    /**
     * Сортировка данных
     */
    sortData(data, column, direction) {
        return [...data].sort((a, b) => {
            let valA, valB;

            switch (column) {
                case 'id':
                    valA = a.id;
                    valB = b.id;
                    break;
                case 'type':
                    valA = (a.type || '').toLowerCase();
                    valB = (b.type || '').toLowerCase();
                    break;
                case 'task':
                    valA = (a.task || '').toLowerCase();
                    valB = (b.task || '').toLowerCase();
                    break;
                case 'start':
                    valA = parseDateTime(a.start) || 0;
                    valB = parseDateTime(b.start) || 0;
                    break;
                case 'end':
                    valA = parseDateTime(a.end) || 0;
                    valB = parseDateTime(b.end) || 0;
                    break;
                case 'priority':
                    const order = { high: 0, medium: 1, low: 2 };
                    valA = order[a.priority] || 3;
                    valB = order[b.priority] || 3;
                    break;
                default:
                    return 0;
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    /**
     * Сортировка по колонке
     */
    sort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        // Обновляем визуальные индикаторы
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.sort === column) {
                th.classList.add(this.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });

        this.render();
    }

    /**
     * Очистка фильтров
     */
    clearFilters() {
        this.filters = { search: '', type: '', priority: '' };
        
        const searchInput = $('searchInput');
        if (searchInput) searchInput.value = '';
        
        const filterType = $('filterType');
        if (filterType) filterType.value = '';
        
        const filterPriority = $('filterPriority');
        if (filterPriority) filterPriority.value = '';

        this.render();
        showToast('Фильтры сброшены', 'success');
    }

    /**
     * Обновление счетчика
     */
    updateCount(filtered) {
        const total = store.getAll().length;
        const countEl = $('filteredCount');
        if (countEl) {
            countEl.textContent = `${filtered} / ${total}`;
        }
    }

    /**
     * Обновление фильтра типов
     */
    updateTypeFilter() {
        const select = $('filterType');
        if (!select) return;

        const currentValue = select.value;
        const types = store.getTypes();

        select.innerHTML = '<option value="">Все типы</option>';
        Object.keys(types).forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            select.appendChild(option);
        });

        if (types[currentValue]) {
            select.value = currentValue;
        }
    }

    /**
     * Добавить новую работу
     */
    addTask(milestone = false) {
        const task = {
            task: milestone ? 'Новая веха' : 'Новая работа',
            type: milestone ? 'Веха' : '',
            milestone: milestone,
            start: new Date().toISOString().slice(0, 16),
            end: new Date(Date.now() + 3600000).toISOString().slice(0, 16)
        };
        store.add(task);
        showToast(milestone ? 'Веха добавлена' : 'Работа добавлена', 'success');
    }

    /**
     * Дублировать выбранную работу
     */
    duplicateSelected() {
        if (!this.selectedRow) {
            showToast('Выберите работу', 'warning');
            return;
        }
        store.duplicate(this.selectedRow);
        showToast('Работа продублирована', 'success');
    }
}
