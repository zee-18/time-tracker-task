export const queryKeys = {
  clientsPage: (page: number, pageSize: number) => [
    "clients",
    { page, pageSize },
  ],
  projectsPage: (clientId: number, page: number, pageSize: number) => [
    "projects",
    clientId,
    { page, pageSize },
  ],
  tasksPage: (projectId: number, page: number, pageSize: number) => [
    "tasks",
    projectId,
    { page, pageSize },
  ],
  task: (taskId: number) => ["task", taskId],
  entriesAll: () => ["entries", "all"],
  entriesPage: (page: number, pageSize: number) => [
    "entries",
    "page",
    { page, pageSize },
  ],
};
