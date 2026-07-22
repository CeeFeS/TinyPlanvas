/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - Custom Columns feature
 *
 * ADDITIVE & NON-DESTRUCTIVE:
 * - Adds two NEW collections: `custom_columns` and `custom_values`.
 * - Does not touch any existing collection or data.
 * - Guarded with existence checks so re-running is safe.
 *
 * Data model:
 *   custom_columns: project-scoped column definitions (free-text markdown columns)
 *     - project_id  relation -> projects (cascadeDelete)
 *     - name        text
 *     - sort_order  number
 *
 *   custom_values: per-row cell values (belongs to a task or resource row)
 *     - column_id   relation -> custom_columns (cascadeDelete)
 *     - row_type    select [task, resource]
 *     - row_id      text (id of the task or resource)
 *     - value       text (free text / markdown, may contain line breaks)
 */

migrate((app) => {
  const AUTH_RULE = "@request.auth.id != ''";

  const projects = app.findCollectionByNameOrId("projects");
  if (!projects) {
    console.log("⚠️ projects collection not found - skipping custom columns migration");
    return;
  }

  // ==================== custom_columns ====================
  let customColumns = null;
  try {
    customColumns = app.findCollectionByNameOrId("custom_columns");
  } catch (e) {
    customColumns = null;
  }

  if (!customColumns) {
    customColumns = new Collection({
      name: "custom_columns",
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
          name: "name",
          type: "text",
          required: true,
          min: 1,
          max: 100,
        },
        {
          name: "sort_order",
          type: "number",
          required: false,
          min: 0,
        },
      ],
      indexes: [
        "CREATE INDEX idx_custom_columns_project_id ON custom_columns (project_id)",
        "CREATE INDEX idx_custom_columns_sort_order ON custom_columns (sort_order)",
      ],
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
    });
    app.save(customColumns);
    console.log("✅ Created custom_columns collection");
  } else {
    console.log("ℹ️ custom_columns collection already exists");
  }

  // ==================== custom_values ====================
  let customValues = null;
  try {
    customValues = app.findCollectionByNameOrId("custom_values");
  } catch (e) {
    customValues = null;
  }

  if (!customValues) {
    customValues = new Collection({
      name: "custom_values",
      type: "base",
      fields: [
        {
          name: "column_id",
          type: "relation",
          required: true,
          collectionId: customColumns.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: "row_type",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["task", "resource"],
        },
        {
          name: "row_id",
          type: "text",
          required: true,
          min: 1,
          max: 50,
        },
        {
          name: "value",
          type: "text",
          required: false,
          max: 100000,
        },
      ],
      indexes: [
        "CREATE INDEX idx_custom_values_column_id ON custom_values (column_id)",
        "CREATE INDEX idx_custom_values_row ON custom_values (row_type, row_id)",
        "CREATE UNIQUE INDEX idx_custom_values_unique ON custom_values (column_id, row_type, row_id)",
      ],
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
    });
    app.save(customValues);
    console.log("✅ Created custom_values collection");
  } else {
    console.log("ℹ️ custom_values collection already exists");
  }

  console.log("🎉 Custom columns migration complete");
}, (app) => {
  // Rollback - remove the two collections (values first due to relation)
  for (const name of ["custom_values", "custom_columns"]) {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (col) app.delete(col);
    } catch (e) {
      // ignore
    }
  }
});
