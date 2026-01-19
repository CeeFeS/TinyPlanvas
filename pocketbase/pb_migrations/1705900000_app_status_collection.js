/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - App Status Collection
 * 
 * This collection stores the application setup status.
 * It is publicly readable (no authentication required) to allow
 * checking if the app has been initialized before login.
 * 
 * This solves the problem of detecting if users exist without
 * requiring authentication (which is a chicken-and-egg problem).
 */

migrate((app) => {
  console.log("📊 Creating app_status collection...");
  
  // Check if collection already exists
  let existing = null;
  try {
    existing = app.findCollectionByNameOrId("app_status");
  } catch (e) {
    // Collection doesn't exist
  }
  
  if (existing) {
    console.log("ℹ️ app_status collection already exists");
    return;
  }
  
  const appStatus = new Collection({
    name: "app_status",
    type: "base",
    fields: [
      {
        name: "key",
        type: "text",
        required: true,
        primaryKey: false,
      },
      {
        name: "value",
        type: "text",
        required: false,
      },
      {
        name: "initialized",
        type: "bool",
        required: false,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_app_status_key ON app_status (key)",
    ],
    // PUBLIC READ - allows checking setup status without authentication
    listRule: "",
    viewRule: "",
    // Only authenticated users can create/update/delete
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });

  app.save(appStatus);
  console.log("✅ Created app_status collection (publicly readable)");
  console.log("ℹ️ This collection is used to track if the app has been initialized");

}, (app) => {
  // Rollback
  try {
    const col = app.findCollectionByNameOrId("app_status");
    if (col) {
      app.delete(col);
      console.log("✅ Deleted app_status collection");
    }
  } catch (e) {
    // ignore
  }
});
