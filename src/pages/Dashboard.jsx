import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { DASHBOARD_BASE } from '../paths';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { getTasks, getTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import FormInput from '../components/FormInput';

const DEFAULT_MEMBER_FORM = {
  email: '',
  password: '',
  name: '',
  teamRole: '',
  teamAccessLevel: 'editor',
  color: '#C8953A',
};
const DEFAULT_EDIT_FORM = {
  email: '',
  password: '',
  name: '',
  teamRole: '',
  teamAccessLevel: 'editor',
  color: '#C8953A',
};

const TEAM_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const teamMemberErrBorder = {
  borderColor: 'var(--accent)',
  boxShadow: '0 0 0 1px var(--accent)',
};

function validateTeamMemberForm(form, t) {
  const errors = {};
  const email = form.email.trim();
  if (!email) errors.email = t('teamValEmailRequired');
  else if (!TEAM_EMAIL_REGEX.test(email)) errors.email = t('teamValEmailInvalid');

  const pw = typeof form.password === 'string' ? form.password.trim() : '';
  if (!pw) errors.password = t('teamValPasswordRequired');
  else if (pw.length < 8) errors.password = t('teamValPasswordLength');

  const name = form.name.trim();
  if (!name) errors.name = t('teamValNameRequired');

  const teamRole = typeof form.teamRole === 'string' ? form.teamRole.trim() : '';
  if (!teamRole) errors.teamRole = t('teamValRoleRequired');

  return errors;
}

function validateTeamMemberEditForm(form, t) {
  const errors = {};
  const email = form.email.trim();
  if (!email) errors.email = t('teamValEmailRequired');
  else if (!TEAM_EMAIL_REGEX.test(email)) errors.email = t('teamValEmailInvalid');

  const pw = typeof form.password === 'string' ? form.password.trim() : '';
  if (pw && pw.length < 8) errors.password = t('teamValPasswordLength');

  const name = form.name.trim();
  if (!name) errors.name = t('teamValNameRequired');

  const teamRole = typeof form.teamRole === 'string' ? form.teamRole.trim() : '';
  if (!teamRole) errors.teamRole = t('teamValRoleRequired');

  return errors;
}

function mapTeamMemberApiError(message, t) {
  const out = {};
  if (!message) {
    out._general = t('teamCreateError');
    return out;
  }
  const m = message.toLowerCase();
  if (m.includes('already in use') || (m.includes('email') && m.includes('in use'))) {
    out.email = t('teamValEmailTaken');
  } else if (m.includes('valid email')) {
    out.email = t('teamValEmailInvalid');
  } else if (m.includes('password') && (m.includes('8') || m.includes('least'))) {
    out.password = t('teamValPasswordLength');
  } else if (m.includes('name') && m.includes('required')) {
    out.name = t('teamValNameRequired');
  } else if (m.includes('role') && m.includes('required')) {
    out.teamRole = t('teamValRoleRequired');
  } else {
    out._general = message;
  }
  return out;
}

/** Matches default seeded team size; stretches if cached list is longer (refetch / placeholder). */
const DEFAULT_TEAM_SKELETON_COUNT = 5;
const TEAM_SKELETON_LINE_WIDTHS = ['78%', '92%', '68%', '85%', '74%', '88%', '70%', '90%'];

function TeamListSkeletonRows({ count }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={`team-skel-${i}`} className="team-member-pill team-member-pill--skeleton" aria-hidden>
      <div className="avatar team-skeleton-avatar team-skeleton-shimmer" />
      <span className="team-member-pill-text team-member-pill-text--skeleton">
        <span
          className="team-skeleton-line team-skeleton-shimmer"
          style={{ width: TEAM_SKELETON_LINE_WIDTHS[i % TEAM_SKELETON_LINE_WIDTHS.length] }}
        />
      </span>
    </div>
  ));
}

/** SVG nav icons — matches 4reel-dashboard.html */
const NavIcons = {
  home: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1.5L1 7v8h5v-5h4v5h5V7z" />
    </svg>
  ),
  agenda: (
    <svg className="nav-icon" viewBox="0 0 16 16" aria-hidden>
      <rect x="1" y="3" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 1v4M11 1v4M1 7h14" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  klanten: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="6" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 14c0-3 2.2-5 5-5s5 2 5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 7c1.1.4 2 1.5 2 2.8" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M13.5 6a2.5 2.5 0 010 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  ),
  taken: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="1" y="2" width="4" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6" y="2" width="4" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="2" width="4" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  archief: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="1" y="1" width="14" height="4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 5v9a1 1 0 001 1h10a1 1 0 001-1V5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M6 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  workspace: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <path d="M9 12h6M12 9v6" />
    </svg>
  ),
  checker: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <rect x="2" y="2" width="12" height="9" rx="1.5" />
      <path d="M6 14h4M8 11v3" />
      <path d="M5 5h6M5 7.5h4" />
    </svg>
  ),
  pulse: (
    <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M1 8h2l2-5 2 10 2-7 2 4 2-2h2" />
    </svg>
  ),
};

const NAV_SECTIONS = [
  {
    labelKey: 'navStudio',
    labelStyle: undefined,
    items: [
      { id: 'home', iconKey: 'home', labelKey: 'home' },
      { id: 'agenda', iconKey: 'agenda', labelKey: 'agenda' },
    ],
  },
  {
    labelKey: 'navBeheer',
    items: [
      { id: 'klanten', iconKey: 'klanten', labelKey: 'klanten' },
      { id: 'taken', iconKey: 'taken', labelKey: 'taken', badge: true },
      { id: 'archief', iconKey: 'archief', labelKey: 'archief' },
    ],
  },
  {
    labelKey: 'navEditors',
    labelStyle: { marginTop: '4px' },
    items: [
      { id: 'workspace', iconKey: 'workspace', labelKey: 'workspace' },
      { id: 'checker', iconKey: 'checker', labelKey: 'checker' },
      { id: 'pulse', iconKey: 'pulse', labelKey: 'pulse' },
    ],
  },
];

const NAV_TO = {
  home: DASHBOARD_BASE,
  agenda: `${DASHBOARD_BASE}/agenda`,
  klanten: `${DASHBOARD_BASE}/klanten`,
  taken: `${DASHBOARD_BASE}/taken`,
  archief: `${DASHBOARD_BASE}/archief`,
  workspace: `${DASHBOARD_BASE}/workspace`,
  checker: `${DASHBOARD_BASE}/checker`,
  pulse: `${DASHBOARD_BASE}/pulse`,
};

export default function Dashboard() {
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberForm, setMemberForm] = useState(DEFAULT_MEMBER_FORM);
  const [memberFormErrors, setMemberFormErrors] = useState({});
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [deleteMemberOpen, setDeleteMemberOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [editMemberForm, setEditMemberForm] = useState(DEFAULT_EDIT_FORM);
  const [editMemberErrors, setEditMemberErrors] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { logout, user, isTeamAdmin, canAccessDashboardSection } = useAuth();
  const { lang, setLang, t } = useLang();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isTeamUser = user?.role === 'team';

  const { data: tasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: getTasks });
  const {
    data: teamMembers = [],
    isLoading: teamLoading,
    isError: teamError,
  } = useQuery({
    queryKey: ['team'],
    queryFn: getTeamMembers,
    enabled: Boolean(user && isTeamUser),
    placeholderData: (previousData) => previousData,
  });

  const showTeamListSkeleton = teamLoading && !teamError;
  const teamSkeletonRowCount = showTeamListSkeleton
    ? Math.max(DEFAULT_TEAM_SKELETON_COUNT, teamMembers.length)
    : 0;

  const createMemberMut = useMutation({
    mutationFn: createTeamMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setMemberForm(DEFAULT_MEMBER_FORM);
      setMemberFormErrors({});
      setAddMemberOpen(false);
    },
    onError: (error) => {
      setMemberFormErrors(mapTeamMemberApiError(error?.message || '', t));
    },
  });
  const editMemberMut = useMutation({
    mutationFn: ({ id, payload }) => updateTeamMember(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setEditMemberOpen(false);
      setSelectedMember(null);
      setEditMemberForm(DEFAULT_EDIT_FORM);
      setEditMemberErrors({});
    },
    onError: (error) => {
      setEditMemberErrors(mapTeamMemberApiError(error?.message || '', t));
    },
  });
  const deleteMemberMut = useMutation({
    mutationFn: deleteTeamMember,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      setDeleteMemberOpen(false);
      const deletedOwnAccount = Boolean(result?.deletedOwnAccount);
      setSelectedMember(null);
      if (deletedOwnAccount) {
        logout();
      }
    },
  });

  const patchMemberForm = (field, value) => {
    setMemberForm((f) => ({ ...f, [field]: value }));
    setMemberFormErrors((prev) => {
      if (!prev[field] && !prev._general) return prev;
      const next = { ...prev };
      delete next[field];
      delete next._general;
      return next;
    });
  };

  const openAddMemberModal = () => {
    createMemberMut.reset();
    setMemberForm({ ...DEFAULT_MEMBER_FORM });
    setMemberFormErrors({});
    setAddMemberOpen(true);
  };
  const openEditMemberModal = (member) => {
    editMemberMut.reset();
    setSelectedMember(member);
    setEditMemberForm({
      email: member?.email || '',
      password: '',
      name: member?.name || '',
      teamRole: member?.teamRole || '',
      teamAccessLevel: member?.teamAccessLevel || 'editor',
      color: member?.color || '#C8953A',
    });
    setEditMemberErrors({});
    setEditMemberOpen(true);
  };
  const openDeleteMemberModal = (member) => {
    deleteMemberMut.reset();
    setSelectedMember(member);
    setDeleteMemberOpen(true);
  };

  const handleSubmitTeamMember = () => {
    const errors = validateTeamMemberForm(memberForm, t);
    setMemberFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    createMemberMut.mutate({
      email: memberForm.email.trim(),
      password: memberForm.password.trim(),
      name: memberForm.name.trim(),
      teamRole: memberForm.teamRole.trim(),
      teamAccessLevel: memberForm.teamAccessLevel,
      color: memberForm.color,
    });
  };
  const patchEditMemberForm = (field, value) => {
    setEditMemberForm((f) => ({ ...f, [field]: value }));
    setEditMemberErrors((prev) => {
      if (!prev[field] && !prev._general) return prev;
      const next = { ...prev };
      delete next[field];
      delete next._general;
      return next;
    });
  };
  const handleSubmitEditMember = () => {
    if (!selectedMember?._id) return;
    const errors = validateTeamMemberEditForm(editMemberForm, t);
    setEditMemberErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const payload = {
      email: editMemberForm.email.trim(),
      name: editMemberForm.name.trim(),
      teamRole: editMemberForm.teamRole.trim(),
      teamAccessLevel: editMemberForm.teamAccessLevel,
      color: editMemberForm.color,
    };
    const password = editMemberForm.password.trim();
    if (password) payload.password = password;
    editMemberMut.mutate({ id: selectedMember._id, payload });
  };
  const handleConfirmDeleteMember = () => {
    if (!selectedMember?._id) return;
    deleteMemberMut.mutate(selectedMember._id);
  };
  const openCount = tasks.filter((task) => task.column !== 'klaar').length;
  const visibleSections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessDashboardSection(item.id)),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="dashboard-shell">
      <header className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <div className="brand-mark">
            <svg viewBox="0 0 18 18" aria-hidden>
              <path
                fill="white"
                d="M3 3h5v5H3zm7 0h5v5h-5zm0 7h5v5h-5zM3 13l2.5-2.5L8 13l-2.5 2.5z"
              />
            </svg>
          </div>
          <span className="brand-name">4REEL</span>
        </div>
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={sidebarOpen}
          aria-controls="sidebar"
          onClick={() => setSidebarOpen((prev) => !prev)}
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
      </header>

      {sidebarOpen ? <button type="button" className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} /> : null}

      <nav id="sidebar" className={sidebarOpen ? 'open' : ''} aria-label="Studio navigatie">
        <button
          type="button"
          className="sidebar-close-btn"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        >
          ✕
        </button>
        <div className="sidebar-brand">
          <div className="brand-logo">
            <div className="brand-mark">
              <svg viewBox="0 0 18 18" aria-hidden>
                <path
                  fill="white"
                  d="M3 3h5v5H3zm7 0h5v5h-5zm0 7h5v5h-5zM3 13l2.5-2.5L8 13l-2.5 2.5z"
                />
              </svg>
            </div>
            <span className="brand-name">4REEL</span>
          </div>
          <div className="brand-sub">{t('brandSub')}</div>
        </div>

        <div className="sidebar-nav">
          {visibleSections.map((section) => (
            <div key={section.labelKey}>
              <div className="nav-section-label" style={section.labelStyle}>
                {t(section.labelKey)}
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={NAV_TO[item.id]}
                  end={item.id === 'home'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  {NavIcons[item.iconKey]}
                  {t(item.labelKey)}
                  {item.badge && openCount > 0 ? (
                    <span className="nav-badge">{openCount}</span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="lang-toggle">
            <button
              type="button"
              className={`lang-btn${lang === 'nl' ? ' active' : ''}`}
              onClick={() => setLang('nl')}
            >
              NL
            </button>
            <button
              type="button"
              className={`lang-btn${lang === 'en' ? ' active' : ''}`}
              onClick={() => setLang('en')}
            >
              EN
            </button>
          </div>
          {isTeamAdmin ? (
            <>
              <div className="nav-section-label sidebar-team-heading">{t('team')}</div>
              <div className="sidebar-team-panel">
            <div className="sidebar-team-scroll" aria-busy={showTeamListSkeleton}>
              {teamError ? (
                <div className="sidebar-team-msg" role="alert">
                  {t('teamLoadError')}
                </div>
              ) : null}
              {showTeamListSkeleton ? (
                <TeamListSkeletonRows count={teamSkeletonRowCount} />
              ) : null}
              {!showTeamListSkeleton && !teamError
                ? teamMembers.map((m) => (
                    <div
                      key={m._id}
                      className="team-member-pill"
                      title={`${m.name}${m.teamRole ? ` — ${m.teamRole}` : ''}`}
                    >
                      <div
                        className="avatar"
                        style={{
                          backgroundColor: m.color || 'var(--accent)',
                          color: '#faf7f2',
                        }}
                      >
                        {(m.initials || m.name?.[0] || '?').slice(0, 3)}
                      </div>
                      <span className="team-member-pill-text">
                        {m.name}
                        {m.teamRole ? ` · ${m.teamRole}` : ''}
                      </span>
                      <div className="team-member-actions">
                        <button
                          type="button"
                          className="team-member-action-btn"
                          onClick={() => openEditMemberModal(m)}
                          title={t('teamEditTooltip')}
                          aria-label={t('teamEditTooltip')}
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                            <path d="M2 11.5V14h2.5L12.9 5.6 10.4 3.1 2 11.5z" />
                            <path d="M9.7 3.8 12.2 6.3" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="team-member-action-btn team-member-action-btn--danger"
                          onClick={() => openDeleteMemberModal(m)}
                          title={t('teamDeleteTooltip')}
                          aria-label={t('teamDeleteTooltip')}
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                            <path d="M3 4h10" />
                            <path d="M6 4V2.8c0-.4.3-.8.8-.8h2.4c.5 0 .8.4.8.8V4" />
                            <path d="M4.5 4l.6 9.2c0 .5.4.8.9.8h4c.5 0 .9-.3.9-.8L11.5 4" />
                            <path d="M6.8 7v4.5M9.2 7v4.5" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                : null}
            </div>
            <button
              type="button"
              className={`sidebar-add-member${showTeamListSkeleton ? ' sidebar-add-member--skeleton' : ''}`}
              onClick={openAddMemberModal}
            >
              {showTeamListSkeleton ? (
                <>
                  <span className="sidebar-add-member-skel-icon team-skeleton-shimmer" aria-hidden />
                  <span className="sidebar-add-member-skel-text team-skeleton-shimmer" aria-hidden />
                </>
              ) : (
                <>
                  <svg
                    className="sidebar-add-member-icon"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    aria-hidden
                  >
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  {t('addTeamMember')}
                </>
              )}
            </button>
              </div>
            </>
          ) : null}
          <button type="button" className="sidebar-logout" onClick={() => setLogoutModalOpen(true)}>
            <svg
              className="sidebar-logout-icon"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M2.5 3.5v9M2.5 3.5H6.5M2.5 12.5H6.5" />
              <path d="M9 8h4.5" />
              <path d="M11.5 5.5 14 8 11.5 10.5" />
            </svg>
            {t('logout')}
          </button>
        </div>
      </nav>

      {addMemberOpen && (
        <div className="modal-overlay open" onClick={() => setAddMemberOpen(false)}>
          <div className="modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t('addTeamMemberTitle')}</div>
              <button type="button" className="modal-close" onClick={() => setAddMemberOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label" htmlFor="team-add-email">
                  {t('teamEmailLabel')}
                </label>
                <input
                  id="team-add-email"
                  type="email"
                  className="form-input"
                  autoComplete="off"
                  value={memberForm.email}
                  onChange={(e) => patchMemberForm('email', e.target.value)}
                  placeholder={t('portalEmailPlaceholder')}
                  style={memberFormErrors.email ? teamMemberErrBorder : undefined}
                  aria-invalid={Boolean(memberFormErrors.email)}
                  aria-describedby={memberFormErrors.email ? 'team-add-email-err' : undefined}
                />
                {memberFormErrors.email ? (
                  <div id="team-add-email-err" className="form-field-error" role="alert">
                    {memberFormErrors.email}
                  </div>
                ) : null}
              </div>
              <div className="form-group">
                <FormInput
                  label={t('teamPasswordLabel')}
                  id="team-add-password"
                  type="password"
                  className="form-group"
                  inputClassName="form-input"
                  autoComplete="new-password"
                  value={memberForm.password}
                  onChange={(e) => patchMemberForm('password', e.target.value)}
                  placeholder={t('teamPasswordHint')}
                  style={memberFormErrors.password ? teamMemberErrBorder : undefined}
                  errorMessage={memberFormErrors.password}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="team-add-name">
                  {t('teamNameLabel')}
                </label>
                <input
                  id="team-add-name"
                  type="text"
                  className="form-input"
                  value={memberForm.name}
                  onChange={(e) => patchMemberForm('name', e.target.value)}
                  style={memberFormErrors.name ? teamMemberErrBorder : undefined}
                  aria-invalid={Boolean(memberFormErrors.name)}
                  aria-describedby={memberFormErrors.name ? 'team-add-name-err' : undefined}
                />
                {memberFormErrors.name ? (
                  <div id="team-add-name-err" className="form-field-error" role="alert">
                    {memberFormErrors.name}
                  </div>
                ) : null}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="team-add-role">
                  {t('teamRoleLabel')}
                </label>
                <input
                  id="team-add-role"
                  type="text"
                  className="form-input"
                  value={memberForm.teamRole}
                  onChange={(e) => patchMemberForm('teamRole', e.target.value)}
                  style={memberFormErrors.teamRole ? teamMemberErrBorder : undefined}
                  aria-invalid={Boolean(memberFormErrors.teamRole)}
                  aria-describedby={memberFormErrors.teamRole ? 'team-add-role-err' : undefined}
                />
                {memberFormErrors.teamRole ? (
                  <div id="team-add-role-err" className="form-field-error" role="alert">
                    {memberFormErrors.teamRole}
                  </div>
                ) : null}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="team-add-access-level">
                  Access level
                </label>
                <select
                  id="team-add-access-level"
                  className="form-select"
                  value={memberForm.teamAccessLevel}
                  onChange={(e) => patchMemberForm('teamAccessLevel', e.target.value)}
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="team-add-color">
                    {t('teamColorLabel')}
                  </label>
                  <input
                    id="team-add-color"
                    type="color"
                    className="form-input"
                    style={{
                      height: '40px',
                      padding: '4px',
                      cursor: 'pointer',
                      ...(memberFormErrors.color ? teamMemberErrBorder : {}),
                    }}
                    value={memberForm.color}
                    onChange={(e) => patchMemberForm('color', e.target.value)}
                    aria-invalid={Boolean(memberFormErrors.color)}
                    aria-describedby={memberFormErrors.color ? 'team-add-color-err' : undefined}
                  />
                  {memberFormErrors.color ? (
                    <div id="team-add-color-err" className="form-field-error" role="alert">
                      {memberFormErrors.color}
                    </div>
                  ) : null}
                </div>
              </div>
              {memberFormErrors._general ? (
                <div className="form-field-error" role="alert" style={{ marginTop: '4px' }}>
                  {memberFormErrors._general}
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setAddMemberOpen(false)}
                disabled={createMemberMut.isPending}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={createMemberMut.isPending}
                onClick={handleSubmitTeamMember}
                style={createMemberMut.isPending ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : undefined}
              >
                {createMemberMut.isPending ? (
                  <>
                    <LoadingSpinner size={18} />
                    <span>{t('teamLoading')}</span>
                  </>
                ) : (
                  t('save')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {logoutModalOpen && (
        <div className="modal-overlay open" onClick={() => setLogoutModalOpen(false)}>
          <div className="modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t('logoutConfirmTitle')}</div>
              <button type="button" className="modal-close" onClick={() => setLogoutModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                {t('logoutConfirmBody')}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setLogoutModalOpen(false)}>
                {t('cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setLogoutModalOpen(false);
                  logout();
                }}
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      )}
      {editMemberOpen && (
        <div className="modal-overlay open" onClick={() => setEditMemberOpen(false)}>
          <div className="modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t('editTeamMemberTitle')}</div>
              <button type="button" className="modal-close" onClick={() => setEditMemberOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label" htmlFor="team-edit-email">
                  {t('teamEmailLabel')}
                </label>
                <input
                  id="team-edit-email"
                  type="email"
                  className="form-input"
                  autoComplete="off"
                  value={editMemberForm.email}
                  onChange={(e) => patchEditMemberForm('email', e.target.value)}
                  style={editMemberErrors.email ? teamMemberErrBorder : undefined}
                />
                {editMemberErrors.email ? <div className="form-field-error">{editMemberErrors.email}</div> : null}
              </div>
              <div className="form-group">
                <FormInput
                  label={t('teamPasswordLabel')}
                  id="team-edit-password"
                  type="password"
                  className="form-group"
                  inputClassName="form-input"
                  autoComplete="new-password"
                  value={editMemberForm.password}
                  onChange={(e) => patchEditMemberForm('password', e.target.value)}
                  placeholder={t('teamPasswordOptionalHint')}
                  style={editMemberErrors.password ? teamMemberErrBorder : undefined}
                  errorMessage={editMemberErrors.password}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="team-edit-name">
                  {t('teamNameLabel')}
                </label>
                <input
                  id="team-edit-name"
                  type="text"
                  className="form-input"
                  value={editMemberForm.name}
                  onChange={(e) => patchEditMemberForm('name', e.target.value)}
                  style={editMemberErrors.name ? teamMemberErrBorder : undefined}
                />
                {editMemberErrors.name ? <div className="form-field-error">{editMemberErrors.name}</div> : null}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="team-edit-role">
                  {t('teamRoleLabel')}
                </label>
                <input
                  id="team-edit-role"
                  type="text"
                  className="form-input"
                  value={editMemberForm.teamRole}
                  onChange={(e) => patchEditMemberForm('teamRole', e.target.value)}
                  style={editMemberErrors.teamRole ? teamMemberErrBorder : undefined}
                />
                {editMemberErrors.teamRole ? <div className="form-field-error">{editMemberErrors.teamRole}</div> : null}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="team-edit-access-level">
                  Access level
                </label>
                <select
                  id="team-edit-access-level"
                  className="form-select"
                  value={editMemberForm.teamAccessLevel}
                  onChange={(e) => patchEditMemberForm('teamAccessLevel', e.target.value)}
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="team-edit-color">
                  {t('teamColorLabel')}
                </label>
                <input
                  id="team-edit-color"
                  type="color"
                  className="form-input"
                  style={{ height: '40px', padding: '4px', cursor: 'pointer' }}
                  value={editMemberForm.color}
                  onChange={(e) => patchEditMemberForm('color', e.target.value)}
                />
              </div>
              {editMemberErrors._general ? (
                <div className="form-field-error" role="alert" style={{ marginTop: '8px' }}>
                  {editMemberErrors._general}
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setEditMemberOpen(false)} disabled={editMemberMut.isPending}>
                {t('cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmitEditMember} disabled={editMemberMut.isPending}>
                {editMemberMut.isPending ? t('teamLoading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteMemberOpen && (
        <div className="modal-overlay open" onClick={() => setDeleteMemberOpen(false)}>
          <div className="modal" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{t('teamDeleteConfirmTitle')}</div>
              <button type="button" className="modal-close" onClick={() => setDeleteMemberOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                {t('teamDeleteConfirmBody').replace('{name}', selectedMember?.name || '')}
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteMemberOpen(false)} disabled={deleteMemberMut.isPending}>
                {t('cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirmDeleteMember} disabled={deleteMemberMut.isPending}>
                {deleteMemberMut.isPending ? t('teamLoading') : t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <main id="main">
        <Outlet />
      </main>
    </div>
  );
}
