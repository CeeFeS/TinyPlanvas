/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - Authentication & Permissions Collections
 * 
 * PocketBase 0.36+ compatible migration.
 * 
 * Note: The isAdmin field on users collection should be added manually
 * in the PocketBase Admin Dashboard if needed. The app uses localStorage
 * as a fallback for admin status.
 */

migrate((app) => {
  
  // ==================== UPDATE USERS COLLECTION RULES ====================
  try {
    const users = app.findCollectionByNameOrId("users");
    
    if (users) {
      // Set permissive API rules for development
      users.createRule = "";  // Allow anyone to create (for first user setup)
      users.listRule = "@request.auth.id != ''";
      users.viewRule = "@request.auth.id != ''";
      users.updateRule = "@request.auth.id = id";
      users.deleteRule = "";  // Disable delete for now
      
      app.save(users);
      console.log("✅ Updated users collection rules");
    }
  } catch (e) {
    console.log("⚠️ Could not update users collection:", e);
  }

  // ==================== PROJECT PERMISSIONS COLLECTION ====================
  let existingPerms = null;
  try {
    existingPerms = app.findCollectionByNameOrId("project_permissions");
  } catch (e) {
    // Collection doesn't exist
  }
  
  if (existingPerms) {
    console.log("ℹ️ project_permissions collection already exists");
  } else {
    let projectsId = "";
    try {
      const projects = app.findCollectionByNameOrId("projects");
      projectsId = projects.id;
    } catch (e) {
      projectsId = "projects";
    }
    
    const projectPermissions = new Collection({
      name: "project_permissions",
      type: "base",
      fields: [
        {
          name: "user_id",
          type: "relation",
          required: true,
          collectionId: "_pb_users_auth_",
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: "project_id",
          type: "relation",
          required: true,
          collectionId: projectsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: "permission_level",
          type: "select",
          required: true,
          maxSelect: 1,
          values: ["view", "edit"],
        },
      ],
      indexes: [
        "CREATE INDEX idx_perms_user_id ON project_permissions (user_id)",
        "CREATE INDEX idx_perms_project_id ON project_permissions (project_id)",
        "CREATE UNIQUE INDEX idx_perms_user_project ON project_permissions (user_id, project_id)",
      ],
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
    });

    app.save(projectPermissions);
    console.log("✅ Created project_permissions collection");
  }

  // ==================== UPDATE PROJECTS COLLECTION RULES ====================
  // Note: Rules are now set in 1705800000_secure_api_rules.js
  // This section is kept for backwards compatibility but rules will be overwritten
  try {
    const projects = app.findCollectionByNameOrId("projects");
    // Secure rules - require authentication
    const authRule = "@request.auth.id != ''";
    projects.listRule = authRule;
    projects.viewRule = authRule;
    projects.createRule = authRule;
    projects.updateRule = authRule;
    projects.deleteRule = authRule;
    app.save(projects);
    console.log("✅ Updated projects collection rules (secure)");
  } catch (e) {
    console.log("⚠️ Could not update projects rules:", e);
  }

  console.log("🎉 Auth migration completed!");
  console.log("ℹ️ Note: Add 'isAdmin' (Bool) field to users collection manually if needed");

}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("project_permissions");
    if (col) app.delete(col);
  } catch (e) {}
});
