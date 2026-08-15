// EPiKK Project Portal — js/data.js
// Supabase-backed replacement for mock-data.js. It populates the SAME global
// names mock-data.js used (USERS, PROJECTS, ACTIVITY, NOTIFICATIONS,
// CURRENT_USER) and the same helper functions (userById, projById,
// visibleProjects), so app.js and every page's inline script keep working
// with almost no changes.
//
// Usage on every page: `await loadAppData();` once, BEFORE calling
// initChrome() or reading USERS/PROJECTS/etc. See pages/*.html for the
// one-line change this requires in each page's DOMContentLoaded handler.

let USERS = [];
let PROJECTS = [];
let ACTIVITY = [];
let NOTIFICATIONS = [];
let CURRENT_USER = null;

function userById(id) { return USERS.find(u => u.id === id); }
function projById(id) { return PROJECTS.find(p => p.id === id); }

function visibleProjects(user) {
  if (user.role === 'super_admin') return PROJECTS;
  if (user.role === 'engineer') return PROJECTS.filter(p => p.engineerId === user.id);
  return PROJECTS.filter(p => p.clientId === user.id);
}

// ---- row -> mock-data-shape mappers (snake_case DB columns -> camelCase fields) ----
function mapUser(row) {
  return {
    id: row.id, fullName: row.full_name, username: row.username, email: row.email,
    role: row.role, status: row.status, lastLogin: row.last_login, createdAt: row.created_at,
  };
}
function mapTask(row) { return { id: row.id, title: row.title, done: row.done, milestoneId: row.milestone_id }; }
function mapMilestone(row) { return { id: row.id, title: row.title, completed: row.completed, targetDate: row.target_date }; }
function mapFile(row) { return { id: row.id, filename: row.filename, type: row.type, uploaderId: row.uploader_id, uploadedAt: row.uploaded_at, size: row.size, storagePath: row.storage_path }; }
function mapTimeline(row) { return { id: row.id, title: row.title, description: row.description, visibility: row.visibility, createdBy: row.created_by, createdAt: row.created_at }; }
function mapDiscussion(row) { return { id: row.id, userId: row.user_id || 'system', message: row.message, createdAt: row.created_at }; }
function mapActivity(row) { return { id: row.id, userId: row.user_id, action: row.action, projectId: row.project_id, timestamp: row.created_at }; }
function mapNotification(row) { return { id: row.id, message: row.message, createdAt: row.created_at, read: row.read }; }
function mapProject(row, children) {
  return {
    id: row.id, title: row.title, description: row.description,
    category: row.category, subtype: row.subtype,
    clientId: row.client_id, engineerId: row.engineer_id,
    status: row.status, progress: row.progress, budget: row.budget,
    dueDate: row.due_date, priority: row.priority, tags: row.tags || [],
    lastUpdated: row.last_updated, createdAt: row.created_at,
    tasks: children.tasks.map(mapTask),
    milestones: children.milestones.map(mapMilestone),
    files: children.files.map(mapFile),
    timeline: children.timeline.map(mapTimeline),
    discussion: children.discussion.map(mapDiscussion),
  };
}

// ---- main bootstrap. Call once per page before touching USERS/PROJECTS/etc ----
async function loadAppData() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'index.html'; return false; }

  const { data: myProfileRow, error: profileError } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if (profileError || !myProfileRow) { console.error(profileError); window.location.href = 'index.html'; return false; }
  CURRENT_USER = mapUser(myProfileRow);

  const { data: userRows } = await sb.from('profiles').select('*').order('created_at');
  USERS = (userRows || []).map(mapUser);

  const { data: projectRows } = await sb.from('projects').select('*').order('last_updated', { ascending: false });
  const ids = (projectRows || []).map((p) => p.id);
  const safeIds = ids.length ? ids : ['00000000-0000-0000-0000-000000000000']; // avoid empty .in() filter

  const [{ data: taskRows }, { data: milestoneRows }, { data: fileRows }, { data: timelineRows }, { data: discussionRows }] = await Promise.all([
    sb.from('tasks').select('*').in('project_id', safeIds),
    sb.from('milestones').select('*').in('project_id', safeIds),
    sb.from('files').select('*').in('project_id', safeIds),
    sb.from('timeline_events').select('*').in('project_id', safeIds),
    sb.from('discussion_messages').select('*').in('project_id', safeIds),
  ]);

  PROJECTS = (projectRows || []).map((row) =>
    mapProject(row, {
      tasks: (taskRows || []).filter((t) => t.project_id === row.id),
      milestones: (milestoneRows || []).filter((m) => m.project_id === row.id),
      files: (fileRows || []).filter((f) => f.project_id === row.id),
      timeline: (timelineRows || []).filter((t) => t.project_id === row.id),
      discussion: (discussionRows || []).filter((d) => d.project_id === row.id),
    }),
  );

  const { data: activityRows } = await sb.from('activity_log').select('*').order('created_at', { ascending: false });
  ACTIVITY = (activityRows || []).map(mapActivity);

  const { data: notifRows } = await sb.from('notifications').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
  NOTIFICATIONS = (notifRows || []).map(mapNotification);

  return true;
}
