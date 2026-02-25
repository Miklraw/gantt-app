/**
 * Gantt - Модуль для отрисовки диаграммы Ганта
 */

import { store } from './store.js';
import { $, escapeHtml, parseDateTime, pad2 } from './utils.js';

export class Gantt {
    constructor() {
        this.container = $('ganttContainer');
        this.yLabels = $('yLabels');
        this.timeHeader = $('timeHeader');
        this.grid = $('ganttGrid');
        this.bars = $('ganttBars');
        this.depsSvg = $('depsSvg');
        
        this.pxPerMin = 1;
        this.minStart = null;
        this.maxEnd = null;
        this.rowHeight = 50;
    }

    /**
     * Инициализация
     */
    init() {
        this.bindEvents();
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        const zoomSelect = $('zoomSelect');
        if (zoomSelect) {
            zoomSelect.addEventListener('change', () => this.render());
        }

        const showDeps = $('showDependencies');
        if (showDeps) {
            showDeps.addEventListener('change', () => this.render());
        }

        const showCritical = $('showCriticalPath');
        if (showCritical) {
            showCritical.addEventListener('change', () => this.render());
        }

        // Подписка на изменения
        store.subscribe((action) => {
            if (['add', 'update', 'delete', 'import', 'undo', 'redo', 'critical-change'].includes(action)) {
                this.render();
            }
        });
    }

    /**
     * Отрисовка диаграммы
     */
    render() {
        if (!this.container || !this.yLabels || !this.bars) return;

        // Получаем данные и вычисляем критический путь
        store.calculateCriticalPath();
        const data = store.getAll().filter(t => !t.milestone);
        
        // Сортируем по дате начала
        data.sort((a, b) => {
            const dateA = parseDateTime(a.start) || 0;
            const dateB = parseDateTime(b.start) || 0;
            return dateA - dateB;
        });

        // Очищаем
        this.yLabels.innerHTML = '';
        this.timeHeader.innerHTML = '';
        this.grid.innerHTML = '';
        this.bars.innerHTML = '';
        this.depsSvg.innerHTML = '';

        if (data.length === 0) {
            this.grid.innerHTML = '<div style="padding:40px;color:var(--muted);text-align:center">Нет данных</div>';
            return;
        }

        // Вычисляем границы времени
        this.calculateTimeBounds(data);

        // Получаем масштаб
        const zoomSelect = $('zoomSelect');
        const hoursPerScreen = parseInt(zoomSelect?.value || 12, 10);
        const spanMinutes = Math.max(1, (this.maxEnd - this.minStart) / 60000);
        const containerWidth = this.container.clientWidth - 250;
        const contentWidth = Math.max(800, Math.ceil(spanMinutes * containerWidth / (hoursPerScreen * 60)));
        this.pxPerMin = contentWidth / (hoursPerScreen * 60);

        // Устанавливаем размеры
        const totalHeight = data.length * this.rowHeight;
        const gantt = $('gantt');
        if (gantt) gantt.style.height = (totalHeight + 50) + 'px';

        this.grid.style.width = contentWidth + 'px';
        this.bars.style.width = contentWidth + 'px';
        this.timeHeader.style.width = contentWidth + 'px';
        this.depsSvg.setAttribute('width', contentWidth);
        this.depsSvg.setAttribute('height', totalHeight + 50);

        // Отрисовываем y-метки
        this.renderYLabels(data);

        // Отрисовываем сетку и заголовок времени
        this.renderGrid(contentWidth, hoursPerScreen);

        // Отрисовываем зависимости
        if ($('showDependencies')?.checked) {
            this.renderDependencies(data);
        }

        // Отрисовываем бары
        this.renderBars(data);
    }

    /**
     * Вычисление границ времени
     */
    calculateTimeBounds(data) {
        const dates = data.flatMap(t => [parseDateTime(t.start), parseDateTime(t.end)]).filter(d => d);
        this.minStart = new Date(Math.min(...dates));
        this.maxEnd = new Date(Math.max(...dates));
    }

    /**
     * Отрисовка Y-меток
     */
    renderYLabels(data) {
        data.forEach(task => {
            const item = document.createElement('div');
            item.className = 'y-item';
            if (store.isCritical(task.id)) {
                item.classList.add('critical');
            }

            item.innerHTML = `
                <div class="type">${escapeHtml(task.type || '-')}</div>
                <div class="task">${escapeHtml(task.task || '')}</div>
            `;

            this.yLabels.appendChild(item);
        });
    }

    /**
     * Отрисовка сетки
     */
    renderGrid(width, hoursPerScreen) {
        const tickMinutes = this.chooseTickInterval(hoursPerScreen * 60);
        const firstTick = new Date(this.minStart);
        firstTick.setMinutes(Math.ceil(firstTick.getMinutes() / tickMinutes) * tickMinutes, 0, 0);

        let lastLabelX = -9999;
        const minLabelGap = 60;

        for (let t = new Date(firstTick); t <= this.maxEnd; t = new Date(t.getTime() + tickMinutes * 60000)) {
            const x = Math.round((t - this.minStart) / 60000 * this.pxPerMin);
            const isMajor = t.getHours() === 0 && t.getMinutes() === 0;

            // Вертикальная линия
            const tick = document.createElement('div');
            tick.className = `tick ${isMajor ? 'major' : ''}`;
            tick.style.left = x + 'px';
            this.grid.appendChild(tick);

            // Метка времени
            if (x - lastLabelX > minLabelGap || isMajor) {
                const label = document.createElement('div');
                label.className = 'tick-label';
                label.style.left = x + 'px';
                label.textContent = `${pad2(t.getDate())}.${pad2(t.getMonth() + 1)} ${pad2(t.getHours())}:${pad2(t.getMinutes())}`;
                if (isMajor) label.style.fontWeight = '700';
                this.timeHeader.appendChild(label);
                lastLabelX = x;
            }
        }
    }

    /**
     * Выбор интервала тиков
     */
    chooseTickInterval(spanMinutes) {
        if (spanMinutes <= 480) return 30;
        if (spanMinutes <= 1440) return 60;
        if (spanMinutes <= 2880) return 120;
        if (spanMinutes <= 10080) return 720;
        return 1440;
    }

    /**
     * Отрисовка зависимостей
     */
    renderDependencies(data) {
        const showCritical = $('showCriticalPath')?.checked;
        const positionMap = new Map();

        data.forEach((task, index) => {
            positionMap.set(task.id, {
                x: (parseDateTime(task.start) - this.minStart) / 60000 * this.pxPerMin,
                y: index * this.rowHeight + this.rowHeight / 2,
                width: Math.max(20, (parseDateTime(task.end) - parseDateTime(task.start)) / 60000 * this.pxPerMin)
            });
        });

        data.forEach(task => {
            if (!task.dependencies || task.dependencies.length === 0) return;

            task.dependencies.forEach(depId => {
                const from = positionMap.get(parseInt(depId));
                const to = positionMap.get(task.id);
                if (!from || !to) return;

                const isCritical = showCritical && store.isCritical(task.id) && store.isCritical(parseInt(depId));
                
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const startX = from.x + from.width;
                const startY = from.y;
                const endX = to.x;
                const endY = to.y;
                const midX = (startX + endX) / 2;

                const d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
                path.setAttribute('d', d);
                path.setAttribute('stroke', isCritical ? '#ff4757' : '#5da7ff');
                path.setAttribute('stroke-width', isCritical ? '2.5' : '2');
                path.setAttribute('stroke-dasharray', isCritical ? 'none' : '5,5');
                path.setAttribute('fill', 'none');
                path.setAttribute('opacity', '0.7');

                this.depsSvg.appendChild(path);
            });
        });
    }

    /**
     * Отрисовка баров
     */
    renderBars(data) {
        data.forEach((task, index) => {
            const start = parseDateTime(task.start);
            const end = parseDateTime(task.end);
            if (!start || !end) return;

            const x = (start - this.minStart) / 60000 * this.pxPerMin;
            const width = Math.max(20, (end - start) / 60000 * this.pxPerMin);
            const y = index * this.rowHeight + 9;

            const bar = document.createElement('div');
            bar.className = 'bar';
            if (store.isCritical(task.id)) {
                bar.classList.add('critical');
            }

            bar.style.left = x + 'px';
            bar.style.top = y + 'px';
            bar.style.width = width + 'px';
            bar.style.background = task.color || '#5da7ff';
            bar.dataset.id = task.id;

            bar.innerHTML = `<span>${escapeHtml(task.type || '')}</span>`;

            // Прогресс
            if (task.progress > 0) {
                const prog = document.createElement('div');
                prog.className = 'bar-progress';
                prog.style.width = task.progress + '%';
                bar.appendChild(prog);
            }

            // Подсказка
            bar.title = `${task.task}\n${start.toLocaleString('ru-RU')} - ${end.toLocaleString('ru-RU')}\nПрогресс: ${task.progress}%`;

            // Drag & Drop
            this.setupDragDrop(bar, task);

            this.bars.appendChild(bar);
        });
    }

    /**
     * Настройка Drag & Drop
     */
    setupDragDrop(bar, task) {
        let isDragging = false;
        let startX, startLeft;

        bar.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDragging = true;
            startX = e.clientX;
            startLeft = parseInt(bar.style.left);
            bar.classList.add('dragging');
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - startX;
            bar.style.left = Math.max(0, startLeft + deltaX) + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            bar.classList.remove('dragging');

            // Вычисляем новую дату
            const currentLeft = parseInt(bar.style.left);
            const deltaMinutes = Math.round((currentLeft - startLeft) / this.pxPerMin);
            const newStart = new Date(parseDateTime(task.start).getTime() + deltaMinutes * 60000);
            const duration = parseDateTime(task.end) - parseDateTime(task.start);
            const newEnd = new Date(newStart.getTime() + duration);

            store.update(task.id, {
                start: newStart.toISOString().slice(0, 16),
                end: newEnd.toISOString().slice(0, 16)
            });
        });
    }
}
