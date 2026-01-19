/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - Add created/updated timestamps to projects collection
 * 
 * PocketBase 0.36+ should have these as system fields, but they may be missing
 * if the collection was created with an older schema.
 */

migrate((app) => {
  const projects = app.findCollectionByNameOrId("projects");
  
  if (!projects) {
    console.log("⚠️ Projects collection not found");
    return;
  }
  
  // Check if created field exists
  const hasCreated = projects.fields.find(f => f.name === "created");
  const hasUpdated = projects.fields.find(f => f.name === "updated");
  
  let updated = false;
  
  if (!hasCreated) {
    // Use the Field constructor for PocketBase 0.36+
    const createdField = new Field({
      name: "created",
      type: "autodate",
      onCreate: true,
      onUpdate: false,
    });
    projects.fields.push(createdField);
    updated = true;
    console.log("✅ Added 'created' field to projects");
  } else {
    console.log("ℹ️ 'created' field already exists");
  }
  
  if (!hasUpdated) {
    const updatedField = new Field({
      name: "updated",
      type: "autodate",
      onCreate: true,
      onUpdate: true,
    });
    projects.fields.push(updatedField);
    updated = true;
    console.log("✅ Added 'updated' field to projects");
  } else {
    console.log("ℹ️ 'updated' field already exists");
  }
  
  if (updated) {
    app.save(projects);
    console.log("🎉 Projects collection updated with timestamps");
  }

}, (app) => {
  // Rollback - remove the fields if needed
  const projects = app.findCollectionByNameOrId("projects");
  if (projects) {
    projects.fields = projects.fields.filter(f => f.name !== "created" && f.name !== "updated");
    app.save(projects);
  }
});
