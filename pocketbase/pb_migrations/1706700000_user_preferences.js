/// <reference path="../pb_data/types.d.ts" />

/**
 * TinyPlanvas - Add "preferences" JSON field to the users collection
 *
 * ADDITIVE & NON-DESTRUCTIVE:
 * - Adds an optional "json" field `preferences` ONLY if it does not exist yet.
 * - Holds per-account settings such as brush percentage presets, the brush
 *   base color and user-defined colors, so they follow the user across devices.
 * - Users can already update their own record (see 1705800000_secure_api_rules.js).
 * - The rollback only removes the field.
 */

migrate((app) => {
  let users = null;
  try {
    users = app.findCollectionByNameOrId("users");
  } catch (e) {
    users = null;
  }

  if (!users) {
    console.log("⚠️ users collection not found - skipping preferences migration");
    return;
  }

  const hasPreferences = users.fields.find((f) => f.name === "preferences");

  if (!hasPreferences) {
    users.fields.push(new Field({
      name: "preferences",
      type: "json",
      required: false,
      maxSize: 20000,
    }));
    app.save(users);
    console.log("✅ Added 'preferences' field to users");
  } else {
    console.log("ℹ️ 'preferences' field already exists");
  }
}, (app) => {
  let users = null;
  try {
    users = app.findCollectionByNameOrId("users");
  } catch (e) {
    users = null;
  }
  if (users) {
    users.fields = users.fields.filter((f) => f.name !== "preferences");
    app.save(users);
  }
});
