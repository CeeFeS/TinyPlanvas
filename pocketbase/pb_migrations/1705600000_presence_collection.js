/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - Presence Collection Migration
 * 
 * Tracks which users are currently viewing which projects.
 * Used for real-time collaboration awareness.
 */

migrate((app) => {
  // Get projects collection for relation
  const projects = app.findCollectionByNameOrId("projects");
  
  // ==================== PRESENCE COLLECTION ====================
  const presence = new Collection({
    name: "presence",
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
        name: "session_id",
        type: "text",
        required: true,
        min: 1,
        max: 100,
      },
      {
        name: "user_name",
        type: "text",
        required: true,
        min: 1,
        max: 100,
      },
      {
        name: "user_color",
        type: "text",
        required: true,
        min: 4,
        max: 9,
        pattern: "^#[0-9A-Fa-f]{3,8}$",
      },
      {
        name: "last_seen",
        type: "date",
        required: true,
      },
    ],
    indexes: [
      "CREATE INDEX idx_presence_project_id ON presence (project_id)",
      "CREATE UNIQUE INDEX idx_presence_session ON presence (session_id)",
    ],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  });

  app.save(presence);
  console.log("✅ Created presence collection");

}, (app) => {
  // Rollback
  try {
    const col = app.findCollectionByNameOrId("presence");
    if (col) app.delete(col);
  } catch (e) {
    // ignore
  }
});
