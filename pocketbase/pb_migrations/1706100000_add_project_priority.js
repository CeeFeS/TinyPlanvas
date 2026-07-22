/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - Add "priority" field to projects collection
 *
 * ADDITIVE & NON-DESTRUCTIVE:
 * - Adds a new optional "select" field `priority` to the existing projects
 *   collection ONLY if it does not already exist.
 * - Existing projects are preserved. Any project without a priority is
 *   backfilled to the default "medium" so the UI always has a value.
 * - The rollback only removes the field (data-preserving for all other fields).
 *
 * Priority values: immediate | high | medium | low | on_hold
 */

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects");

  if (!projects) {
    console.log("⚠️ Projects collection not found - skipping priority migration");
    return;
  }

  const hasPriority = projects.fields.find((f) => f.name === "priority");

  if (!hasPriority) {
    const priorityField = new Field({
      name: "priority",
      type: "select",
      required: false,
      maxSelect: 1,
      values: ["immediate", "high", "medium", "low", "on_hold"],
    });
    projects.fields.push(priorityField);
    app.save(projects);
    console.log("✅ Added 'priority' field to projects");
  } else {
    console.log("ℹ️ 'priority' field already exists");
  }

  // Backfill existing projects that have no priority yet (non-destructive).
  try {
    const records = app.findAllRecords("projects");
    let backfilled = 0;
    for (const record of records) {
      const current = record.get("priority");
      if (!current) {
        record.set("priority", "medium");
        app.save(record);
        backfilled++;
      }
    }
    if (backfilled > 0) {
      console.log(`✅ Backfilled priority='medium' for ${backfilled} existing project(s)`);
    }
  } catch (e) {
    console.log("ℹ️ Priority backfill skipped: " + e);
  }

  console.log("🎉 Project priority migration complete");
}, (app) => {
  // Rollback - remove only the priority field, keep everything else intact
  const projects = app.findCollectionByNameOrId("projects");
  if (projects) {
    projects.fields = projects.fields.filter((f) => f.name !== "priority");
    app.save(projects);
  }
});
