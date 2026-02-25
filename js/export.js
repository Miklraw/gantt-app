/**
 * Export - Модуль для экспорта данных в Excel, PDF, JSON
 */

import { store } from './store.js';
import { $, showToast, formatDateTimeDisplay, parseDateTime } from './utils.js';

export class Export {
    constructor() {
        this.dateOptions = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
    }

    /**
     * Экспорт в Excel
     */
    toExcel() {
        try {
            showToast('Создание Excel файла...', 'info');

            const data = store.getAll();
            const projectName = store.getProjectName();

            // Подготовка данных с новым порядком столбцов
            const wsData = data.map((row, index) => {
                const startDate = parseDateTime(row.start);
                const endDate = parseDateTime(row.end);
                
                return {
                    '#': index + 1,
                    'Дата начала': startDate ? startDate.toLocaleDateString('ru-RU') : '-',
                    'Время начала': startDate ? startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '-',
                    'Дата конца': endDate ? endDate.toLocaleDateString('ru-RU') : '-',
                    'Время конца': endDate ? endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '-',
                    'Тип': row.type || '',
                    'Работа': row.task || '',
                    'Ответственный': row.owner || '',
                    'Прогресс (%)': row.progress || 0,
                    'Приоритет': this.getPriorityLabel(row.priority),
                    'Веха': row.milestone ? 'Да' : 'Нет'
                };
            });

            // Создание листа
            const ws = XLSX.utils.json_to_sheet(wsData);

            // Ширина колонок
            ws['!cols'] = [
                { wch: 5 },   // #
                { wch: 12 },  // Дата начала
                { wch: 10 },  // Время начала
                { wch: 12 },  // Дата конца
                { wch: 10 },  // Время конца
                { wch: 15 },  // Тип
                { wch: 30 },  // Работа
                { wch: 18 },  // Ответственный
                { wch: 12 },  // Прогресс
                { wch: 12 },  // Приоритет
                { wch: 6 }    // Веха
            ];

            // Создание книги
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Расписание');

            // Сохранение
            const fileName = this.sanitizeFileName(projectName) + '_' + this.getDateString() + '.xlsx';
            XLSX.writeFile(wb, fileName);

            showToast('Excel файл создан!', 'success');
        } catch (e) {
            console.error('Excel export error:', e);
            showToast('Ошибка создания Excel', 'error');
        }
    }

    /**
     * Экспорт в PDF
     */
    async toPDF() {
        try {
            showToast('📄 Создание PDF файла...', 'info');

            const projectName = store.getProjectName();
            const data = store.getAll();
            
            // Создаем таблицу для PDF
            const tableHtml = this.createPDFTable(data, projectName);
            
            // Создаем временный контейнер
            const container = document.createElement('div');
            container.innerHTML = tableHtml;
            container.style.cssText = 'position:absolute;left:-9999px;top:0;background:#0b0d12;padding:20px;';
            document.body.appendChild(container);

            // Используем html2canvas
            const canvas = await html2canvas(container, {
                backgroundColor: '#0b0d12',
                scale: 2
            });

            document.body.removeChild(container);

            // Создаем PDF
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            // Заголовок
            pdf.setFontSize(18);
            pdf.setTextColor(93, 167, 255);
            pdf.text(projectName, pageWidth / 2, 15, { align: 'center' });

            // Дата
            pdf.setFontSize(10);
            pdf.setTextColor(150);
            pdf.text('Создано: ' + new Date().toLocaleString('ru-RU'), pageWidth / 2, 22, { align: 'center' });

            // Изображение таблицы
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = pageWidth - 20;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 30;

            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= (pageHeight - position);

            while (heightLeft > 0) {
                pdf.addPage();
                position = 10;
                pdf.addImage(imgData, 'PNG', 10, position - imgHeight + heightLeft, imgWidth, imgHeight);
                heightLeft -= (pageHeight - 20);
            }

            // Сохранение
            const fileName = this.sanitizeFileName(projectName) + '_' + this.getDateString() + '.pdf';
            pdf.save(fileName);

            showToast('✅ PDF файл создан!', 'success');
        } catch (e) {
            console.error('PDF export error:', e);
            showToast('❌ Ошибка создания PDF', 'error');
        }
    }

    /**
     * Создание HTML таблицы для PDF
     */
    createPDFTable(data, projectName) {
        const rows = data.map(row => `
            <tr>
                <td>${row.id}</td>
                <td>${this.escapeHtml(row.type || '-')}</td>
                <td>${this.escapeHtml(row.task || '-')}</td>
                <td>${this.formatDate(row.start)}</td>
                <td>${this.formatDate(row.end)}</td>
                <td>${row.progress}%</td>
                <td>${this.getPriorityEmoji(row.priority)}</td>
                <td>${this.escapeHtml(row.owner || '-')}</td>
            </tr>
        `).join('');

        return `
            <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
                <thead>
                    <tr style="background:#1a2332;color:#5da7ff;">
                        <th style="padding:8px;border:1px solid #2a3550;">#</th>
                        <th style="padding:8px;border:1px solid #2a3550;">Тип</th>
                        <th style="padding:8px;border:1px solid #2a3550;">Работа</th>
                        <th style="padding:8px;border:1px solid #2a3550;">Начало</th>
                        <th style="padding:8px;border:1px solid #2a3550;">Конец</th>
                        <th style="padding:8px;border:1px solid #2a3550;">%</th>
                        <th style="padding:8px;border:1px solid #2a3550;">!</th>
                        <th style="padding:8px;border:1px solid #2a3550;">Отв.</th>
                    </tr>
                </thead>
                <tbody style="color:#e7ecf3;">
                    ${rows}
                </tbody>
            </table>
        `;
    }

    /**
     * Экспорт в JSON
     */
    toJSON() {
        try {
            const data = store.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = this.sanitizeFileName(store.getProjectName()) + '_' + this.getDateString() + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('✅ JSON файл скачан!', 'success');
        } catch (e) {
            console.error('JSON export error:', e);
            showToast('❌ Ошибка экспорта JSON', 'error');
        }
    }

    /**
     * Импорт из JSON
     */
    fromJSON(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const success = store.importData(e.target.result);
                if (success) {
                    showToast('✅ Данные импортированы!', 'success');
                } else {
                    showToast('❌ Ошибка формата файла', 'error');
                }
            } catch (err) {
                console.error('Import error:', err);
                showToast('❌ Ошибка импорта', 'error');
            }
        };
        reader.readAsText(file);
    }

    /**
     * Экспорт для Shared View
     */
    toSharedView() {
        const data = store.getAll();
        const projectName = store.getProjectName();

        return {
            data: data,
            projectName: projectName,
            generatedAt: new Date().toISOString()
        };
    }

    // ===== ВСПОМОГАТЕЛЬНЫЕ =====

    formatDate(dateStr) {
        const date = parseDateTime(dateStr);
        if (!date) return '-';
        return date.toLocaleString('ru-RU', this.dateOptions);
    }

    getPriorityLabel(priority) {
        const labels = {
            high: 'Высокий',
            medium: 'Средний',
            low: 'Низкий'
        };
        return labels[priority] || 'Средний';
    }

    getPriorityEmoji(priority) {
        const emojis = {
            high: '🔴',
            medium: '🟡',
            low: '🔵'
        };
        return emojis[priority] || '⚪';
    }

    sanitizeFileName(name) {
        return (name || 'расписание')
            .replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s_-]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .slice(0, 50);
    }

    getDateString() {
        return new Date().toISOString().slice(0, 10);
    }

    escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/[&<>"']/g, m => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m]));
    }
}

// Экспорт singleton
export const exporter = new Export();
