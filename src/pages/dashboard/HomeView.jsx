import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DASHBOARD_BASE } from '../../paths';
import { useLang } from '../../context/LangContext';
import { useAuth } from '../../context/AuthContext';
import { getClients, getTasks, getEvents, getActivity, createEvent, updateEvent, deleteEvent, getTeamMembers, getWorkspaces, getPortalActivity } from '../../api';
import { useState, useMemo } from 'react';
import EventDayModal from './EventDayModal';
import EventFormModal from '../../components/EventFormModal';
import { sortEventsBySchedule, formatEventTime } from '../../utils/dateTimeFormat';
import { getAssigneeInitials, getAssigneeMonogramStyle } from '../../utils/eventAssignee';
import { emptyEventForm, eventToFormState, joinDateAndTimeForLocalInput } from '../../utils/eventFormState';

const MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
const DS_NL  = ['Zo','Ma','Di','Wo','Do','Vr','Za'];
const DL_NL  = ['Zondag','Maandag','Dinsdag','Woensdag','Donderdag','Vrijdag','Zaterdag'];
const TYPE_CLS = { Shoot:'chip-shoot', Edit:'chip-edit', Deadline:'chip-deadline', Call:'chip-call', Delivery:'chip-delivery' };
function getMon(d) {
  const r = new Date(d); const dw = r.getDay();
  r.setDate(r.getDate() + (dw===0 ? -6 : 1 - dw)); return r;
}
function dStr(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function sameD(a,b) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function toDateString(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, '-');
  const dmyMatch = normalized.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  const short = trimmed.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(short)) return short;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return dStr(parsed);
}
function isInMonth(value, month, year) {
  const ds = toDateString(value);
  if (!ds) return false;
  const dt = new Date(`${ds}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getMonth() === month && dt.getFullYear() === year;
}
function getTaskDayItems(tasks, ds) {
  return tasks
    .filter((task) => toDateString(task.dueDate) === ds)
    .map((task) => ({
      id: task._id,
      kind: 'task',
      title: task.title || 'Task',
      meta: task.assignee || task.client || '',
      perspectiveLabel: 'Due date',
    }));
}
function getWorkspaceDayItems(workspaces, ds) {
  const items = [];
  workspaces.forEach((workspace) => {
    const deadline = toDateString(workspace.deadline);
    const shootDate = toDateString(workspace.shootDate);
    if (shootDate === ds) {
      items.push({
        id: `${workspace._id}-shoot`,
        workspaceId: workspace._id,
        kind: 'workspace',
        title: workspace.name || 'Workspace',
        meta: workspace.client || workspace.editor || '',
        perspectiveLabel: 'Shoot date',
      });
    }
    if (deadline === ds) {
      items.push({
        id: `${workspace._id}-deadline`,
        workspaceId: workspace._id,
        kind: 'workspace',
        title: workspace.name || 'Workspace',
        meta: workspace.client || workspace.editor || '',
        perspectiveLabel: 'Deadline',
      });
    }
  });
  return items;
}
function getDayItemChipStyle(item) {
  if (item.kind === 'workspace' && item.perspectiveLabel === 'Shoot date') {
    return { background: 'var(--amber)', color: '#1b1b1f' };
  }
  if (item.kind === 'workspace' && item.perspectiveLabel === 'Deadline') {
    return { background: '#e05050', color: '#ffffff' };
  }
  return { background: 'var(--bg-alt)', color: 'var(--text-2)' };
}

function WeekGrid({ start, events, tasks, workspaces, onDayClick, isTeam, locale, isLoading }) {
  const TODAY = new Date(); TODAY.setHours(0,0,0,0);
  return (
    <div className="week-grid">
      {Array.from({length:7}, (_,i) => {
        const d = new Date(start); d.setDate(start.getDate()+i);
        const ds = dStr(d);
        const isT = sameD(d, TODAY);
        const isP = d < TODAY;
        const dayEvs = sortEventsBySchedule(events.filter(e => e.date === ds));
        const dayTasks = getTaskDayItems(tasks, ds);
        const dayWorkspaces = getWorkspaceDayItems(workspaces, ds);
        const dayItems = [
          ...dayEvs.map((event) => ({ id: event._id, kind: 'event', event })),
          ...dayTasks,
          ...dayWorkspaces,
        ];
        return (
          <div
            key={ds}
            role={isP ? undefined : 'button'}
            tabIndex={isP ? undefined : 0}
            className={`day-cell${isT?' today':''}${isP?' past':''}`}
            onClick={() => { if (!isP) onDayClick(ds); }}
            onKeyDown={(e) => {
              if (isP) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onDayClick(ds);
              }
            }}
          >
            <div className="day-header">
              <div className="day-name">{DS_NL[d.getDay()]}</div>
              <div className="day-num">{d.getDate()}</div>
            </div>
            <div className="event-chips">
              {isLoading ? (
                Array.from({ length: 2 }).map((_, idx) => (
                  <div key={`${ds}-skeleton-chip-${idx}`} className="chip event-chip-row event-chip-skeleton" aria-hidden>
                    <span className="event-chip-name home-skeleton-line home-skeleton-shimmer" />
                    <span className="event-chip-time home-skeleton-line home-skeleton-shimmer" />
                  </div>
                ))
              ) : dayItems.slice(0,3).map((item) => {
                if (item.kind === 'event') {
                  const e = item.event;
                  const initials = getAssigneeInitials(e, { maxLength: 2 });
                  const monoStyle = getAssigneeMonogramStyle(e);
                  const assigneeName = e.assigneeId && typeof e.assigneeId === 'object' ? e.assigneeId.name : '';
                  const timeDisp = formatEventTime(e.time, locale, { hour12: true });
                  return (
                    <div
                      key={e._id}
                      role={isTeam && !isP ? 'button' : undefined}
                      tabIndex={isTeam && !isP ? 0 : undefined}
                      className={`chip event-chip-row ${TYPE_CLS[e.type]||'chip-shoot'}`}
                      title={e.name}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (!isP && isTeam) onDayClick(ds);
                      }}
                      onKeyDown={(ev) => {
                        if (isP || !isTeam) return;
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault();
                          ev.stopPropagation();
                          onDayClick(ds);
                        }
                      }}
                    >
                      <span className="event-chip-text">
                        <span className="event-chip-name">{e.name}</span>
                        {timeDisp ? <span className="event-chip-time">{timeDisp}</span> : null}
                      </span>
                      {initials ? (
                        <span className="event-chip-ini" style={monoStyle} title={assigneeName || undefined}>
                          {initials}
                        </span>
                      ) : null}
                    </div>
                  );
                }
                const isTask = item.kind === 'task';
                return (
                  <div
                    key={`${item.kind}-${item.id}`}
                    className="chip event-chip-row"
                    style={getDayItemChipStyle(item)}
                    title={item.title}
                  >
                    <span className="event-chip-text">
                      <span className="event-chip-name">
                        {isTask ? 'Task: ' : 'Workspace: '}
                        {item.title}
                      </span>
                      <span className="event-chip-time">
                        {item.perspectiveLabel}
                        {item.meta ? ` · ${item.meta}` : ''}
                      </span>
                    </span>
                  </div>
                );
              })}
              {!isLoading && dayItems.length > 3 && <div className="chip" style={{background:'var(--bg-alt)',color:'var(--text-3)'}}>+{dayItems.length-3}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function HomeView() {
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const locale = lang === 'en' ? 'en-GB' : 'nl-NL';
  const { user } = useAuth();
  const isTeam = user?.role === 'team';
  const qc = useQueryClient();
  const [dayModalDate, setDayModalDate] = useState(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [form, setForm] = useState(emptyEventForm);
  const TODAY = new Date(); TODAY.setHours(0,0,0,0);

  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
    enabled: isTeam,
  });
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team'],
    queryFn: getTeamMembers,
    enabled: isTeam,
  });
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: getTasks,
    enabled: isTeam,
  });
  const { data: workspaces = [], isLoading: workspacesLoading } = useQuery({
    queryKey: ['workspaces'],
    queryFn: getWorkspaces,
    enabled: isTeam,
  });
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
    enabled: isTeam,
  });
  const { data: activity = [], isLoading: activityLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: getActivity,
    enabled: isTeam,
  });
  const {
    data: portalActivity = [],
    isLoading: portalActivityLoading,
  } = useQuery({
    queryKey: ['portal-activity'],
    queryFn: () => getPortalActivity({ limit: 20 }),
    enabled: isTeam,
  });
  const mixedActivity = useMemo(() => {
    const teamItems = (activity || []).map((item) => ({
      id: `team-${item._id}`,
      text: item.text || '',
      createdAt: item.createdAt,
      color: item.color || 'var(--accent)',
      isHtml: true,
    }));
    const clientItems = (portalActivity || []).map((item) => {
      const dotColor =
        item.type === 'video_revision'
          ? 'var(--amber)'
          : item.type === 'video_approved'
            ? 'var(--sage)'
            : item.type === 'questionnaire_submitted'
              ? 'var(--blue)'
              : 'var(--accent)';
      const clientName = item.clientName || t('portalUnknownClient');
      return {
        id: `client-${item.id}`,
        text: `${clientName}: ${item.text || t('portalClientEventFallback')}`,
        createdAt: item.createdAt,
        color: dotColor,
        isHtml: false,
      };
    });
    return [...teamItems, ...clientItems]
      .filter((item) => item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activity, portalActivity, t]);

  const saveEventMut = useMutation({
    mutationFn: (body) => {
      if (!isTeam) return Promise.reject(new Error(t('eventCreateForbidden')));
      if (editingEventId) return updateEvent(editingEventId, body);
      return createEvent(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      setEventModalOpen(false);
      setDayModalDate(null);
      setEditingEventId(null);
      setForm(emptyEventForm());
    },
  });
  const deleteEventMut = useMutation({
    mutationFn: (id) => deleteEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['activity'] });
      setDayModalDate(null);
    },
  });

  const dayModalEvents = useMemo(() => {
    if (!dayModalDate) return [];
    return sortEventsBySchedule(events.filter((e) => e.date === dayModalDate));
  }, [events, dayModalDate]);
  const dayModalItems = useMemo(() => {
    if (!dayModalDate) return [];
    const dayEventItems = dayModalEvents.map((event) => ({ id: event._id, kind: 'event', event }));
    const dayTaskItems = getTaskDayItems(tasks, dayModalDate);
    const dayWorkspaceItems = getWorkspaceDayItems(workspaces, dayModalDate);
    return [...dayEventItems, ...dayTaskItems, ...dayWorkspaceItems];
  }, [dayModalDate, dayModalEvents, tasks, workspaces]);

  const openDayFlow = (ds) => {
    if (!isTeam) return;
    const d = new Date(`${ds}T12:00:00`);
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    if (d < t0) return;
    setDayModalDate(ds);
  };

  const openCreateEventForDate = (ds) => {
    setEditingEventId(null);
    setForm({ ...emptyEventForm(), dateTime: joinDateAndTimeForLocalInput(ds, '12:00') });
    setDayModalDate(null);
    setEventModalOpen(true);
  };

  const openEditEvent = (e) => {
    if (!isTeam) return;
    setEditingEventId(e._id);
    setForm(eventToFormState(e));
    setDayModalDate(null);
    setEventModalOpen(true);
  };

  const closeEventModal = () => {
    setEventModalOpen(false);
    setEditingEventId(null);
    setForm(emptyEventForm());
  };

  const handleDeleteEvent = (event) => {
    if (!event?._id || deleteEventMut.isPending) return;
    deleteEventMut.mutate(event._id);
  };
  const handleDayItemClick = (item) => {
    if (item.kind === 'task') {
      setDayModalDate(null);
      navigate(`${DASHBOARD_BASE}/taken`);
      return;
    }
    if (item.kind === 'workspace') {
      setDayModalDate(null);
      navigate(`${DASHBOARD_BASE}/workspace/${item.workspaceId || item.id}`);
    }
  };

  const mon  = getMon(TODAY);
  const nmon = new Date(mon); nmon.setDate(nmon.getDate()+7);

  const weekday = DL_NL[TODAY.getDay()];
  const dateEm = `${TODAY.getDate()} ${MONTHS[TODAY.getMonth()]} ${TODAY.getFullYear()}`;

  const openTasks = tasks.filter(t => t.column !== 'klaar').length;
  const urgent    = clients.filter(c => c.urgent).length;
  const shootsFromEvents = events.filter(
    (event) => event.type === "Shoot" && isInMonth(event.date, TODAY.getMonth(), TODAY.getFullYear()),
  ).length;
  const shootsFromWorkspaces = workspaces.filter((workspace) =>
    isInMonth(workspace.shootDate, TODAY.getMonth(), TODAY.getFullYear()),
  ).length;
  const shoots = shootsFromEvents + shootsFromWorkspaces;

  return (
    <section className="view active" id="view-home">
      <div className="page-header">
        <div>
          <div className="page-title" id="home-date-title">
            {weekday}, <em>{dateEm}</em>
          </div>
          <div className="page-subtitle">{t('homeStudioSubtitle')}</div>
        </div>
      </div>

      <div className="kpi-grid">
        {[
          { cls:'kpi-0', lbl:t('activeClients'), val:clients.length, desc:t('kpiDescOngoingProjects'), click:()=>navigate(`${DASHBOARD_BASE}/klanten`), id:'kpi-clients', loading: clientsLoading },
          { cls:'kpi-1', lbl:t('shootsMonth'), val:shoots, desc:t('kpiDescScheduled'), click:()=>navigate(`${DASHBOARD_BASE}/agenda`), id:'kpi-shoots', loading: eventsLoading },
          { cls:'kpi-2', lbl:t('kpiTasksInProgress'), val:openTasks, desc:t('kpiDescAcrossProjects'), click:()=>navigate(`${DASHBOARD_BASE}/taken`), id:'kpi-tasks', loading: tasksLoading },
          { cls:'kpi-3', lbl:t('kpiUrgentClients'), val:urgent, desc:t('kpiDescRequiresAttention'), click:()=>navigate(`${DASHBOARD_BASE}/klanten`), id:'kpi-urgent', loading: clientsLoading },
        ].map(k => (
          <div key={k.cls} className={`kpi-card ${k.cls}`} onClick={k.click}>
            <div className="kpi-label">{k.lbl}</div>
            <div className="kpi-number" id={k.id}>
              {k.loading ? <span className="home-skeleton-line home-skeleton-shimmer kpi-number-skeleton" aria-hidden /> : k.val}
            </div>
            <div className="kpi-desc">{k.desc}</div>
          </div>
        ))}
      </div>

      <div className="home-body">
        <div className="home-main">
          <div className="week-section">
            <div className="week-label" id="week-label-current">{t('thisWeek')}</div>
            <div id="week-current">
              <WeekGrid
                start={mon}
                events={events}
                tasks={tasks}
                workspaces={workspaces}
                onDayClick={openDayFlow}
                isTeam={isTeam}
                locale={locale}
                isLoading={eventsLoading || tasksLoading || workspacesLoading}
              />
            </div>
          </div>
          <div className="week-section">
            <div className="week-label" id="week-label-next">{t('nextWeek')}</div>
            <div id="week-next">
              <WeekGrid
                start={nmon}
                events={events}
                tasks={tasks}
                workspaces={workspaces}
                onDayClick={openDayFlow}
                isTeam={isTeam}
                locale={locale}
                isLoading={eventsLoading || tasksLoading || workspacesLoading}
              />
            </div>
          </div>
        </div>

        <div className="home-side">
          <div className="activity-card">
            <div className="section-title" id="activity-section-title">{t('activity')}</div>
            <div id="activity-feed">
              {activityLoading || portalActivityLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <div key={`activity-skeleton-${idx}`} className="activity-item" aria-hidden>
                    <div className="activity-dot home-skeleton-line home-skeleton-shimmer" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="home-skeleton-line home-skeleton-shimmer activity-text-skeleton" />
                      <div className="home-skeleton-line home-skeleton-shimmer activity-time-skeleton" />
                    </div>
                    <div className="activity-arrow home-skeleton-line home-skeleton-shimmer" />
                  </div>
                ))
              ) : mixedActivity.slice(0, 12).map((item) => {
                const itemDate = new Date(item.createdAt);
                const isValidDate = !Number.isNaN(itemDate.getTime());
                return (
                <div key={item.id} className="activity-item">
                  <div className="activity-dot" style={{ background: item.color || 'var(--accent)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {item.isHtml ? (
                      <div className="activity-text" dangerouslySetInnerHTML={{ __html: item.text }} />
                    ) : (
                      <div className="activity-text">{item.text}</div>
                    )}
                    <div className="activity-time">
                      {isValidDate
                        ? itemDate.toLocaleDateString(locale, {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })
                        : t('portalDateUnknown')}
                    </div>
                  </div>
                  <div className="activity-arrow">→</div>
                </div>
                );
              })}
              {!activityLoading && !portalActivityLoading && mixedActivity.length === 0 && (
                <div className="activity-empty">{t('clientActivityEmpty')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <EventDayModal
        date={dayModalDate}
        events={dayModalEvents}
        items={dayModalItems}
        onClose={() => setDayModalDate(null)}
        onAddEvent={openCreateEventForDate}
        onEventClick={openEditEvent}
        onDeleteEvent={handleDeleteEvent}
        onItemClick={handleDayItemClick}
      />

      <EventFormModal
        open={eventModalOpen}
        onClose={closeEventModal}
        mode={editingEventId ? 'edit' : 'create'}
        form={form}
        setForm={setForm}
        clients={clients}
        teamMembers={teamMembers}
        saveMut={saveEventMut}
        isTeam={isTeam}
      />
    </section>
  );
}
