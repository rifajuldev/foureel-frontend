import { createPortal } from 'react-dom';
import { useState } from 'react';
import { useLang } from '../../context/LangContext';
import { formatEventTime } from '../../utils/dateTimeFormat';
import { getAssigneeInitials, getAssigneeMonogramStyle } from '../../utils/eventAssignee';

const TYPE_COLOR = {
  Shoot: 'var(--sage)',
  Edit: 'var(--amber)',
  Deadline: 'var(--orange)',
  Call: 'var(--blue)',
  Delivery: 'var(--purple)',
};
function getItemColor(item) {
  if (item.kind === 'task') return 'var(--blue)';
  if (item.kind === 'workspace' && item.perspectiveLabel === 'Shoot date') return 'var(--amber)';
  if (item.kind === 'workspace' && item.perspectiveLabel === 'Deadline') return '#e05050';
  if (item.kind === 'workspace') return 'var(--purple)';
  return 'var(--text-3)';
}

/**
 * Day summary: list events, add new, or open an event for editing.
 */
export default function EventDayModal({ date, events = [], items, onClose, onAddEvent, onEventClick, onDeleteEvent, onItemClick }) {
  const { t, lang } = useLang();
  const locale = lang === 'en' ? 'en-GB' : 'nl-NL';
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  if (!date) return null;
  const dayItems = items ?? events.map((event) => ({ id: event._id, kind: 'event', event }));

  return createPortal(
    <div className="modal-overlay modal-overlay--portal open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{date}</div>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {dayItems.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic' }}>
              {t('dayModalNoEvents')}
            </p>
          ) : (
            dayItems.map((item) => {
              if (item.kind !== 'event') {
                return (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    className="day-event-item"
                    onClick={() => onItemClick?.(item)}
                  >
                    <div className="event-dot" style={{ background: getItemColor(item) }} />
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div className="day-event-title-row">
                        <span className="day-event-name">
                          {item.kind === 'task' ? 'Task: ' : 'Workspace: '}
                          {item.title}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                        {item.perspectiveLabel || (item.kind === 'task' ? 'Task' : 'Workspace')}
                        {item.kind === 'workspace' && item.perspectiveLabel === 'Shoot date' && item.shootTime
                          ? ` · ${item.shootTime}`
                          : ''}
                        {item.meta ? ` · ${item.meta}` : ''}
                      </div>
                    </div>
                    <span className="event-arrow">→</span>
                  </button>
                );
              }
              const e = item.event;
              const initials = getAssigneeInitials(e, { maxLength: 3 });
              const monoStyle = getAssigneeMonogramStyle(e);
              const timeDisp = formatEventTime(e.time, locale, { hour12: true });
              return (
                <div
                  key={e._id}
                  role="button"
                  tabIndex={0}
                  className="day-event-item"
                  onClick={() => onEventClick?.(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      onEventClick?.(e);
                    }
                  }}
                >
                  <div className="day-event-main">
                    <div className="event-dot" style={{ background: TYPE_COLOR[e.type] || 'var(--accent)' }} />
                    <div style={{ minWidth: 0, textAlign: 'left' }}>
                      <div className="day-event-head">
                        <div className="day-event-title-row">
                          <span className="day-event-name">{e.name}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                        {e.type}
                        {e.client ? ` · ${e.client}` : ''}
                      </div>
                      {e.notes && (
                        <div style={{ fontSize: '12px', color: 'var(--text-2)', marginTop: '4px' }}>{e.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className="day-event-center">
                    {initials ? (
                      <span
                        className="day-event-initials"
                        style={monoStyle}
                        title={e.assigneeId?.name || ''}
                      >
                        {initials}
                      </span>
                    ) : null}
                    {timeDisp ? <span className="day-event-time">{timeDisp}</span> : null}
                  </div>
                  <div className="day-event-actions">
                    {onEventClick ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm day-event-edit-btn"
                        title={t('eventFormTitleEdit')}
                        aria-label={t('eventFormTitleEdit')}
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          onEventClick(e);
                        }}
                      >
                        <span className="day-event-edit-icon" aria-hidden>
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path d="M9.5 4.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                          </svg>
                        </span>
                      </button>
                    ) : null}
                    {onDeleteEvent ? (
                      <button
                        type="button"
                        className="btn btn-primary day-event-delete-btn"
                        style={{ fontSize: '11px', padding: '4px 8px', background: '#c04040', borderColor: '#c04040' }}
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          setDeleteCandidate(e);
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                    <span className="event-arrow">→</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('close')}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onAddEvent(date)}>
            {t('addEventToDay')}
          </button>
        </div>
      </div>
      {deleteCandidate ? (
        <div className="modal-overlay open" onClick={() => setDeleteCandidate(null)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(ev) => ev.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Delete event</div>
              <button type="button" className="modal-close" onClick={() => setDeleteCandidate(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '14px', color: 'var(--text-2)' }}>
              Delete "{deleteCandidate.name || 'event'}"?
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteCandidate(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#c04040', borderColor: '#c04040' }}
                onClick={() => {
                  onDeleteEvent?.(deleteCandidate);
                  setDeleteCandidate(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
