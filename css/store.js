export const store = {
    data: [
        { id: 1, task: "Запуск сервера", start: "2026-02-25T09:00", end: "2026-02-25T18:00", progress: 0, priority: "high", dependencies: [] }
    ],
    updateTask(id, fields) {
        const task = this.data.find(t => t.id == id);
        if (task) Object.assign(task, fields);
    }
};