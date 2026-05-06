import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, DragOverlay, useDroppable, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getTasks, getClients, getTeamMembers, createTask, updateTask, reorderTasks, archiveTask } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import LoadingSpinner from '../../components/LoadingSpinner';

const COLS = [{ id: 'todo' }, { id: 'bezig' }, { id: 'review' }, { id: 'klaar' }];
const DEFAULT_TAKEN_FILTER_SKELETON_COUNT = 5;
const TAKEN_FILTER_SKEL_NAME_W = ['52px', '44px', '48px', '56px', '40px', '50px', '46px', '54px'];
const TAKEN_CARD_SKEL_TITLE_W = ['92%', '78%', '84%', '68%', '88%', '72%'];
const TAKEN_COL_SKEL_COUNTS = { todo: 3, bezig: 2, review: 2, klaar: 3 };
const TASK_TITLE_MAX_LEN = 200;
const VALID_TASK_PRIORITIES = new Set(['High', 'Normal', 'Low']);
const COLUMN_INDEX = Object.fromEntries(COLS.map((col, idx) => [col.id, idx]));
const LINK_URL_REGEX = /^https?:\/\//i;

const newTaskErrBorder = {
  borderColor: 'var(--accent)',
  boxShadow: '0 0 0 1px var(--accent)',
};

/** @param {{ title: string, assignee: string, priority: string, dueDate: string, clientId: string }} form */
function validateNewTaskForm(form, teamMembers, clients, t) {
  const errors = {};
  const title = (form.title || '').trim();
  if (!title) errors.title = t('taskValTitleRequired');
  else if (title.length > TASK_TITLE_MAX_LEN) errors.title = t('taskValTitleMax');

  if (!teamMembers.length) {
    errors.assignee = t('taskValAssigneeNoTeam');
  } else {
    const assignee = (form.assignee || '').trim();
    if (!assignee) errors.assignee = t('taskValAssigneeRequired');
    else if (!teamMembers.some((m) => m.name === assignee)) errors.assignee = t('taskValAssigneeInvalid');
  }

  if (!VALID_TASK_PRIORITIES.has(form.priority)) errors.priority = t('taskValPriorityInvalid');

  const due = (form.dueDate || '').trim();
  if (!due) errors.dueDate = t('taskValDueRequired');
  else {
    const parsed = new Date(`${due}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) errors.dueDate = t('taskValDueInvalid');
  }

  const cid = form.clientId != null ? String(form.clientId).trim() : '';
  if (!cid) errors.clientId = t('taskValClientRequired');
  else if (!clients.some((c) => String(c._id) === cid)) errors.clientId = t('taskValClientInvalid');

  return errors;
}

function buildAssigneeLookup(teamMembers) {
  const map = {};
  for (const m of teamMembers) {
    const name = m?.name;
    if (!name) continue;
    map[name] = {
      bg: m.color || 'var(--accent)',
      init: (m.initials || m.name?.[0] || '?').slice(0, 3),
    };
  }
  return map;
}

function TakenFilterSkeletons({ count }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={`taken-filter-skel-${i}`} className="filter-btn filter-btn--skeleton" aria-hidden>
      <div className="filter-avatar filter-skeleton-avatar team-skeleton-shimmer" />
      <div className="filter-btn-label-col" style={{ minWidth: 0 }}>
        <span
          className="team-skeleton-line team-skeleton-shimmer filter-btn-skel-name"
          style={{
            width: TAKEN_FILTER_SKEL_NAME_W[i % TAKEN_FILTER_SKEL_NAME_W.length],
            height: '10px',
            borderRadius: '999px',
            alignSelf: 'flex-start',
          }}
        />
      </div>
    </div>
  ));
}

function TaskCardSkeleton({ index = 0 }) {
  return (
    <div className="task-card" aria-hidden style={{ pointerEvents: 'none', cursor: 'default' }}>
      <div
        className="team-skeleton-line team-skeleton-shimmer"
        style={{
          width: TAKEN_CARD_SKEL_TITLE_W[index % TAKEN_CARD_SKEL_TITLE_W.length],
          height: '12px',
          borderRadius: '6px',
          marginBottom: '8px',
        }}
      />
      <div
        className="team-skeleton-line team-skeleton-shimmer"
        style={{ width: '44%', height: '14px', borderRadius: '4px', marginBottom: '12px' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          className="team-skeleton-avatar team-skeleton-shimmer"
          style={{ width: '22px', height: '22px' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div
            className="team-skeleton-line team-skeleton-shimmer"
            style={{ width: '10px', height: '10px', borderRadius: '50%' }}
          />
          <div
            className="team-skeleton-line team-skeleton-shimmer"
            style={{ width: '62px', height: '10px', borderRadius: '5px' }}
          />
        </div>
      </div>
    </div>
  );
}

function TakenBoardSkeleton({ t }) {
  return (
    <div className="kanban-board" aria-busy>
      {COLS.map((col) => (
        <div key={`skel-${col.id}`} className="kanban-col" aria-hidden style={{ pointerEvents: 'none' }}>
          <div className="col-header">
            <span className="col-title">{t(col.id)}</span>
            <span className="col-count team-skeleton-shimmer" style={{ minWidth: '20px', color: 'transparent' }}>
              00
            </span>
          </div>
          {Array.from({ length: TAKEN_COL_SKEL_COUNTS[col.id] || 2 }).map((_, i) => (
            <TaskCardSkeleton key={`${col.id}-skel-card-${i}`} index={i} />
          ))}
        </div>
      ))}
    </div>
  );
}

function prioClass(priority) {
  const p = String(priority || 'Normal').toLowerCase();
  if (p === 'high') return 'prio-high';
  if (p === 'low') return 'prio-low';
  return 'prio-normal';
}

function TaskCardContent({
  task,
  assigneeLookup,
  teamMembers = [],
  isAssigneeEditing = false,
  isDueDateEditing = false,
  onStartAssigneeEdit,
  onStartDueDateEdit,
  onAssigneeChange,
  onDueDateChange,
  onCancelQuickEdit,
  allowQuickEdit = false,
}) {
  const assigneeSelectRef = useRef(null);
  const av = assigneeLookup[task.assignee] || {
    bg: 'var(--text-3)',
    init: (task.assignee && String(task.assignee)[0]) || '?',
  };
  const stopCardClick = (e) => {
    e.stopPropagation();
  };

  useEffect(() => {
    if (!allowQuickEdit || !isAssigneeEditing) return;
    const rafId = window.requestAnimationFrame(() => {
      const selectEl = assigneeSelectRef.current;
      if (!selectEl) return;
      selectEl.focus();
      selectEl.showPicker?.();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [allowQuickEdit, isAssigneeEditing]);

  return (
    <>
      <div className="task-title">{task.title}</div>
      {task.client ? (
        <div className="task-meta">
          <span className="task-client">{task.client}</span>
        </div>
      ) : null}
      <div className="task-footer">
        {allowQuickEdit && isAssigneeEditing ? (
          <select
            ref={assigneeSelectRef}
            className="form-input"
            autoFocus
            value={task.assignee || ''}
            onPointerDown={stopCardClick}
            onClick={stopCardClick}
            onFocus={(e) => {
              e.currentTarget.showPicker?.();
            }}
            onChange={(e) => {
              onAssigneeChange?.(e.target.value);
              onCancelQuickEdit?.();
            }}
            onBlur={() => onCancelQuickEdit?.()}
            style={{ maxWidth: '120px', height: '30px', fontSize: '12px', padding: '4px 8px' }}
          >
            {teamMembers.map((m) => (
              <option key={m._id || m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        ) : (
          <button
            type="button"
            onPointerDown={allowQuickEdit ? stopCardClick : undefined}
            onClick={allowQuickEdit ? (e) => { stopCardClick(e); onStartAssigneeEdit?.(); } : undefined}
            className="task-avatar"
            style={{ background: av.bg, border: 'none', cursor: allowQuickEdit ? 'pointer' : 'default' }}
            aria-label="Change assignee"
          >
            {av.init}
          </button>
        )}
        {allowQuickEdit && isDueDateEditing ? (
          <input
            type="date"
            className="form-input"
            autoFocus
            value={task.dueDate || ''}
            onPointerDown={stopCardClick}
            onClick={stopCardClick}
            onFocus={(e) => {
              e.currentTarget.showPicker?.();
            }}
            onChange={(e) => {
              if (!e.target.value) return;
              onDueDateChange?.(e.target.value);
              onCancelQuickEdit?.();
            }}
            onBlur={() => onCancelQuickEdit?.()}
            style={{ width: '128px', height: '30px', fontSize: '12px', padding: '4px 8px' }}
          />
        ) : (
          <button
            type="button"
            onPointerDown={allowQuickEdit ? stopCardClick : undefined}
            onClick={allowQuickEdit ? (e) => { stopCardClick(e); onStartDueDateEdit?.(); } : undefined}
            className="task-due"
            style={{ border: 'none', background: 'transparent', padding: 0, cursor: allowQuickEdit ? 'pointer' : 'default' }}
            aria-label="Change due date"
          >
            {task.dueDate ? `📅 ${task.dueDate}` : '📅 —'}
          </button>
        )}
      </div>
    </>
  );
}

function TaskCard({
  task,
  onClick,
  assigneeLookup,
  teamMembers,
  isAssigneeEditing,
  isDueDateEditing,
  onStartAssigneeEdit,
  onStartDueDateEdit,
  onAssigneeChange,
  onDueDateChange,
  onCancelQuickEdit,
  allowQuickEdit = false,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 };
  const isQuickEditing = isAssigneeEditing || isDueDateEditing;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card ${prioClass(task.priority)}${isDragging ? ' dragging' : ''}`}
      {...(isQuickEditing ? {} : attributes)}
      {...(isQuickEditing ? {} : listeners)}
      onClick={() => onClick(task)}
    >
      <TaskCardContent
        task={task}
        assigneeLookup={assigneeLookup}
        teamMembers={teamMembers}
        isAssigneeEditing={isAssigneeEditing}
        isDueDateEditing={isDueDateEditing}
        onStartAssigneeEdit={onStartAssigneeEdit}
        onStartDueDateEdit={onStartDueDateEdit}
        onAssigneeChange={onAssigneeChange}
        onDueDateChange={onDueDateChange}
        onCancelQuickEdit={onCancelQuickEdit}
        allowQuickEdit={allowQuickEdit}
      />
    </div>
  );
}

function KanbanColumn({ columnId, title, count, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  return (
    <div ref={setNodeRef} className={`kanban-col${isOver ? ' is-over' : ''}`} data-col={columnId}>
      <div className="col-header">
        <span className="col-title">{title}</span>
        <span className="col-count">{count}</span>
      </div>
      {children}
    </div>
  );
}

export default function TakenView() {
  const { t } = useLang();
  const { isTeamAdmin, isTeamUser, user } = useAuth();
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
  );
  const [filter, setFilter] = useState('all');
  const [activeId, setActiveId] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [taskModal, setTaskModal] = useState(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(null);
  const [newModal, setNewModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [quickEditTaskId, setQuickEditTaskId] = useState(null);
  const [quickEditField, setQuickEditField] = useState(null);
  const [newTaskErrors, setNewTaskErrors] = useState({});
  const [taskEditErrors, setTaskEditErrors] = useState({});
  const [closeTaskModalOnUpdateSuccess, setCloseTaskModalOnUpdateSuccess] = useState(false);
  const [taskEditForm, setTaskEditForm] = useState({
    clientId: '',
    assignee: '',
    dueDate: '',
    priority: 'Normal',
    description: '',
    checklist: [],
    links: [],
    comments: [],
  });
  const [taskLinkDraft, setTaskLinkDraft] = useState({ label: '', url: '' });
  const [taskChecklistDraft, setTaskChecklistDraft] = useState('');
  const [taskCommentDraft, setTaskCommentDraft] = useState('');
  const [taskLinkError, setTaskLinkError] = useState('');
  const [form, setForm] = useState({
    title: '',
    assignee: '',
    priority: 'Normal',
    dueDate: '',
    clientId: '',
    column: 'todo',
  });
  const qc = useQueryClient();
  const boardRef = useRef(null);

  const clearNewTaskFieldError = (key) => {
    setNewTaskErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const openNewTaskModal = () => {
    setNewTaskErrors({});
    setNewModal(true);
  };

  const closeNewTaskModal = () => {
    setNewModal(false);
    setNewTaskErrors({});
  };
  /** After a drag, browsers often emit a click; skip opening the task modal for that synthetic click. */
  const suppressTaskCardClickRef = useRef(false);
  const suppressTaskCardClickTimerRef = useRef(null);

  const scheduleClearSuppressTaskCardClick = () => {
    suppressTaskCardClickRef.current = true;
    if (suppressTaskCardClickTimerRef.current != null) {
      window.clearTimeout(suppressTaskCardClickTimerRef.current);
    }
    suppressTaskCardClickTimerRef.current = window.setTimeout(() => {
      suppressTaskCardClickRef.current = false;
      suppressTaskCardClickTimerRef.current = null;
    }, 80);
  };

  const handleTaskCardClick = (task) => {
    if (suppressTaskCardClickRef.current) return;
    setTaskModal(task);
  };

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({ queryKey: ['tasks'], queryFn: getTasks });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: getClients });
  const {
    data: teamMembers = [],
    isLoading: teamLoading,
    isError: teamError,
  } = useQuery({
    queryKey: ['team'],
    queryFn: getTeamMembers,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (!taskModal) return;
    const matchedClient = clients.find((c) => c.name === taskModal.client);
    const resolvedClientId = taskModal.clientId
      ? String(taskModal.clientId)
      : (matchedClient?._id ? String(matchedClient._id) : '');
    setTaskEditForm({
      clientId: resolvedClientId,
      assignee: taskModal.assignee || '',
      dueDate: taskModal.dueDate || '',
      priority: taskModal.priority || 'Normal',
      description: typeof taskModal.description === 'string' ? taskModal.description : '',
      checklist: Array.isArray(taskModal.checklist)
        ? taskModal.checklist
            .map((item) => ({
              text: typeof item?.text === 'string' ? item.text : '',
              done: Boolean(item?.done),
            }))
            .filter((item) => item.text.trim())
        : [],
      links: Array.isArray(taskModal.links)
        ? taskModal.links
            .map((item) => ({
              label: typeof item?.label === 'string' ? item.label : '',
              url: typeof item?.url === 'string' ? item.url : '',
            }))
            .filter((item) => item.url.trim())
        : [],
      comments: Array.isArray(taskModal.comments)
        ? taskModal.comments
            .map((item) => ({
              author: typeof item?.author === 'string' ? item.author : '',
              text: typeof item?.text === 'string' ? item.text : '',
              createdAt: item?.createdAt || new Date().toISOString(),
            }))
            .filter((item) => item.text.trim())
        : [],
    });
    setTaskEditErrors({});
    setTaskLinkDraft({ label: '', url: '' });
    setTaskChecklistDraft('');
    setTaskCommentDraft('');
    setTaskLinkError('');
  }, [taskModal, clients]);

  const assigneeLookup = useMemo(() => buildAssigneeLookup(teamMembers), [teamMembers]);
  const showTeamFilterSkeleton = teamLoading && !teamError;
  const teamFilterSkeletonCount = showTeamFilterSkeleton
    ? Math.max(DEFAULT_TAKEN_FILTER_SKELETON_COUNT, teamMembers.length)
    : 0;

  const memberFilters = useMemo(
    () => teamMembers.map((m) => ({ id: m.name, name: m.name })),
    [teamMembers],
  );

  /** Keep assignee valid when team list changes; do not auto-pick first member (user must choose). */
  useEffect(() => {
    if (!teamMembers.length) {
      setForm((prev) => (prev.assignee ? { ...prev, assignee: '' } : prev));
      return;
    }
    setForm((prev) => {
      if (!prev.assignee) return prev;
      if (teamMembers.some((m) => m.name === prev.assignee)) return prev;
      return { ...prev, assignee: '' };
    });
  }, [teamMembers]);

  useEffect(() => {
    if (filter === 'all') return;
    if (!teamMembers.some((m) => m.name === filter)) setFilter('all');
  }, [teamMembers, filter]);

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => updateTask(id, d),
    onMutate: async ({ id, ...data }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = qc.getQueryData(['tasks']) || [];

      qc.setQueryData(['tasks'], (current = []) =>
        current.map((task) => (task._id === id ? { ...task, ...data } : task)),
      );

      if (taskModal?._id === id) {
        setTaskModal((prev) => (prev ? { ...prev, ...data } : prev));
      }

      return { previousTasks };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTasks) {
        qc.setQueryData(['tasks'], context.previousTasks);
      }
      setCloseTaskModalOnUpdateSuccess(false);
    },
    onSuccess: () => {
      if (closeTaskModalOnUpdateSuccess) {
        setTaskModal(null);
        setCloseTaskModalOnUpdateSuccess(false);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
  const reorderMut = useMutation({
    mutationFn: ({ payload }) => reorderTasks(payload),
    onMutate: async ({ optimisticTasks }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = qc.getQueryData(['tasks']) || [];
      qc.setQueryData(['tasks'], optimisticTasks);
      return { previousTasks };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTasks) {
        qc.setQueryData(['tasks'], context.previousTasks);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
  const createMut = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setNewModal(false);
      setNewTaskErrors({});
      setForm({
        title: '',
        assignee: '',
        priority: 'Normal',
        dueDate: '',
        clientId: '',
        column: 'todo',
      });
    },
  });
  const archiveMut = useMutation({
    mutationFn: ({ id, archivedReason }) => archiveTask(id, archivedReason),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = qc.getQueryData(['tasks']) || [];
      qc.setQueryData(['tasks'], (current = []) =>
        current.filter((task) => task._id !== id),
      );
      setTaskModal(null);
      setToast(t('taskArchivedToast'));
      return { previousTasks };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTasks) {
        qc.setQueryData(['tasks'], context.previousTasks);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['archivedTasks'] });
    },
    onSettled: () => {
      setTimeout(() => setToast(null), 1800);
    },
  });
  const softDeleteMut = useMutation({
    mutationFn: ({ id }) => updateTask(id, { status: 'delete' }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = qc.getQueryData(['tasks']) || [];
      qc.setQueryData(['tasks'], (current = []) =>
        current.filter((task) => task._id !== id),
      );
      setConfirmDeleteTask(null);
      setTaskModal(null);
      return { previousTasks };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTasks) {
        qc.setQueryData(['tasks'], context.previousTasks);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const orderedTasks = useMemo(() => [...tasks].sort((a, b) => {
    const colA = COLUMN_INDEX[a.column] ?? Number.MAX_SAFE_INTEGER;
    const colB = COLUMN_INDEX[b.column] ?? Number.MAX_SAFE_INTEGER;
    if (colA !== colB) return colA - colB;
    const aHasOrder = Number.isFinite(a.sortOrder);
    const bHasOrder = Number.isFinite(b.sortOrder);
    if (aHasOrder && bHasOrder && a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;
    const createdA = new Date(a.createdAt || 0).getTime();
    const createdB = new Date(b.createdAt || 0).getTime();
    if (createdA !== createdB) return createdA - createdB;
    return String(a._id).localeCompare(String(b._id));
  }), [tasks]);

  const filtered = filter === 'all' ? orderedTasks : orderedTasks.filter((x) => x.assignee === filter);

  const handleDragEnd = ({ active, over }) => {
    scheduleClearSuppressTaskCardClick();
    if (!over) {
      setActiveId(null);
      return;
    }
    const activeIdStr = String(active.id);
    const overId = String(over.id);
    const activeTaskItem = orderedTasks.find((t) => t._id === activeIdStr);
    if (!activeTaskItem) {
      setActiveId(null);
      return;
    }

    let destinationColumn = null;
    if (COLS.some((c) => c.id === overId)) {
      destinationColumn = overId;
    } else {
      const overTask = orderedTasks.find((t) => t._id === overId);
      destinationColumn = overTask?.column || null;
    }
    if (!destinationColumn) {
      setActiveId(null);
      return;
    }

    const columnTaskIds = COLS.reduce((acc, col) => {
      acc[col.id] = orderedTasks.filter((task) => task.column === col.id).map((task) => task._id);
      return acc;
    }, {});

    const sourceColumn = activeTaskItem.column;
    const sourceIds = [...(columnTaskIds[sourceColumn] || [])];
    const destinationIds = sourceColumn === destinationColumn
      ? sourceIds
      : [...(columnTaskIds[destinationColumn] || [])];

    const sourceIndex = sourceIds.indexOf(activeIdStr);
    if (sourceIndex === -1) {
      setActiveId(null);
      return;
    }

    if (sourceColumn === destinationColumn) {
      if (overId === destinationColumn) {
        const movedToEnd = [...sourceIds];
        movedToEnd.splice(sourceIndex, 1);
        movedToEnd.push(activeIdStr);
        columnTaskIds[sourceColumn] = movedToEnd;
      } else {
        const overIndex = sourceIds.indexOf(overId);
        if (overIndex === -1 || overIndex === sourceIndex) {
          setActiveId(null);
          return;
        }
        columnTaskIds[sourceColumn] = arrayMove(sourceIds, sourceIndex, overIndex);
      }
    } else {
      sourceIds.splice(sourceIndex, 1);
      const overIndex = destinationIds.indexOf(overId);
      const insertIndex = overId === destinationColumn || overIndex < 0 ? destinationIds.length : overIndex;
      destinationIds.splice(insertIndex, 0, activeIdStr);
      columnTaskIds[sourceColumn] = sourceIds;
      columnTaskIds[destinationColumn] = destinationIds;
    }

    const sortLookup = {};
    COLS.forEach((col) => {
      (columnTaskIds[col.id] || []).forEach((taskId, index) => {
        sortLookup[taskId] = { column: col.id, sortOrder: index + 1 };
      });
    });

    const optimisticTasks = orderedTasks.map((task) => {
      const next = sortLookup[task._id];
      if (!next) return task;
      return { ...task, column: next.column, sortOrder: next.sortOrder };
    });

    const touchedColumns = sourceColumn === destinationColumn
      ? { [sourceColumn]: columnTaskIds[sourceColumn] }
      : {
          [sourceColumn]: columnTaskIds[sourceColumn],
          [destinationColumn]: columnTaskIds[destinationColumn],
        };

    reorderMut.mutate({
      payload: {
        movedTaskId: activeIdStr,
        destinationColumn,
        columnTaskIds: touchedColumns,
      },
      optimisticTasks,
    });

    setActiveId(null);
  };

  const activeTask = orderedTasks.find((x) => x._id === activeId);

  useEffect(() => {
    const boardEl = boardRef.current;
    if (!boardEl) return undefined;

    const updateProgress = () => {
      if (window.innerWidth > 900) return;
      const maxScroll = Math.max(1, boardEl.scrollWidth - boardEl.clientWidth);
      const nextProgress = Math.max(0, Math.min(1, boardEl.scrollLeft / maxScroll));
      setScrollProgress(nextProgress);
    };

    const onScroll = () => window.requestAnimationFrame(updateProgress);
    boardEl.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateProgress);
    updateProgress();

    return () => {
      boardEl.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateProgress);
    };
  }, [filter, filtered.length]);

  const scrollToColumn = (idx) => {
    const boardEl = boardRef.current;
    if (!boardEl) return;
    const columns = boardEl.querySelectorAll('.kanban-col');
    const target = columns[idx];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  const addTaskLink = () => {
    const url = taskLinkDraft.url.trim();
    const label = taskLinkDraft.label.trim();
    if (!LINK_URL_REGEX.test(url)) {
      setTaskLinkError(t('taskLinkUrlInvalid'));
      return;
    }
    setTaskEditForm((prev) => ({
      ...prev,
      links: [...prev.links, { label: label || url, url }],
    }));
    setTaskLinkDraft({ label: '', url: '' });
    setTaskLinkError('');
  };

  const addChecklistItem = () => {
    const text = taskChecklistDraft.trim();
    if (!text) return;
    setTaskEditForm((prev) => ({
      ...prev,
      checklist: [...prev.checklist, { text, done: false }],
    }));
    setTaskChecklistDraft('');
  };

  const addTaskComment = () => {
    const text = taskCommentDraft.trim();
    if (!text) return;
    setTaskEditForm((prev) => ({
      ...prev,
      comments: [
        ...prev.comments,
        {
          author: user?.name || 'Team',
          text,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setTaskCommentDraft('');
  };

  return (
    <section className="view active taken-view">
      <div className="page-header taken-page-header">
        <div className="taken-page-title-wrap">
          <div className="page-title">Taken <em>— Kanban board</em></div>
          <div className="page-subtitle">{t('tasksKanbanSubtitle')}</div>
        </div>
        <button type="button" className="btn btn-primary taken-add-btn" onClick={openNewTaskModal}>{t('addTask')}</button>
      </div>

      <div className="kanban-header">
        <div className="filter-bar">
          <span className="filter-bar-label">{t('filter')}</span>
          <button
            type="button"
            className={`filter-btn${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            {t('allTasks')}
          </button>
          {showTeamFilterSkeleton ? <TakenFilterSkeletons count={teamFilterSkeletonCount} /> : null}
          {!showTeamFilterSkeleton
            ? memberFilters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`filter-btn${filter === f.id ? ' active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  <div
                    className="filter-avatar"
                    style={{ background: assigneeLookup[f.id]?.bg || 'var(--text-3)' }}
                  >
                    {assigneeLookup[f.id]?.init || f.name?.[0] || '?'}
                  </div>
                  <span className="filter-btn-name">{f.name}</span>
                </button>
              ))
            : null}
        </div>
      </div>
      {tasksLoading ? (
        <TakenBoardSkeleton t={t} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => setActiveId(active.id)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            scheduleClearSuppressTaskCardClick();
            setActiveId(null);
          }}
        >
          <div className="kanban-board" ref={boardRef}>
            {COLS.map((col) => {
              const colTasks = filtered.filter((x) => x.column === col.id);
              return (
                <SortableContext key={col.id} items={colTasks.map((x) => x._id)} strategy={verticalListSortingStrategy}>
                  <KanbanColumn columnId={col.id} title={t(col.id)} count={colTasks.length}>
                    {colTasks.map((task) => (
                      <TaskCard
                        key={task._id}
                        task={task}
                        onClick={handleTaskCardClick}
                        assigneeLookup={assigneeLookup}
                        teamMembers={teamMembers}
                        isAssigneeEditing={quickEditTaskId === task._id && quickEditField === 'assignee'}
                        isDueDateEditing={quickEditTaskId === task._id && quickEditField === 'dueDate'}
                        onStartAssigneeEdit={() => {
                          setQuickEditTaskId(task._id);
                          setQuickEditField('assignee');
                        }}
                        onStartDueDateEdit={() => {
                          setQuickEditTaskId(task._id);
                          setQuickEditField('dueDate');
                        }}
                        onAssigneeChange={(assignee) => {
                          updateMut.mutate({ id: task._id, assignee });
                        }}
                        onDueDateChange={(dueDate) => {
                          updateMut.mutate({ id: task._id, dueDate });
                        }}
                        onCancelQuickEdit={() => {
                          setQuickEditTaskId(null);
                          setQuickEditField(null);
                        }}
                        allowQuickEdit={isTeamAdmin}
                      />
                    ))}
                    {col.id === 'todo' && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ width: '100%', justifyContent: 'center', marginTop: '4px' }}
                        onClick={openNewTaskModal}
                      >
                        {t('addTask')}
                      </button>
                    )}
                  </KanbanColumn>
                </SortableContext>
              );
            })}
          </div>
          <DragOverlay>
            {activeTask ? (
              <div className={`task-card ${prioClass(activeTask.priority)} dragging`}>
                <TaskCardContent task={activeTask} assigneeLookup={assigneeLookup} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      <div
        className="kanban-mobile-fab-indicator"
        aria-label="Kolom navigator"
        style={{ '--fab-count': COLS.length }}
      >
        <span
          className="kanban-mobile-fab-thumb"
          style={{ transform: `translateX(calc(${scrollProgress} * var(--fab-track-x)))` }}
        />
        {COLS.map((col, idx) => (
          <button
            key={col.id}
            type="button"
            className="kanban-mobile-fab-dot"
            aria-label={`Ga naar ${t(col.id)}`}
            onClick={() => scrollToColumn(idx)}
          />
        ))}
      </div>

      {taskModal && (
        <div className="modal-overlay open" onClick={() => setTaskModal(null)}>
          <div className="modal task-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{taskModal.title}</div>
              <button type="button" className="modal-close" onClick={() => setTaskModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="task-modal-layout">
                <div className="task-modal-main">
                  <div className="task-info-grid" style={{ gap: '10px', marginBottom: '20px' }}>
                    <div style={{ background: 'var(--bg-alt)', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>Klant</div>
                      {isTeamAdmin ? (
                        <select
                          className="form-input"
                          value={taskEditForm.clientId}
                          onChange={(e) => {
                            setTaskEditForm((prev) => ({ ...prev, clientId: e.target.value }));
                            setTaskEditErrors((prev) => {
                              if (!prev.clientId) return prev;
                              const next = { ...prev };
                              delete next.clientId;
                              return next;
                            });
                          }}
                          style={taskEditErrors.clientId ? newTaskErrBorder : undefined}
                          aria-invalid={Boolean(taskEditErrors.clientId)}
                          aria-describedby={taskEditErrors.clientId ? 'task-edit-client-err' : undefined}
                        >
                          {clients.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="form-input" style={{ display: 'flex', alignItems: 'center', opacity: 0.85 }}>
                          {taskModal.client || '—'}
                        </div>
                      )}
                      {taskEditErrors.clientId ? (
                        <div id="task-edit-client-err" className="form-field-error" role="alert">
                          {taskEditErrors.clientId}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ background: 'var(--bg-alt)', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>Toegewezen</div>
                      {isTeamAdmin ? (
                        <select
                          className="form-input"
                          value={taskEditForm.assignee}
                          onChange={(e) => setTaskEditForm((prev) => ({ ...prev, assignee: e.target.value }))}
                        >
                          {teamMembers.map((m) => (
                            <option key={m._id || m.name} value={m.name}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="form-input" style={{ display: 'flex', alignItems: 'center', opacity: 0.85 }}>
                          {taskModal.assignee || '—'}
                        </div>
                      )}
                    </div>
                    <div style={{ background: 'var(--bg-alt)', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>Deadline</div>
                      {isTeamAdmin ? (
                        <input
                          type="date"
                          className="form-input"
                          value={taskEditForm.dueDate}
                          onChange={(e) => {
                            setTaskEditForm((prev) => ({ ...prev, dueDate: e.target.value }));
                            setTaskEditErrors((prev) => {
                              if (!prev.dueDate) return prev;
                              const next = { ...prev };
                              delete next.dueDate;
                              return next;
                            });
                          }}
                          style={taskEditErrors.dueDate ? newTaskErrBorder : undefined}
                          aria-invalid={Boolean(taskEditErrors.dueDate)}
                          aria-describedby={taskEditErrors.dueDate ? 'task-edit-due-err' : undefined}
                        />
                      ) : (
                        <div className="form-input" style={{ display: 'flex', alignItems: 'center', opacity: 0.85 }}>
                          {taskModal.dueDate || '—'}
                        </div>
                      )}
                      {taskEditErrors.dueDate ? (
                        <div id="task-edit-due-err" className="form-field-error" role="alert">
                          {taskEditErrors.dueDate}
                        </div>
                      ) : null}
                    </div>
                    <div style={{ background: 'var(--bg-alt)', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '6px' }}>Prioriteit</div>
                      {isTeamAdmin ? (
                        <select
                          className="form-input"
                          value={taskEditForm.priority}
                          onChange={(e) => setTaskEditForm((prev) => ({ ...prev, priority: e.target.value }))}
                        >
                          <option value="High">{t('taskPriorityHigh')}</option>
                          <option value="Normal">{t('taskPriorityNormal')}</option>
                          <option value="Low">{t('taskPriorityLow')}</option>
                        </select>
                      ) : (
                        <div className="form-input" style={{ display: 'flex', alignItems: 'center', opacity: 0.85 }}>
                          {taskModal.priority || t('taskPriorityNormal')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="task-modal-section">
                    <div className="task-modal-section-title">{t('taskDescriptionLabel')}</div>
                    {isTeamUser ? (
                      <textarea
                        className="form-input"
                        rows={4}
                        value={taskEditForm.description}
                        onChange={(e) => setTaskEditForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder={t('taskDescriptionPlaceholder')}
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                    ) : (
                      <div className="task-section-box">
                        {taskEditForm.description || t('taskDescriptionEmpty')}
                      </div>
                    )}
                  </div>

                  <div className="task-modal-section">
                    <div className="task-modal-section-head">
                      <div className="task-modal-section-title">{t('taskLinksLabel')}</div>
                    </div>
                    {taskEditForm.links.length > 0 ? (
                      <div className="task-link-list">
                        {taskEditForm.links.map((link, index) => (
                          <div key={`${link.url}-${index}`} className="task-link-item">
                            <a href={link.url} target="_blank" rel="noreferrer" className="task-link-anchor">
                              {link.label || link.url}
                            </a>
                            {isTeamUser ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  setTaskEditForm((prev) => ({
                                    ...prev,
                                    links: prev.links.filter((_, i) => i !== index),
                                  }))
                                }
                              >
                                {t('remove')}
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="task-section-empty">{t('taskLinksEmpty')}</div>
                    )}
                    {isTeamUser ? (
                      <div className="task-inline-form">
                        <input
                          className="form-input"
                          value={taskLinkDraft.label}
                          onChange={(e) => setTaskLinkDraft((prev) => ({ ...prev, label: e.target.value }))}
                          placeholder={t('taskLinkLabelPlaceholder')}
                        />
                        <input
                          className="form-input"
                          value={taskLinkDraft.url}
                          onChange={(e) => {
                            setTaskLinkDraft((prev) => ({ ...prev, url: e.target.value }));
                            if (taskLinkError) setTaskLinkError('');
                          }}
                          placeholder={t('taskLinkUrlPlaceholder')}
                        />
                        <button type="button" className="btn btn-ghost btn-sm" onClick={addTaskLink}>
                          {t('taskAddLink')}
                        </button>
                      </div>
                    ) : null}
                    {taskLinkError ? <div className="form-field-error">{taskLinkError}</div> : null}
                  </div>

                  <div className="task-modal-section">
                    <div className="task-modal-section-head">
                      <div className="task-modal-section-title">
                        {t('taskChecklistLabel')} ({taskEditForm.checklist.filter((item) => item.done).length}/{taskEditForm.checklist.length})
                      </div>
                      {isTeamUser && taskEditForm.checklist.length === 0 ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setTaskEditForm((prev) => ({
                              ...prev,
                              checklist: [{ text: t('taskChecklistDefaultItem'), done: false }],
                            }))
                          }
                        >
                          {t('taskChecklistCreate')}
                        </button>
                      ) : null}
                    </div>
                    {taskEditForm.checklist.length > 0 ? (
                      <div style={{ marginBottom: '10px' }}>
                        {taskEditForm.checklist.map((item, i) => (
                          <label key={`${item.text}-${i}`} className={`checklist-item${item.done ? ' checked' : ''}`}>
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={(e) =>
                                setTaskEditForm((prev) => ({
                                  ...prev,
                                  checklist: prev.checklist.map((checkItem, idx) =>
                                    idx === i ? { ...checkItem, done: e.target.checked } : checkItem,
                                  ),
                                }))
                              }
                              style={{ display: 'none' }}
                            />
                            <span className="check-box">{item.done ? '✓' : ''}</span>
                            <span className="check-text">{item.text}</span>
                            {isTeamUser ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ marginLeft: 'auto' }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setTaskEditForm((prev) => ({
                                    ...prev,
                                    checklist: prev.checklist.filter((_, idx) => idx !== i),
                                  }));
                                }}
                              >
                                {t('remove')}
                              </button>
                            ) : null}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="task-section-empty">{t('taskChecklistEmpty')}</div>
                    )}
                    {isTeamUser ? (
                      <div className="task-inline-form">
                        <input
                          className="form-input"
                          value={taskChecklistDraft}
                          onChange={(e) => setTaskChecklistDraft(e.target.value)}
                          placeholder={t('taskChecklistItemPlaceholder')}
                        />
                        <button type="button" className="btn btn-ghost btn-sm" onClick={addChecklistItem}>
                          {t('taskChecklistAddItem')}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: '10px' }}>{t('taskMoveToLabel')}</div>
                    {isTeamAdmin ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {COLS.map((col) => (
                          <button
                            key={col.id}
                            type="button"
                            className={`btn btn-sm ${taskModal.column === col.id ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => {
                              updateMut.mutate({ id: taskModal._id, column: col.id });
                              setTaskModal({ ...taskModal, column: col.id });
                            }}
                          >
                            {t(col.id)}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="form-input" style={{ width: 'fit-content', minWidth: '120px', display: 'flex', alignItems: 'center', opacity: 0.85 }}>
                        {t(taskModal.column || 'todo')}
                      </div>
                    )}
                  </div>
                </div>

                <aside className="task-modal-comments">
                  <div className="task-modal-section-title">{t('taskCommentsLabel')}</div>
                  {taskEditForm.comments.length ? (
                    <div className="task-comment-list">
                      {taskEditForm.comments.map((comment, index) => (
                        <div key={`${comment.author}-${comment.createdAt}-${index}`} className="task-comment-item">
                          <div className="task-comment-meta">
                            <strong>{comment.author || 'Team'}</strong>
                            <span>
                              {comment.createdAt
                                ? new Date(comment.createdAt).toLocaleString()
                                : '—'}
                            </span>
                          </div>
                          <div className="task-comment-text">{comment.text}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="task-section-empty">{t('taskCommentsEmpty')}</div>
                  )}
                  {isTeamUser ? (
                    <div className="task-comment-compose">
                      <textarea
                        className="form-input"
                        rows={3}
                        value={taskCommentDraft}
                        onChange={(e) => setTaskCommentDraft(e.target.value)}
                        placeholder={t('taskCommentPlaceholder')}
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={addTaskComment}>
                        {t('taskCommentAdd')}
                      </button>
                    </div>
                  ) : null}
                </aside>
              </div>
            </div>
            <div className="modal-footer">
              {isTeamAdmin ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginRight: 'auto' }}
                    onClick={() =>
                      archiveMut.mutate({
                        id: taskModal._id,
                        archivedReason: taskModal.column === 'klaar' ? 'completed' : 'manual',
                      })
                    }
                  >
                    {t('archive')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setConfirmDeleteTask(taskModal)}
                    disabled={softDeleteMut.isPending}
                    style={{ color: '#dc2626', borderColor: '#fecaca' }}
                  >
                    {t('delete')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      const errors = {};
                      if (!String(taskEditForm.clientId || '').trim()) {
                        errors.clientId = t('taskValClientRequired');
                      }
                      if (!String(taskEditForm.dueDate || '').trim()) {
                        errors.dueDate = t('taskValDueRequired');
                      }
                      if (Object.keys(errors).length) {
                        setTaskEditErrors(errors);
                        return;
                      }
                      const selectedClient = clients.find((c) => String(c._id) === String(taskEditForm.clientId));
                      setCloseTaskModalOnUpdateSuccess(true);
                      updateMut.mutate({
                        id: taskModal._id,
                        assignee: taskEditForm.assignee,
                        dueDate: taskEditForm.dueDate,
                        priority: taskEditForm.priority,
                        description: taskEditForm.description,
                        checklist: taskEditForm.checklist,
                        links: taskEditForm.links,
                        comments: taskEditForm.comments,
                        clientId: taskEditForm.clientId || undefined,
                        client: selectedClient?.name || '',
                      });
                    }}
                    disabled={updateMut.isPending}
                    style={updateMut.isPending ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : undefined}
                  >
                    {updateMut.isPending ? (
                      <>
                        <LoadingSpinner size={18} />
                        <span>{t('save')}</span>
                      </>
                    ) : (
                      t('save')
                    )}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setTaskModal(null)}>{t('close')}</button>
                </>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={() => setTaskModal(null)}>{t('close')}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDeleteTask && (
        <div className="modal-overlay open" onClick={() => setConfirmDeleteTask(null)}>
          <div className="modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t('taskDeleteConfirmTitle')}</div>
              <button type="button" className="modal-close" onClick={() => setConfirmDeleteTask(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '14px', lineHeight: 1.5 }}>
                {t('taskDeleteConfirmBody', { name: confirmDeleteTask.title })}
              </p>
              <p style={{ margin: '10px 0 0 0', color: 'var(--text-3)', fontSize: '12px' }}>
                {t('taskDeleteConfirmHint')}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDeleteTask(null)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => softDeleteMut.mutate({ id: confirmDeleteTask._id })}
                disabled={softDeleteMut.isPending}
                style={
                  softDeleteMut.isPending
                    ? { display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#dc2626', borderColor: '#dc2626' }
                    : { background: '#dc2626', borderColor: '#dc2626' }
                }
              >
                {softDeleteMut.isPending ? (
                  <>
                    <LoadingSpinner size={18} />
                    <span>{t('delete')}</span>
                  </>
                ) : (
                  t('delete')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast ? (
        <div
          style={{
            position: 'fixed',
            right: '24px',
            bottom: '24px',
            background: 'var(--text)',
            color: 'white',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '12px',
            zIndex: 1200,
            boxShadow: 'var(--shadow)',
          }}
        >
          {toast}
        </div>
      ) : null}

      {newModal && (
        <div className="modal-overlay open" onClick={closeNewTaskModal}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t('taskFormTitle')}</div>
              <button type="button" className="modal-close" onClick={closeNewTaskModal}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label" htmlFor="task-new-title">{t('taskTitleLabel')}</label>
                <input
                  id="task-new-title"
                  className="form-input"
                  value={form.title}
                  onChange={(e) => {
                    clearNewTaskFieldError('title');
                    setForm((f) => ({ ...f, title: e.target.value }));
                  }}
                  placeholder={t('taskTitlePlaceholder')}
                  maxLength={TASK_TITLE_MAX_LEN}
                  style={newTaskErrors.title ? newTaskErrBorder : undefined}
                  aria-invalid={Boolean(newTaskErrors.title)}
                  aria-describedby={newTaskErrors.title ? 'task-new-title-err' : undefined}
                />
                {newTaskErrors.title ? (
                  <div id="task-new-title-err" className="form-field-error" role="alert">
                    {newTaskErrors.title}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="task-new-assignee">{t('taskAssigneeLabel')}</label>
                  <select
                    id="task-new-assignee"
                    className="form-input"
                    value={form.assignee}
                    onChange={(e) => {
                      clearNewTaskFieldError('assignee');
                      setForm((f) => ({ ...f, assignee: e.target.value }));
                    }}
                    style={newTaskErrors.assignee ? newTaskErrBorder : undefined}
                    aria-invalid={Boolean(newTaskErrors.assignee)}
                    aria-describedby={newTaskErrors.assignee ? 'task-new-assignee-err' : undefined}
                  >
                    {teamMembers.length === 0 ? (
                      <option value="" disabled>{t('taskAssigneeEmpty')}</option>
                    ) : (
                      <>
                        <option value="">{t('taskAssigneePlaceholder')}</option>
                        {teamMembers.map((m) => (
                          <option key={m._id || m.name} value={m.name}>
                            {m.name}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {newTaskErrors.assignee ? (
                    <div id="task-new-assignee-err" className="form-field-error" role="alert">
                      {newTaskErrors.assignee}
                    </div>
                  ) : null}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="task-new-priority">{t('taskPriorityLabel')}</label>
                  <select
                    id="task-new-priority"
                    className="form-input"
                    value={form.priority}
                    onChange={(e) => {
                      clearNewTaskFieldError('priority');
                      setForm((f) => ({ ...f, priority: e.target.value }));
                    }}
                    style={newTaskErrors.priority ? newTaskErrBorder : undefined}
                    aria-invalid={Boolean(newTaskErrors.priority)}
                    aria-describedby={newTaskErrors.priority ? 'task-new-priority-err' : undefined}
                  >
                    <option value="High">{t('taskPriorityHigh')}</option>
                    <option value="Normal">{t('taskPriorityNormal')}</option>
                    <option value="Low">{t('taskPriorityLow')}</option>
                  </select>
                  {newTaskErrors.priority ? (
                    <div id="task-new-priority-err" className="form-field-error" role="alert">
                      {newTaskErrors.priority}
                    </div>
                  ) : null}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="task-new-due">{t('taskDeadlineLabel')}</label>
                  <input
                    id="task-new-due"
                    type="date"
                    className="form-input"
                    value={form.dueDate}
                    onChange={(e) => {
                      clearNewTaskFieldError('dueDate');
                      setForm((f) => ({ ...f, dueDate: e.target.value }));
                    }}
                    style={newTaskErrors.dueDate ? newTaskErrBorder : undefined}
                    aria-invalid={Boolean(newTaskErrors.dueDate)}
                    aria-describedby={newTaskErrors.dueDate ? 'task-new-due-err' : undefined}
                  />
                  {newTaskErrors.dueDate ? (
                    <div id="task-new-due-err" className="form-field-error" role="alert">
                      {newTaskErrors.dueDate}
                    </div>
                  ) : null}
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="task-new-client">{t('taskClientLabel')}</label>
                  <select
                    id="task-new-client"
                    className="form-input"
                    value={form.clientId}
                    onChange={(e) => {
                      clearNewTaskFieldError('clientId');
                      setForm((f) => ({ ...f, clientId: e.target.value }));
                    }}
                    style={newTaskErrors.clientId ? newTaskErrBorder : undefined}
                    aria-invalid={Boolean(newTaskErrors.clientId)}
                    aria-describedby={newTaskErrors.clientId ? 'task-new-client-err' : undefined}
                  >
                    <option value="">{t('taskClientPlaceholder')}</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {newTaskErrors.clientId ? (
                    <div id="task-new-client-err" className="form-field-error" role="alert">
                      {newTaskErrors.clientId}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={closeNewTaskModal}>{t('cancel')}</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const errors = validateNewTaskForm(form, teamMembers, clients, t);
                  if (Object.keys(errors).length) {
                    setNewTaskErrors(errors);
                    return;
                  }
                  const selectedClient = clients.find((c) => String(c._id) === String(form.clientId));
                  createMut.mutate({
                    ...form,
                    title: form.title.trim(),
                    assignee: form.assignee.trim(),
                    clientId: form.clientId || undefined,
                    client: selectedClient?.name || '',
                  });
                }}
                disabled={createMut.isPending}
                style={createMut.isPending ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : undefined}
              >
                {createMut.isPending ? (
                  <>
                    <LoadingSpinner size={18} />
                    <span>{t('taskCreateSubmit')}</span>
                  </>
                ) : (
                  t('taskCreateSubmit')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
