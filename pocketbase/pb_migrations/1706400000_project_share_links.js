/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - Public view-only share links for projects
 *
 * ADDITIVE & NON-DESTRUCTIVE:
 * - Adds `share_enabled` (bool) and `share_token` (text) to projects
 * - Updates list/view rules so unauthenticated clients can read a project
 *   (and related records) only when `share_token` matches `@request.query.share_token`
 * - Authenticated access is limited to owners + project_permissions (not all users)
 * - Create/update/delete rules stay auth-only (write ACL hardened in 1706500000)
 */

migrate((app) => {
  const OWNER = "user_id = @request.auth.id";
  const HAS_ACCESS =
    "(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= id)";
  const SHARE_MATCH =
    "share_enabled = true && share_token != '' && share_token = @request.query.share_token";
  const PROJECT_LIST_VIEW =
    "(" + OWNER + ") || " + HAS_ACCESS + " || (" + SHARE_MATCH + ")";

  const VIA_PROJECT_OWNER = "project_id.user_id = @request.auth.id";
  const VIA_PROJECT_PERM =
    "(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= project_id)";
  const VIA_PROJECT_SHARE =
    "(project_id.share_enabled = true && project_id.share_token != '' && project_id.share_token = @request.query.share_token)";
  const VIA_PROJECT =
    "(" + VIA_PROJECT_OWNER + ") || " + VIA_PROJECT_PERM + " || " + VIA_PROJECT_SHARE;

  const VIA_TASK_OWNER = "task_id.project_id.user_id = @request.auth.id";
  const VIA_TASK_PERM =
    "(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= task_id.project_id)";
  const VIA_TASK_SHARE =
    "(task_id.project_id.share_enabled = true && task_id.project_id.share_token != '' && task_id.project_id.share_token = @request.query.share_token)";
  const VIA_TASK_PROJECT =
    "(" + VIA_TASK_OWNER + ") || " + VIA_TASK_PERM + " || " + VIA_TASK_SHARE;

  const VIA_ALLOC_OWNER = "resource_id.task_id.project_id.user_id = @request.auth.id";
  const VIA_ALLOC_PERM =
    "(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= resource_id.task_id.project_id)";
  const VIA_ALLOC_SHARE =
    "(resource_id.task_id.project_id.share_enabled = true && resource_id.task_id.project_id.share_token != '' && resource_id.task_id.project_id.share_token = @request.query.share_token)";
  const VIA_RESOURCE_TASK_PROJECT =
    "(" + VIA_ALLOC_OWNER + ") || " + VIA_ALLOC_PERM + " || " + VIA_ALLOC_SHARE;

  const VIA_COL_OWNER = "column_id.project_id.user_id = @request.auth.id";
  const VIA_COL_PERM =
    "(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= column_id.project_id)";
  const VIA_COL_SHARE =
    "(column_id.project_id.share_enabled = true && column_id.project_id.share_token != '' && column_id.project_id.share_token = @request.query.share_token)";
  const VIA_COLUMN_PROJECT =
    "(" + VIA_COL_OWNER + ") || " + VIA_COL_PERM + " || " + VIA_COL_SHARE;

  const AUTH_RULE = "@request.auth.id != ''";

  // ==================== Fields on projects ====================
  const projects = app.findCollectionByNameOrId("projects");
  if (!projects) {
    console.log("⚠️ projects collection not found - skipping share links migration");
    return;
  }

  const hasShareEnabled = projects.fields.find((f) => f.name === "share_enabled");
  if (!hasShareEnabled) {
    projects.fields.push(
      new Field({
        name: "share_enabled",
        type: "bool",
        required: false,
      })
    );
    console.log("✅ Added 'share_enabled' field to projects");
  } else {
    console.log("ℹ️ 'share_enabled' field already exists");
  }

  const hasShareToken = projects.fields.find((f) => f.name === "share_token");
  if (!hasShareToken) {
    projects.fields.push(
      new Field({
        name: "share_token",
        type: "text",
        required: false,
        max: 128,
      })
    );
    console.log("✅ Added 'share_token' field to projects");
  } else {
    console.log("ℹ️ 'share_token' field already exists");
  }

  // Unique token when present (empty/null tokens excluded)
  const indexes = Array.isArray(projects.indexes) ? [...projects.indexes] : [];
  const tokenIndex =
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_share_token ON projects (share_token) WHERE share_token != ''";
  if (!indexes.some((idx) => String(idx).includes("idx_projects_share_token"))) {
    indexes.push(tokenIndex);
    projects.indexes = indexes;
    console.log("✅ Added unique index on share_token");
  }

  projects.listRule = PROJECT_LIST_VIEW;
  projects.viewRule = PROJECT_LIST_VIEW;
  // Keep owner-only mutations
  projects.updateRule = OWNER;
  projects.deleteRule = OWNER;
  if (!projects.createRule) {
    projects.createRule = AUTH_RULE;
  }
  app.save(projects);
  console.log("✅ Updated projects share fields + list/view rules");

  // ==================== Related collections (view/list only) ====================
  const updateRules = (name, listViewRule) => {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (!col) {
        console.log("⚠️ " + name + " not found - skipping");
        return;
      }
      col.listRule = listViewRule;
      col.viewRule = listViewRule;
      // Ensure writes stay authenticated (full write ACL in 1706500000)
      if (!col.createRule) col.createRule = AUTH_RULE;
      if (!col.updateRule) col.updateRule = AUTH_RULE;
      if (!col.deleteRule) col.deleteRule = AUTH_RULE;
      app.save(col);
      console.log("✅ Updated list/view rules for " + name);
    } catch (e) {
      console.log("⚠️ Could not update " + name + ": " + e);
    }
  };

  updateRules("tasks", VIA_PROJECT);
  updateRules("resources", VIA_TASK_PROJECT);
  updateRules("allocations", VIA_RESOURCE_TASK_PROJECT);
  updateRules("custom_columns", VIA_PROJECT);
  updateRules("custom_values", VIA_COLUMN_PROJECT);

  console.log("🎉 Project share links migration complete");
}, (app) => {
  const AUTH_RULE = "@request.auth.id != ''";

  try {
    const projects = app.findCollectionByNameOrId("projects");
    if (projects) {
      projects.fields = projects.fields.filter(
        (f) => f.name !== "share_enabled" && f.name !== "share_token"
      );
      projects.indexes = (projects.indexes || []).filter(
        (idx) => !String(idx).includes("idx_projects_share_token")
      );
      projects.listRule = AUTH_RULE;
      projects.viewRule = AUTH_RULE;
      app.save(projects);
    }
  } catch (e) {
    console.log("⚠️ Rollback projects failed: " + e);
  }

  for (const name of ["tasks", "resources", "allocations", "custom_columns", "custom_values"]) {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (col) {
        col.listRule = AUTH_RULE;
        col.viewRule = AUTH_RULE;
        app.save(col);
      }
    } catch (e) {
      console.log("⚠️ Rollback " + name + " failed: " + e);
    }
  }
});
