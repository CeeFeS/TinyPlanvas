// i18n translations for TinyPlanvas
// Supports German (de) and English (en)

export type Language = 'de' | 'en'

export const LANGUAGE_NAMES: Record<Language, string> = {
  de: 'Deutsch',
  en: 'English',
}

// All translations organized by component/feature
export const translations = {
  // Common / Shared
  common: {
    loading: { de: 'Laden...', en: 'Loading...' },
    error: { de: 'Fehler', en: 'Error' },
    save: { de: 'Speichern', en: 'Save' },
    cancel: { de: 'Abbrechen', en: 'Cancel' },
    delete: { de: 'Löschen', en: 'Delete' },
    edit: { de: 'Bearbeiten', en: 'Edit' },
    close: { de: 'Schließen', en: 'Close' },
    add: { de: 'Hinzufügen', en: 'Add' },
    create: { de: 'Erstellen', en: 'Create' },
    back: { de: 'Zurück', en: 'Back' },
    done: { de: 'Fertig', en: 'Done' },
    yes: { de: 'Ja', en: 'Yes' },
    no: { de: 'Nein', en: 'No' },
    search: { de: 'Suchen', en: 'Search' },
    you: { de: 'Du', en: 'You' },
    unnamed: { de: 'Unbenannt', en: 'Unnamed' },
    unknown: { de: 'Unbekannt', en: 'Unknown' },
    projects: { de: 'Projekte', en: 'Projects' },
    settings: { de: 'Einstellungen', en: 'Settings' },
    today: { de: 'Heute', en: 'Today' },
  },

  // Auth / Login
  auth: {
    login: { de: 'Anmelden', en: 'Sign In' },
    loggingIn: { de: 'Anmelden...', en: 'Signing In...' },
    logout: { de: 'Abmelden', en: 'Sign Out' },
    email: { de: 'E-Mail', en: 'Email' },
    password: { de: 'Passwort', en: 'Password' },
    emailPlaceholder: { de: 'name@beispiel.de', en: 'name@example.com' },
    loginTitle: { de: 'Melde dich an, um fortzufahren', en: 'Sign in to continue' },
    loginError: { de: 'Bitte E-Mail und Passwort eingeben', en: 'Please enter email and password' },
    invalidCredentials: { de: 'Ungültige Anmeldedaten. Bitte überprüfe E-Mail und Passwort.', en: 'Invalid credentials. Please check your email and password.' },
    genericError: { de: 'Ein Fehler ist aufgetreten', en: 'An error occurred' },
    contactAdmin: { de: 'Wende dich an einen Administrator,\nfalls du keinen Zugang hast.', en: 'Contact an administrator\nif you don\'t have access.' },
    notLoggedIn: { de: 'Nicht angemeldet', en: 'Not logged in' },
  },

  // Setup Screen
  setup: {
    welcome: { de: 'Willkommen bei TinyPlanvas!', en: 'Welcome to TinyPlanvas!' },
    createAdmin: { de: 'Erstelle deinen ersten Administrator-Account', en: 'Create your first admin account' },
    initialSetup: { de: 'Ersteinrichtung', en: 'Initial Setup' },
    firstUserInfo: { de: 'Dies ist der erste Benutzer und wird automatisch als Administrator angelegt.', en: 'This is the first user and will be automatically created as an administrator.' },
    yourName: { de: 'Dein Name', en: 'Your Name' },
    namePlaceholder: { de: 'Max Mustermann', en: 'John Doe' },
    adminEmailPlaceholder: { de: 'admin@beispiel.de', en: 'admin@example.com' },
    minChars: { de: 'Min. 8 Zeichen', en: 'Min. 8 characters' },
    fillAllFields: { de: 'Bitte alle Felder ausfüllen', en: 'Please fill in all fields' },
    minPassword: { de: 'Passwort muss mindestens 8 Zeichen haben', en: 'Password must be at least 8 characters' },
    createAdminError: { de: 'Fehler beim Erstellen des Administrators', en: 'Error creating administrator' },
    settingUp: { de: 'Wird eingerichtet...', en: 'Setting up...' },
    createAdminBtn: { de: 'Administrator erstellen', en: 'Create Administrator' },
  },

  // Header
  header: {
    newProject: { de: 'Neues Projekt', en: 'New Project' },
    administrator: { de: 'Administrator', en: 'Administrator' },
  },

  // Sidebar
  sidebar: {
    closeSidebar: { de: 'Sidebar schließen', en: 'Close Sidebar' },
    noProjects: { de: 'Noch keine Projekte vorhanden', en: 'No projects yet' },
  },

  // Settings Modal
  settings: {
    title: { de: 'Einstellungen', en: 'Settings' },
    subtitle: { de: 'Konto & Verwaltung', en: 'Account & Management' },
    profile: { de: 'Profil', en: 'Profile' },
    administration: { de: 'Administration', en: 'Administration' },
    language: { de: 'Sprache', en: 'Language' },
    languageDesc: { de: 'Wähle die Sprache der Benutzeroberfläche', en: 'Choose the interface language' },
  },

  // Profile Panel
  profile: {
    yourProfile: { de: 'Dein Profil', en: 'Your Profile' },
    accountInfo: { de: 'Kontoinformationen', en: 'Account Information' },
    userId: { de: 'Benutzer-ID', en: 'User ID' },
    emailVerified: { de: 'E-Mail verifiziert', en: 'Email Verified' },
    role: { de: 'Rolle', en: 'Role' },
    administrator: { de: 'Administrator', en: 'Administrator' },
    user: { de: 'Benutzer', en: 'User' },
    createdAt: { de: 'Erstellt am', en: 'Created On' },
  },

  // Admin Panel
  admin: {
    title: { de: 'Administration', en: 'Administration' },
    subtitle: { de: 'Verwalte Benutzer und Projekt-Berechtigungen', en: 'Manage users and project permissions' },
    users: { de: 'Benutzer', en: 'Users' },
    projectPermissions: { de: 'Projekt-Berechtigungen', en: 'Project Permissions' },
    searchUsers: { de: 'Benutzer suchen...', en: 'Search users...' },
    addUser: { de: 'Benutzer hinzufügen', en: 'Add User' },
    loadingError: { de: 'Fehler beim Laden der Benutzer', en: 'Error loading users' },
    cannotChangeOwnAdmin: { de: 'Du kannst deinen eigenen Admin-Status nicht ändern', en: 'You cannot change your own admin status' },
    adminToggleError: { de: 'Fehler beim Ändern des Admin-Status', en: 'Error changing admin status' },
    cannotDeleteSelf: { de: 'Du kannst dich nicht selbst löschen', en: 'You cannot delete yourself' },
    deleteConfirm: { de: 'Möchtest du diesen Benutzer wirklich löschen?', en: 'Do you really want to delete this user?' },
    deleteUserError: { de: 'Fehler beim Löschen des Benutzers', en: 'Error deleting user' },
    noUsersFound: { de: 'Keine Benutzer gefunden', en: 'No users found' },
    noUsersYet: { de: 'Noch keine Benutzer vorhanden', en: 'No users yet' },
    revokeAdmin: { de: 'Admin-Rechte entziehen', en: 'Revoke admin rights' },
    makeAdmin: { de: 'Zum Admin machen', en: 'Make admin' },
    deleteUser: { de: 'Benutzer löschen', en: 'Delete user' },
    addUserTitle: { de: 'Neuen Benutzer hinzufügen', en: 'Add New User' },
    name: { de: 'Name', en: 'Name' },
    createAsAdmin: { de: 'Als Administrator anlegen', en: 'Create as administrator' },
    createUserError: { de: 'Fehler beim Erstellen des Benutzers. E-Mail evtl. bereits vergeben.', en: 'Error creating user. Email may already be in use.' },
    selectProject: { de: 'Projekt auswählen', en: 'Select Project' },
    permissionsFor: { de: 'Berechtigungen für', en: 'Permissions for' },
    addPermission: { de: 'Berechtigung hinzufügen', en: 'Add Permission' },
    adminsHaveFullAccess: { de: 'Administratoren haben automatisch vollen Zugriff auf alle Projekte.', en: 'Administrators automatically have full access to all projects.' },
    noPermissionsYet: { de: 'Keine spezifischen Berechtigungen vergeben', en: 'No specific permissions assigned' },
    view: { de: 'Ansehen', en: 'View' },
    edit: { de: 'Bearbeiten', en: 'Edit' },
    removePermission: { de: 'Berechtigung entfernen', en: 'Remove permission' },
    selectUser: { de: 'Benutzer auswählen...', en: 'Select user...' },
    permission: { de: 'Berechtigung', en: 'Permission' },
    viewOnly: { de: 'Nur Lesezugriff', en: 'Read-only access' },
    fullAccess: { de: 'Vollzugriff', en: 'Full access' },
    noProjectsYet: { de: 'Noch keine Projekte vorhanden', en: 'No projects yet' },
    loadingDataError: { de: 'Fehler beim Laden der Daten', en: 'Error loading data' },
    loadingPermissionsError: { de: 'Fehler beim Laden der Berechtigungen', en: 'Error loading permissions' },
    updatePermissionError: { de: 'Fehler beim Aktualisieren der Berechtigung', en: 'Error updating permission' },
    deletePermissionError: { de: 'Fehler beim Entfernen der Berechtigung', en: 'Error removing permission' },
    addPermissionError: { de: 'Fehler beim Hinzufügen der Berechtigung', en: 'Error adding permission' },
  },

  // Dashboard / Projects Page
  dashboard: {
    myProjects: { de: 'Meine Projekte', en: 'My Projects' },
    projectOverview: { de: 'Übersicht aller Ressourcen-Planungen', en: 'Overview of all resource plans' },
    loadingError: { de: 'Fehler beim Laden der Projekte', en: 'Error loading projects' },
    deleteConfirm: { de: 'Möchtest du dieses Projekt wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.', en: 'Do you really want to delete this project? This action cannot be undone.' },
    deleteError: { de: 'Fehler beim Löschen des Projekts', en: 'Error deleting project' },
    project: { de: 'Projekt', en: 'Project' },
    projectsCount: { de: 'Projekte', en: 'Projects' },
    noProjects: { de: 'Noch keine Projekte', en: 'No Projects Yet' },
    noProjectsDesc: { de: 'Erstelle dein erstes Projekt, um mit der Ressourcen-Planung zu beginnen.', en: 'Create your first project to start resource planning.' },
    createFirstProject: { de: 'Erstes Projekt erstellen', en: 'Create First Project' },
    shareProject: { de: 'Projekt teilen', en: 'Share Project' },
    deleteProject: { de: 'Projekt löschen', en: 'Delete Project' },
    owner: { de: 'Besitzer', en: 'Owner' },
    shared: { de: 'Geteilt', en: 'Shared' },
    createdAt: { de: 'Angelegt', en: 'Created' },
    updatedAt: { de: 'Aktualisiert', en: 'Updated' },
    resolution: { de: 'Auflösung', en: 'Resolution' },
  },

  // Resolution labels
  resolutions: {
    day: { de: 'Tag', en: 'Day' },
    days: { de: 'Tage', en: 'Days' },
    week: { de: 'Woche', en: 'Week' },
    weeks: { de: 'Wochen', en: 'Weeks' },
    month: { de: 'Monat', en: 'Month' },
    months: { de: 'Monate', en: 'Months' },
    year: { de: 'Jahr', en: 'Year' },
    years: { de: 'Jahre', en: 'Years' },
    dayPlanning: { de: 'Tagesgenaue Planung', en: 'Day-by-day planning' },
    weekPlanning: { de: 'Wochenbasierte Planung', en: 'Week-based planning' },
    monthPlanning: { de: 'Monatsbasierte Planung', en: 'Month-based planning' },
    yearPlanning: { de: 'Jahresbasierte Planung', en: 'Year-based planning' },
  },

  // Duration labels
  duration: {
    year: { de: 'Jahr', en: 'year' },
    years: { de: 'Jahre', en: 'years' },
    month: { de: 'Monat', en: 'month' },
    months: { de: 'Monate', en: 'months' },
    day: { de: 'Tag', en: 'day' },
    days: { de: 'Tage', en: 'days' },
    duration: { de: 'Dauer', en: 'Duration' },
  },

  // New Project Page
  newProject: {
    title: { de: 'Neues Projekt', en: 'New Project' },
    projectName: { de: 'Projektname', en: 'Project Name' },
    projectNamePlaceholder: { de: 'z.B. Produktentwicklung 2026', en: 'e.g. Product Development 2026' },
    resolution: { de: 'Auflösung', en: 'Resolution' },
    period: { de: 'Zeitraum', en: 'Period' },
    start: { de: 'Start', en: 'Start' },
    end: { de: 'Ende', en: 'End' },
    startDate: { de: 'Startdatum', en: 'Start Date' },
    endDate: { de: 'Enddatum', en: 'End Date' },
    selectDate: { de: 'Datum wählen', en: 'Select Date' },
    createProject: { de: 'Projekt erstellen', en: 'Create Project' },
    creating: { de: 'Wird erstellt...', en: 'Creating...' },
    nameRequired: { de: 'Bitte geben Sie einen Projektnamen ein.', en: 'Please enter a project name.' },
    datesRequired: { de: 'Bitte wählen Sie Start- und Enddatum.', en: 'Please select start and end dates.' },
    startBeforeEnd: { de: 'Das Startdatum muss vor dem Enddatum liegen.', en: 'Start date must be before end date.' },
    createError: { de: 'Projekt konnte nicht erstellt werden. Bitte versuchen Sie es erneut.', en: 'Project could not be created. Please try again.' },
  },

  // Project Detail Page
  projectDetail: {
    projectLoading: { de: 'Projekt wird geladen...', en: 'Loading project...' },
    accessDenied: { de: 'Zugriff verweigert', en: 'Access Denied' },
    noPermission: { de: 'Du hast keine Berechtigung für dieses Projekt.', en: 'You do not have permission for this project.' },
    backToOverview: { de: 'Zurück zur Übersicht', en: 'Back to Overview' },
    loadingError: { de: 'Fehler beim Laden', en: 'Error Loading' },
    projectName: { de: 'Projektbezeichnung', en: 'Project Name' },
    start: { de: 'Start', en: 'Start' },
    end: { de: 'Ende', en: 'End' },
    resolution: { de: 'Auflösung', en: 'Resolution' },
    readOnly: { de: 'Nur Lesezugriff', en: 'Read-only Access' },
    usersOnline: { de: 'Nutzer online', en: 'users online' },
    aloneHere: { de: 'Du bist alleine hier', en: 'You\'re alone here' },
    liveSyncActive: { de: 'Live-Sync aktiv', en: 'Live sync active' },
  },

  // Planning Grid
  grid: {
    task: { de: 'Aufgabe', en: 'Task' },
    resource: { de: 'Ressource', en: 'Resource' },
    start: { de: 'Beginn', en: 'Start' },
    end: { de: 'Ende', en: 'End' },
    total: { de: 'Σ', en: 'Σ' },
    expandAll: { de: 'Alle ausklappen', en: 'Expand all' },
    collapseAll: { de: 'Alle einklappen', en: 'Collapse all' },
    newTask: { de: 'Neue Aufgabe...', en: 'New task...' },
    newResource: { de: '+ Ressource...', en: '+ Resource...' },
    clickToEdit: { de: 'Klicken zum Bearbeiten', en: 'Click to edit' },
    deleteTask: { de: 'Aufgabe löschen', en: 'Delete task' },
    deleteResource: { de: 'Ressource löschen', en: 'Delete resource' },
    deleteTaskConfirm: { de: 'wirklich löschen? Alle zugehörigen Ressourcen werden ebenfalls gelöscht.', en: 'really delete? All associated resources will also be deleted.' },
    deleteResourceConfirm: { de: 'wirklich löschen?', en: 'really delete?' },
    clickToAssign: { de: 'Klicken zum Zuweisen', en: 'Click to assign' },
    resourceSummary: { de: 'Ressourcen-Übersicht', en: 'Resource Summary' },
    resources: { de: 'Ressourcen', en: 'Resources' },
    resourceSum: { de: 'Ressource (Summe)', en: 'Resource (Sum)' },
    minPercent: { de: 'Min %', en: 'Min %' },
    maxPercent: { de: 'Max %', en: 'Max %' },
    editMinAllocation: { de: 'Min. Auslastung bearbeiten', en: 'Edit min. allocation' },
    editMaxAllocation: { de: 'Max. Auslastung bearbeiten', en: 'Edit max. allocation' },
    overload: { de: 'Überbelastung', en: 'Overload' },
    underload: { de: 'Unterauslastung', en: 'Underload' },
    backTime: { de: 'Zurück', en: 'Back' },
    forwardTime: { de: 'Weiter', en: 'Forward' },
    atStart: { de: 'Am Anfang', en: 'At start' },
    atEnd: { de: 'Am Ende', en: 'At end' },
    tenYears: { de: '10 Jahre', en: '10 years' },
    oneYear: { de: '1 Jahr', en: '1 year' },
    fourMonths: { de: '4 Monate', en: '4 months' },
    oneMonth: { de: '1 Monat', en: '1 month' },
  },

  // Brush Editor
  brush: {
    baseColor: { de: 'Grundfarbe', en: 'Base Color' },
    resourceUsage: { de: 'Ressourceneinsatz', en: 'Resource Allocation' },
    saveNewValue: { de: 'Neuen Prozentwert speichern', en: 'Save new percentage value' },
    placeholder: { de: 'z.B. 33.5', en: 'e.g. 33.5' },
    maxReached: { de: 'Maximum erreicht', en: 'Maximum reached' },
    customValues: { de: 'eigene Werte', en: 'custom values' },
    addCustomValue: { de: 'Eigenen Wert hinzufügen', en: 'Add custom value' },
    intensityScale: { de: 'Intensitäts-Skala', en: 'Intensity Scale' },
    activeBrush: { de: 'Aktiver Pinsel', en: 'Active Brush' },
  },

  // Share Modal
  share: {
    title: { de: 'Projekt teilen', en: 'Share Project' },
    description: { de: 'Wähle Benutzer aus, mit denen du dieses Projekt teilen möchtest.', en: 'Select users to share this project with.' },
    readPermission: { de: 'Lesen', en: 'View' },
    editPermission: { de: 'Bearbeiten', en: 'Edit' },
    permissionDesc: { de: 'Du kannst {read} (nur ansehen) oder {edit} (ändern) vergeben.', en: 'You can grant {read} (view only) or {edit} (modify) access.' },
    searchUsers: { de: 'Benutzer suchen...', en: 'Search users...' },
    notSharedYet: { de: 'Noch mit niemandem geteilt', en: 'Not shared with anyone yet' },
    sharedWith: { de: 'Mit {count} {userWord} geteilt', en: 'Shared with {count} {userWord}' },
    noUsersFound: { de: 'Keine Benutzer gefunden', en: 'No users found' },
    noOtherUsers: { de: 'Keine anderen Benutzer vorhanden', en: 'No other users available' },
    readOnlyTitle: { de: 'Nur Lesen', en: 'View Only' },
    editTitle: { de: 'Bearbeiten', en: 'Edit' },
    removeAccess: { de: 'Zugriff entfernen', en: 'Remove access' },
    grantReadAccess: { de: 'Lesezugriff geben', en: 'Grant view access' },
    grantEditAccess: { de: 'Bearbeitungszugriff geben', en: 'Grant edit access' },
    loadError: { de: 'Fehler beim Laden', en: 'Error loading' },
    saveError: { de: 'Fehler beim Speichern', en: 'Error saving' },
    removeError: { de: 'Fehler beim Entfernen', en: 'Error removing' },
  },

  // Date Picker
  datePicker: {
    selectDate: { de: 'Datum wählen', en: 'Select date' },
    prevYear: { de: 'Vorheriges Jahr', en: 'Previous year' },
    nextYear: { de: 'Nächstes Jahr', en: 'Next year' },
    prevMonth: { de: 'Vorheriger Monat', en: 'Previous month' },
    nextMonth: { de: 'Nächster Monat', en: 'Next month' },
    today: { de: 'Heute', en: 'Today' },
    close: { de: 'Schließen', en: 'Close' },
    // Weekdays (short)
    mon: { de: 'Mo', en: 'Mo' },
    tue: { de: 'Di', en: 'Tu' },
    wed: { de: 'Mi', en: 'We' },
    thu: { de: 'Do', en: 'Th' },
    fri: { de: 'Fr', en: 'Fr' },
    sat: { de: 'Sa', en: 'Sa' },
    sun: { de: 'So', en: 'Su' },
  },
} as const

// Type for translation keys
export type TranslationKeys = typeof translations

// Helper to get a translation
export function t(
  category: keyof TranslationKeys,
  key: string,
  lang: Language
): string {
  const categoryTranslations = translations[category] as Record<string, Record<Language, string>>
  const translation = categoryTranslations?.[key]
  if (!translation) {
    console.warn(`Missing translation: ${category}.${key}`)
    return key
  }
  return translation[lang] || translation.en || key
}

// Date locale helper
export function getDateLocale(lang: Language) {
  if (lang === 'de') {
    return import('date-fns/locale').then(m => m.de)
  }
  return import('date-fns/locale').then(m => m.enUS)
}

// Locale string for date formatting
export function getDateLocaleString(lang: Language): string {
  return lang === 'de' ? 'de-DE' : 'en-US'
}
