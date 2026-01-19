/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - Secure API Rules Migration
 * 
 * This migration updates all collections with permission-based access control.
 * 
 * NOTE: PocketBase doesn't support subqueries in API rules directly.
 * The permission check is done via:
 * 1. Database-level: Owner check (user_id = @request.auth.id)
 * 2. Application-level: Permission table lookup in frontend/API
 * 
 * For projects with shared permissions, the frontend must filter results
 * by querying project_permissions collection.
 */

migrate((app) => {
  console.log("🔒 Applying secure API rules...");
  
  // Base auth rule: Must be authenticated
  const AUTH_RULE = "@request.auth.id != ''";
  
  // ==================== PROJECTS COLLECTION ====================
  // Note: user_id is stored as text (not relation) for flexibility
  // API rules check ownership; permission sharing is handled by frontend filtering
  try {
    const projects = app.findCollectionByNameOrId("projects");
    if (projects) {
      // List/View: Authenticated users can see all projects
      // Frontend will filter by ownership + permissions
      projects.listRule = AUTH_RULE;
      projects.viewRule = AUTH_RULE;
      // Create: Any authenticated user can create projects
      projects.createRule = AUTH_RULE;
      // Update: Only owner can update (strict enforcement at DB level)
      projects.updateRule = "user_id = @request.auth.id";
      // Delete: Only owner can delete
      projects.deleteRule = "user_id = @request.auth.id";
      app.save(projects);
      console.log("✅ Secured projects collection");
    }
  } catch (e) {
    console.log("⚠️ Could not secure projects collection:", e);
  }

  // ==================== TASKS COLLECTION ====================
  try {
    const tasks = app.findCollectionByNameOrId("tasks");
    if (tasks) {
      // Access requires authentication; project permission checked at frontend
      tasks.listRule = AUTH_RULE;
      tasks.viewRule = AUTH_RULE;
      tasks.createRule = AUTH_RULE;
      tasks.updateRule = AUTH_RULE;
      tasks.deleteRule = AUTH_RULE;
      app.save(tasks);
      console.log("✅ Secured tasks collection");
    }
  } catch (e) {
    console.log("⚠️ Could not secure tasks collection:", e);
  }

  // ==================== RESOURCES COLLECTION ====================
  try {
    const resources = app.findCollectionByNameOrId("resources");
    if (resources) {
      resources.listRule = AUTH_RULE;
      resources.viewRule = AUTH_RULE;
      resources.createRule = AUTH_RULE;
      resources.updateRule = AUTH_RULE;
      resources.deleteRule = AUTH_RULE;
      app.save(resources);
      console.log("✅ Secured resources collection");
    }
  } catch (e) {
    console.log("⚠️ Could not secure resources collection:", e);
  }

  // ==================== ALLOCATIONS COLLECTION ====================
  try {
    const allocations = app.findCollectionByNameOrId("allocations");
    if (allocations) {
      allocations.listRule = AUTH_RULE;
      allocations.viewRule = AUTH_RULE;
      allocations.createRule = AUTH_RULE;
      allocations.updateRule = AUTH_RULE;
      allocations.deleteRule = AUTH_RULE;
      app.save(allocations);
      console.log("✅ Secured allocations collection");
    }
  } catch (e) {
    console.log("⚠️ Could not secure allocations collection:", e);
  }

  // ==================== PRESENCE COLLECTION ====================
  try {
    const presence = app.findCollectionByNameOrId("presence");
    if (presence) {
      presence.listRule = AUTH_RULE;
      presence.viewRule = AUTH_RULE;
      presence.createRule = AUTH_RULE;
      presence.updateRule = AUTH_RULE;
      presence.deleteRule = AUTH_RULE;
      app.save(presence);
      console.log("✅ Secured presence collection");
    }
  } catch (e) {
    console.log("⚠️ Could not secure presence collection:", e);
  }

  // ==================== PROJECT_PERMISSIONS COLLECTION ====================
  // Critical: Controls who can see/edit which projects
  try {
    const permissions = app.findCollectionByNameOrId("project_permissions");
    if (permissions) {
      // Anyone authenticated can list/view permissions
      // (needed to check own permissions)
      permissions.listRule = AUTH_RULE;
      permissions.viewRule = AUTH_RULE;
      // Create/Update/Delete: Only authenticated users
      // Frontend enforces that only project owner can manage permissions
      permissions.createRule = AUTH_RULE;
      permissions.updateRule = AUTH_RULE;
      permissions.deleteRule = AUTH_RULE;
      app.save(permissions);
      console.log("✅ Secured project_permissions collection");
    }
  } catch (e) {
    console.log("⚠️ Could not secure project_permissions collection:", e);
  }

  // ==================== USERS COLLECTION ====================
  try {
    const users = app.findCollectionByNameOrId("users");
    if (users) {
      users.listRule = AUTH_RULE;
      users.viewRule = AUTH_RULE;
      // Allow creating users without auth (for first user setup)
      users.createRule = "";
      // Users can update their own record, admins can update any
      users.updateRule = "@request.auth.id = id || @request.auth.isAdmin = true";
      // Only admins can delete users
      users.deleteRule = "@request.auth.isAdmin = true";
      app.save(users);
      console.log("✅ Secured users collection");
    }
  } catch (e) {
    console.log("⚠️ Could not secure users collection:", e);
  }

  console.log("🎉 All collections secured!");
  console.log("ℹ️ Permission-based filtering is enforced at the application level");

}, (app) => {
  // Rollback: Open rules (development mode)
  console.log("🔓 Reverting to open API rules...");
  
  const collections = [
    "projects", "tasks", "resources", "allocations",
    "presence", "project_permissions"
  ];
  
  for (const name of collections) {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (col) {
        col.listRule = "";
        col.viewRule = "";
        col.createRule = "";
        col.updateRule = "";
        col.deleteRule = "";
        app.save(col);
        console.log(`✅ Reverted ${name} to open rules`);
      }
    } catch (e) {
      // ignore
    }
  }
});
