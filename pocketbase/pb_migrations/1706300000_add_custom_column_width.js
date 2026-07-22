/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - Add "width" field to custom_columns collection
 *
 * ADDITIVE & NON-DESTRUCTIVE:
 * - Adds a new optional "number" field `width` to the existing custom_columns
 *   collection ONLY if it does not already exist.
 * - Existing custom columns are preserved. Any column without a width is
 *   backfilled to the default 180 so the grid always has a sensible value.
 * - The rollback only removes the field (data-preserving for all other fields).
 *
 * The width is the persisted, project-wide column width (in px) that users can
 * adjust by dragging the column edge in the planning grid.
 */

migrate((app) => {
  let customColumns = null;
  try {
    customColumns = app.findCollectionByNameOrId("custom_columns");
  } catch (e) {
    customColumns = null;
  }

  if (!customColumns) {
    console.log("⚠️ custom_columns collection not found - skipping width migration");
    return;
  }

  const hasWidth = customColumns.fields.find((f) => f.name === "width");

  if (!hasWidth) {
    const widthField = new Field({
      name: "width",
      type: "number",
      required: false,
      min: 80,
      max: 1200,
    });
    customColumns.fields.push(widthField);
    app.save(customColumns);
    console.log("✅ Added 'width' field to custom_columns");
  } else {
    console.log("ℹ️ 'width' field already exists");
  }

  // Backfill existing columns that have no width yet (non-destructive).
  try {
    const records = app.findAllRecords("custom_columns");
    let backfilled = 0;
    for (const record of records) {
      const current = record.get("width");
      if (!current) {
        record.set("width", 180);
        app.save(record);
        backfilled++;
      }
    }
    if (backfilled > 0) {
      console.log(`✅ Backfilled width=180 for ${backfilled} existing custom column(s)`);
    }
  } catch (e) {
    console.log("ℹ️ Width backfill skipped: " + e);
  }

  console.log("🎉 custom_columns width migration complete");
}, (app) => {
  // Rollback - remove only the width field, keep everything else intact
  let customColumns = null;
  try {
    customColumns = app.findCollectionByNameOrId("custom_columns");
  } catch (e) {
    customColumns = null;
  }
  if (customColumns) {
    customColumns.fields = customColumns.fields.filter((f) => f.name !== "width");
    app.save(customColumns);
  }
});
