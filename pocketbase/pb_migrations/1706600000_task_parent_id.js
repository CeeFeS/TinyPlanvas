/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - Add optional parent_id to tasks (one-level subtasks)
 *
 * ADDITIVE & NON-DESTRUCTIVE:
 * - Adds optional self-relation `parent_id` on tasks (cascadeDelete when parent is removed).
 * - Existing root tasks are unchanged (parent_id remains empty).
 */

migrate((app) => {
  const tasks = app.findCollectionByNameOrId("tasks");
  if (!tasks) {
    console.log("⚠️ tasks collection not found - skipping parent_id migration");
    return;
  }

  const hasParent = tasks.fields.find((f) => f.name === "parent_id");
  if (!hasParent) {
    const parentField = new Field({
      name: "parent_id",
      type: "relation",
      required: false,
      collectionId: tasks.id,
      cascadeDelete: true,
      maxSelect: 1,
    });
    tasks.fields.push(parentField);
    app.save(tasks);
    console.log("✅ Added 'parent_id' field to tasks");
  } else {
    console.log("ℹ️ 'parent_id' field already exists");
  }

  try {
    const collection = app.findCollectionByNameOrId("tasks");
    const indexes = collection.indexes || [];
    const indexName = "idx_tasks_parent_id";
    if (!indexes.some((idx) => String(idx).includes(indexName))) {
      indexes.push("CREATE INDEX idx_tasks_parent_id ON tasks (parent_id)");
      collection.indexes = indexes;
      app.save(collection);
      console.log("✅ Added index idx_tasks_parent_id");
    }
  } catch (e) {
    console.log("ℹ️ parent_id index skipped: " + e);
  }

  console.log("🎉 Task parent_id migration complete");
}, (app) => {
  const tasks = app.findCollectionByNameOrId("tasks");
  if (tasks) {
    tasks.fields = tasks.fields.filter((f) => f.name !== "parent_id");
    if (tasks.indexes) {
      tasks.indexes = tasks.indexes.filter(
        (idx) => !String(idx).includes("idx_tasks_parent_id")
      );
    }
    app.save(tasks);
  }
});
