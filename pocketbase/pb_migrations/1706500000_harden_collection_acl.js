/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - Harden collection ACL (server-side authorization)
 *
 * Replaces the previous "any authenticated user" list/view/write rules with
 * ownership + project_permissions checks. Public share-link reads remain via
 * `@request.query.share_token` (see 1706400000).
 *
 * Idempotent: safe to re-apply; overwrites API rules on existing collections.
 */

migrate((app) => {
  const AUTH = "@request.auth.id != ''";

  const projectOwner = "user_id = @request.auth.id";
  const projectAccess =
    "(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= id)";
  const projectShare =
    "(share_enabled = true && share_token != '' && share_token = @request.query.share_token)";
  const projectListView =
    "(" + projectOwner + ") || " + projectAccess + " || " + projectShare;

  const viaProjectOwner = "project_id.user_id = @request.auth.id";
  const viaProjectAccess =
    "(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= project_id)";
  const viaProjectEdit =
    '(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= project_id && @collection.project_permissions.permission_level ?= "edit")';
  const viaProjectShare =
    "(project_id.share_enabled = true && project_id.share_token != '' && project_id.share_token = @request.query.share_token)";
  const viaProjectRead =
    "(" + viaProjectOwner + ") || " + viaProjectAccess + " || " + viaProjectShare;
  const viaProjectWrite =
    AUTH + " && ((" + viaProjectOwner + ") || " + viaProjectEdit + ")";

  const viaTaskOwner = "task_id.project_id.user_id = @request.auth.id";
  const viaTaskAccess =
    "(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= task_id.project_id)";
  const viaTaskEdit =
    '(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= task_id.project_id && @collection.project_permissions.permission_level ?= "edit")';
  const viaTaskShare =
    "(task_id.project_id.share_enabled = true && task_id.project_id.share_token != '' && task_id.project_id.share_token = @request.query.share_token)";
  const viaTaskRead =
    "(" + viaTaskOwner + ") || " + viaTaskAccess + " || " + viaTaskShare;
  const viaTaskWrite =
    AUTH + " && ((" + viaTaskOwner + ") || " + viaTaskEdit + ")";

  const viaAllocOwner = "resource_id.task_id.project_id.user_id = @request.auth.id";
  const viaAllocAccess =
    "(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= resource_id.task_id.project_id)";
  const viaAllocEdit =
    '(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= resource_id.task_id.project_id && @collection.project_permissions.permission_level ?= "edit")';
  const viaAllocShare =
    "(resource_id.task_id.project_id.share_enabled = true && resource_id.task_id.project_id.share_token != '' && resource_id.task_id.project_id.share_token = @request.query.share_token)";
  const viaAllocRead =
    "(" + viaAllocOwner + ") || " + viaAllocAccess + " || " + viaAllocShare;
  const viaAllocWrite =
    AUTH + " && ((" + viaAllocOwner + ") || " + viaAllocEdit + ")";

  const viaColOwner = "column_id.project_id.user_id = @request.auth.id";
  const viaColAccess =
    "(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= column_id.project_id)";
  const viaColEdit =
    '(@collection.project_permissions.user_id ?= @request.auth.id && @collection.project_permissions.project_id ?= column_id.project_id && @collection.project_permissions.permission_level ?= "edit")';
  const viaColShare =
    "(column_id.project_id.share_enabled = true && column_id.project_id.share_token != '' && column_id.project_id.share_token = @request.query.share_token)";
  const viaColRead =
    "(" + viaColOwner + ") || " + viaColAccess + " || " + viaColShare;
  const viaColWrite =
    AUTH + " && ((" + viaColOwner + ") || " + viaColEdit + ")";

  const setRules = (name, rules) => {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (!col) {
        console.log("⚠️ " + name + " not found - skipping");
        return;
      }
      if (rules.listRule !== undefined) col.listRule = rules.listRule;
      if (rules.viewRule !== undefined) col.viewRule = rules.viewRule;
      if (rules.createRule !== undefined) col.createRule = rules.createRule;
      if (rules.updateRule !== undefined) col.updateRule = rules.updateRule;
      if (rules.deleteRule !== undefined) col.deleteRule = rules.deleteRule;
      app.save(col);
      console.log("✅ Hardened ACL for " + name);
    } catch (e) {
      console.log("⚠️ Could not harden " + name + ": " + e);
    }
  };

  // Projects: owner / granted users / valid share token; mutate only as owner
  setRules("projects", {
    listRule: projectListView,
    viewRule: projectListView,
    createRule: AUTH,
    updateRule: projectOwner,
    deleteRule: projectOwner,
  });

  // Planning data: read with access or share; write with owner/edit
  setRules("tasks", {
    listRule: viaProjectRead,
    viewRule: viaProjectRead,
    createRule: viaProjectWrite,
    updateRule: viaProjectWrite,
    deleteRule: viaProjectWrite,
  });

  setRules("resources", {
    listRule: viaTaskRead,
    viewRule: viaTaskRead,
    createRule: viaTaskWrite,
    updateRule: viaTaskWrite,
    deleteRule: viaTaskWrite,
  });

  setRules("allocations", {
    listRule: viaAllocRead,
    viewRule: viaAllocRead,
    createRule: viaAllocWrite,
    updateRule: viaAllocWrite,
    deleteRule: viaAllocWrite,
  });

  setRules("custom_columns", {
    listRule: viaProjectRead,
    viewRule: viaProjectRead,
    createRule: viaProjectWrite,
    updateRule: viaProjectWrite,
    deleteRule: viaProjectWrite,
  });

  setRules("custom_values", {
    listRule: viaColRead,
    viewRule: viaColRead,
    createRule: viaColWrite,
    updateRule: viaColWrite,
    deleteRule: viaColWrite,
  });

  // Presence: any project access (view or edit); not exposed via public share links
  const viaProjectPresenceWrite =
    AUTH + " && ((" + viaProjectOwner + ") || " + viaProjectAccess + ")";
  setRules("presence", {
    listRule: "(" + viaProjectOwner + ") || " + viaProjectAccess,
    viewRule: "(" + viaProjectOwner + ") || " + viaProjectAccess,
    createRule: viaProjectPresenceWrite,
    updateRule: viaProjectPresenceWrite,
    deleteRule: viaProjectPresenceWrite,
  });

  // Permissions: users see own grants; owners manage grants for their projects
  setRules("project_permissions", {
    listRule:
      "user_id = @request.auth.id || project_id.user_id = @request.auth.id",
    viewRule:
      "user_id = @request.auth.id || project_id.user_id = @request.auth.id",
    createRule: AUTH + " && project_id.user_id = @request.auth.id",
    updateRule: "project_id.user_id = @request.auth.id",
    deleteRule: "project_id.user_id = @request.auth.id",
  });

  console.log("🎉 Collection ACL hardening complete");
}, (app) => {
  // Rollback to auth-only (previous insecure baseline)
  const AUTH = "@request.auth.id != ''";
  const names = [
    "projects",
    "tasks",
    "resources",
    "allocations",
    "custom_columns",
    "custom_values",
    "presence",
    "project_permissions",
  ];
  for (const name of names) {
    try {
      const col = app.findCollectionByNameOrId(name);
      if (!col) continue;
      col.listRule = AUTH;
      col.viewRule = AUTH;
      col.createRule = AUTH;
      if (name === "projects") {
        col.updateRule = "user_id = @request.auth.id";
        col.deleteRule = "user_id = @request.auth.id";
      } else {
        col.updateRule = AUTH;
        col.deleteRule = AUTH;
      }
      app.save(col);
    } catch (e) {
      console.log("⚠️ Rollback " + name + " failed: " + e);
    }
  }
});
