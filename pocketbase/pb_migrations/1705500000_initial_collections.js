/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - Initial Collections Migration
 * 
 * PocketBase 0.36+ compatible migration.
 */

migrate((app) => {
  // ==================== PROJECTS COLLECTION ====================
  const projects = new Collection({
    name: "projects",
    type: "base",
    fields: [
      {
        name: "user_id",
        type: "text",
        required: false,
      },
      {
        name: "name",
        type: "text",
        required: true,
        min: 1,
        max: 200,
      },
      {
        name: "resolution",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["day", "week", "month", "year"],
      },
      {
        name: "start_date",
        type: "date",
        required: true,
      },
      {
        name: "end_date",
        type: "date",
        required: true,
      },
    ],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  });

  app.save(projects);
  console.log("✅ Created projects collection");

  // ==================== TASKS COLLECTION ====================
  const tasks = new Collection({
    name: "tasks",
    type: "base",
    fields: [
      {
        name: "project_id",
        type: "relation",
        required: true,
        collectionId: projects.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "display_id",
        type: "text",
        required: true,
        min: 1,
        max: 50,
      },
      {
        name: "name",
        type: "text",
        required: true,
        min: 1,
        max: 500,
      },
      {
        name: "sort_order",
        type: "number",
        required: false,
        min: 0,
      },
    ],
    indexes: [
      "CREATE INDEX idx_tasks_project_id ON tasks (project_id)",
      "CREATE INDEX idx_tasks_sort_order ON tasks (sort_order)",
    ],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  });

  app.save(tasks);
  console.log("✅ Created tasks collection");

  // ==================== RESOURCES COLLECTION ====================
  const resources = new Collection({
    name: "resources",
    type: "base",
    fields: [
      {
        name: "task_id",
        type: "relation",
        required: true,
        collectionId: tasks.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "name",
        type: "text",
        required: true,
        min: 1,
        max: 200,
      },
      {
        name: "sort_order",
        type: "number",
        required: false,
        min: 0,
      },
    ],
    indexes: [
      "CREATE INDEX idx_resources_task_id ON resources (task_id)",
      "CREATE INDEX idx_resources_sort_order ON resources (sort_order)",
    ],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  });

  app.save(resources);
  console.log("✅ Created resources collection");

  // ==================== ALLOCATIONS COLLECTION ====================
  const allocations = new Collection({
    name: "allocations",
    type: "base",
    fields: [
      {
        name: "resource_id",
        type: "relation",
        required: true,
        collectionId: resources.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "date",
        type: "text",
        required: true,
        min: 1,
        max: 20,
      },
      {
        name: "percentage",
        type: "number",
        required: true,
        min: 0,
        max: 100,
      },
      {
        name: "color_hex",
        type: "text",
        required: true,
        min: 4,
        max: 9,
        pattern: "^#[0-9A-Fa-f]{3,8}$",
      },
    ],
    indexes: [
      "CREATE INDEX idx_allocations_resource_id ON allocations (resource_id)",
      "CREATE INDEX idx_allocations_date ON allocations (date)",
      "CREATE UNIQUE INDEX idx_allocations_resource_date ON allocations (resource_id, date)",
    ],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  });

  app.save(allocations);
  console.log("✅ Created allocations collection");

  console.log("🎉 TinyPlanvas collections created successfully!");

}, (app) => {
  // Rollback
  const names = ["allocations", "resources", "tasks", "projects"];
  for (const name of names) {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (col) app.delete(col);
    } catch (e) {
      // ignore
    }
  }
});
