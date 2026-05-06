import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LangContext";
import {
  getWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  addWorkspaceBatch,
  deleteWorkspaceBatch,
  addWorkspaceVideo,
  updateWorkspaceVideo,
  deleteWorkspaceVideo,
  getClients,
  getTeamMembers,
} from "../../api";
import LoadingSpinner from "../../components/LoadingSpinner";

const FASE_MAP = {
  tentative: { labelKey: "wsFase_tentative", cls: "ws-ef-tentative", group: "intern" },
  spotting: {
    labelKey: "wsFase_spotting",
    cls: "ws-ef-spotting",
    group: "intern",
  },
  inprogress: {
    labelKey: "wsFase_inprogress",
    cls: "ws-ef-inprogress",
    group: "intern",
  },
  ready: { labelKey: "wsFase_ready", cls: "ws-ef-ready", group: "intern" },
  intern_review: {
    labelKey: "wsFase_intern_review",
    cls: "ws-ef-waitreview",
    group: "intern",
  },
  intern_approved: {
    labelKey: "wsFase_intern_approved",
    cls: "ws-ef-uploaddrive",
    group: "intern",
  },
  waitreview: {
    labelKey: "wsFase_waitreview",
    cls: "ws-ef-waitreview",
    group: "client",
  },
  client_review: {
    labelKey: "wsFase_client_review",
    cls: "ws-ef-feedbackrdy",
    group: "client",
  },
  client_revision: {
    labelKey: "wsFase_client_revision",
    cls: "ws-ef-spotting",
    group: "client",
  },
  client_approved: {
    labelKey: "wsFase_client_approved",
    cls: "ws-ef-finished",
    group: "client",
  },
  uploaddrive: {
    labelKey: "wsFase_uploaddrive",
    cls: "ws-ef-uploaddrive",
    group: "done",
  },
  finished: { labelKey: "wsFase_finished", cls: "ws-ef-finished", group: "done" },
};

const GROUPS = [
  { key: "intern", labelKey: "wsGroup_intern" },
  { key: "client", labelKey: "wsGroup_client" },
  { key: "done", labelKey: "wsGroup_done" },
];
const WS_TABS = [
  { key: "inbox", labelKey: "wsTab_inbox", icon: "📥" },
  { key: "stage", labelKey: "wsTab_stage", icon: "🎯" },
  { key: "deadlines", labelKey: "wsTab_deadlines", icon: "📅" },
  { key: "shoots", labelKey: "wsTab_shoots", icon: "🎬" },
  { key: "month", labelKey: "wsTab_month", icon: "🗓" },
  { key: "clients", labelKey: "wsTab_clients", icon: "👥" },
  { key: "editors", labelKey: "wsTab_editors", icon: "🧑‍💻" },
];
const SHOOT_STATUS_MAP = {
  wrapped: { labelKey: "wsShoot_wrapped", cls: "ws-ss-wrapped" },
  tentative: { labelKey: "wsShoot_tentative", cls: "ws-ss-tentative" },
  waiting: { labelKey: "wsShoot_waiting", cls: "ws-ss-waiting" },
  planned: { labelKey: "wsShoot_planned", cls: "ws-ss-planned" },
};
const PROJECT_STAGE_MAP = {
  development: { labelKey: "wsStage_development", cls: "ws-ps-development" },
  preproduction: { labelKey: "wsStage_preproduction", cls: "ws-ps-preproduction" },
  shooting: { labelKey: "wsStage_shooting", cls: "ws-ps-shooting" },
  "post-production": { labelKey: "wsStage_postproduction", cls: "ws-ps-postproduction" },
  completed: { labelKey: "wsStage_completed", cls: "ws-ps-completed" },
};
const AV_COLORS = {
  Paolo: "var(--accent)",
  Lex: "var(--sage)",
  Rick: "var(--blue)",
  Ray: "var(--amber)",
  Boy: "var(--text-3)",
};
const AV_INIT = {
  Paolo: "P",
  Lex: "L",
  Rick: "R",
  Ray: "Ra",
  Boy: "B",
};
const WS_RES_TABS = [
  { key: "scripts", labelKey: "wsRes_scripts", icon: "📄" },
  { key: "props", labelKey: "wsRes_props", icon: "🎭" },
  { key: "cast", labelKey: "wsRes_cast", icon: "👤" },
  { key: "shotlist", labelKey: "wsRes_shotlist", icon: "🎬" },
  { key: "moodboard", labelKey: "wsRes_moodboard", icon: "🖼️" },
  { key: "interview", labelKey: "wsRes_interview", icon: "💬" },
];

function FaseSelect({ value, onChange }) {
  const { t } = useLang();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontSize: "10px",
        fontWeight: "700",
        width: "100%",
        border: "1.5px solid var(--border)",
        borderRadius: "6px",
        padding: "3px 8px",
        cursor: "pointer",
        fontFamily: "DM Sans,sans-serif",
        background: "var(--bg-alt)",
      }}
    >
      {GROUPS.map((g) => (
        <optgroup key={g.key} label={t(g.labelKey)}>
          {Object.entries(FASE_MAP)
            .filter(([, m]) => m.group === g.key)
            .map(([k, m]) => (
              <option key={k} value={k}>
                {t(m.labelKey)}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function WorkspaceView() {
  const { user, isTeamAdmin } = useAuth();
  const { t, lang } = useLang();
  const [wsTab, setWsTab] = useState("inbox");
  const [batchId, setBatchId] = useState(null);
  const [addVideoBatchId, setAddVideoBatchId] = useState(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showCreateBatchModal, setShowCreateBatchModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectNameError, setProjectNameError] = useState("");
  const [newBatchSubName, setNewBatchSubName] = useState("");
  const [newBatch, setNewBatch] = useState({
    name: "",
    client: "",
    editor: "",
    projectStage: "preproduction",
    shootDate: "",
    shootTime: "",
    deadline: "",
  });
  const [newBatchErrors, setNewBatchErrors] = useState({});
  const [scriptVideo, setScriptVideo] = useState(null);
  const [scriptDraft, setScriptDraft] = useState("");
  const [shotVideo, setShotVideo] = useState(null);
  const [shotDraft, setShotDraft] = useState("");
  const [shootMode, setShootMode] = useState(false);
  const [sopVideo, setSopVideo] = useState(null);
  const [sopDraft, setSopDraft] = useState(null);
  const [pendingDeleteBatch, setPendingDeleteBatch] = useState(null);
  const [pendingDeleteSubBatch, setPendingDeleteSubBatch] = useState(null);
  const [newVideoName, setNewVideoName] = useState("");
  const [newLink, setNewLink] = useState({ label: "", url: "" });
  const [resTab, setResTab] = useState("scripts");
  const [resDraftName, setResDraftName] = useState("");
  const [resDraftNote, setResDraftNote] = useState("");
  const [batchNotesDraft, setBatchNotesDraft] = useState("");
  const [batchNotesStatus, setBatchNotesStatus] = useState("idle");
  const [batchNotesError, setBatchNotesError] = useState("");
  const shotOverlayRef = useRef(null);
  const navigate = useNavigate();
  const { batchId: routeBatchId } = useParams();
  const qc = useQueryClient();

  const { data: batches = [], isLoading: isWorkspacesLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: getWorkspaces,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients,
    enabled: isTeamAdmin,
  });
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team"],
    queryFn: getTeamMembers,
    enabled: isTeamAdmin,
  });
  const updateMut = useMutation({
    mutationFn: ({ wsId, subBId, vId, ...d }) =>
      updateWorkspaceVideo(wsId, subBId, vId, d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
  const createBatchMut = useMutation({
    mutationFn: createWorkspace,
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      if (created?._id) setBatchId(created._id);
    },
  });
  const deleteBatchMut = useMutation({
    mutationFn: deleteWorkspace,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      if (batchId) setBatchId(null);
    },
  });
  const updateBatchMut = useMutation({
    mutationFn: ({ id, data }) => updateWorkspace(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
  const updateBatchNotesMut = useMutation({
    mutationFn: ({ id, notes }) => updateWorkspace(id, { notes }),
    onSuccess: () => {
      setBatchNotesStatus("saved");
      setBatchNotesError("");
      qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error) => {
      setBatchNotesStatus("error");
      setBatchNotesError(
        error instanceof Error ? error.message : "Failed to save batch notes.",
      );
    },
  });
  const addSubBatchMut = useMutation({
    mutationFn: ({ wsId, data }) => addWorkspaceBatch(wsId, data),
    onSuccess: (ws) => {
      qc.setQueryData(["workspaces"], (prev = []) =>
        prev.map((w) => (w._id === ws._id ? ws : w)),
      );
      qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
  const deleteSubBatchMut = useMutation({
    mutationFn: ({ wsId, bId }) => deleteWorkspaceBatch(wsId, bId),
    onSuccess: (ws) => {
      if (ws && ws._id) {
        qc.setQueryData(["workspaces"], (prev = []) =>
          prev.map((w) => (w._id === ws._id ? ws : w)),
        );
      }
      qc.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const batch = batches.find((b) => b._id === batchId);
  const subBatches = batch?.batches || [];
  useEffect(() => {
    const nextNotes = batch?.notes || "";
    setBatchNotesDraft(nextNotes);
    setBatchNotesStatus("idle");
    setBatchNotesError("");
  }, [batchId, batch?.notes]);

  useEffect(() => {
    if (batchNotesStatus !== "saved") return undefined;
    const timeout = setTimeout(() => setBatchNotesStatus("idle"), 1600);
    return () => clearTimeout(timeout);
  }, [batchNotesStatus]);

  const findSubBatchByVideoId = (videoId) => {
    if (!videoId) return null;
    for (const sb of subBatches) {
      if ((sb.videos || []).some((v) => v._id === videoId)) return sb;
    }
    return null;
  };
  const formatShortDate = (isoDate) => {
    if (!isoDate) return "—";
    const dt = new Date(isoDate);
    if (Number.isNaN(dt.getTime())) return "—";
    const locale = lang === "en" ? "en-GB" : "nl-NL";
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    }).format(dt);
  };

  const filteredBatches = useMemo(() => {
    const list = [...batches];
    if (wsTab === "stage") {
      const order = [
        "development",
        "preproduction",
        "shooting",
        "post-production",
        "completed",
      ];
      list.sort(
        (a, b) => order.indexOf(a.projectStage) - order.indexOf(b.projectStage),
      );
      return list;
    }
    if (wsTab === "deadlines") {
      return list
        .filter((b) => !!b.deadline)
        .sort(
          (a, b) =>
            new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
        );
    }
    if (wsTab === "shoots") {
      return list
        .filter((b) => !!b.shootDate)
        .sort(
          (a, b) =>
            new Date(b.shootDate).getTime() - new Date(a.shootDate).getTime(),
        );
    }
    if (wsTab === "month") {
      const now = new Date();
      return list.filter((b) => {
        if (!b.deadline) return false;
        const dt = new Date(b.deadline);
        return (
          !Number.isNaN(dt.getTime()) &&
          dt.getMonth() === now.getMonth() &&
          dt.getFullYear() === now.getFullYear()
        );
      });
    }
    if (wsTab === "clients") {
      return list.sort((a, b) => {
        const clientA = (a.client || "").trim().toLowerCase();
        const clientB = (b.client || "").trim().toLowerCase();
        if (clientA && !clientB) return -1;
        if (!clientA && clientB) return 1;
        if (clientA !== clientB) return clientA.localeCompare(clientB);
        const ad = a.shootDate ? new Date(a.shootDate).getTime() : -Infinity;
        const bd = b.shootDate ? new Date(b.shootDate).getTime() : -Infinity;
        return bd - ad;
      });
    }
    if (wsTab === "editors") {
      return list.sort((a, b) => {
        const editorA = (a.editor || "").trim().toLowerCase();
        const editorB = (b.editor || "").trim().toLowerCase();
        if (editorA && !editorB) return -1;
        if (!editorA && editorB) return 1;
        if (editorA !== editorB) return editorA.localeCompare(editorB);

        const clientA = (a.client || "").trim().toLowerCase();
        const clientB = (b.client || "").trim().toLowerCase();
        if (clientA && !clientB) return -1;
        if (!clientA && clientB) return 1;
        if (clientA !== clientB) return clientA.localeCompare(clientB);

        const ad = a.shootDate ? new Date(a.shootDate).getTime() : -Infinity;
        const bd = b.shootDate ? new Date(b.shootDate).getTime() : -Infinity;
        return bd - ad;
      });
    }
    return list.sort((a, b) => {
      const ad = a.shootDate ? new Date(a.shootDate).getTime() : -Infinity;
      const bd = b.shootDate ? new Date(b.shootDate).getTime() : -Infinity;
      return bd - ad;
    });
  }, [batches, wsTab]);

  useEffect(() => {
    if (routeBatchId) {
      setBatchId(routeBatchId);
      return;
    }
    setBatchId(null);
  }, [routeBatchId]);

  useEffect(() => {
    if (!routeBatchId || batches.length === 0) return;
    const exists = batches.some((entry) => entry._id === routeBatchId);
    if (!exists) navigate("/dashboard/workspace", { replace: true });
  }, [routeBatchId, batches, navigate]);

  const scriptWords = useMemo(
    () => (scriptDraft.trim() ? scriptDraft.trim().split(/\s+/).length : 0),
    [scriptDraft],
  );

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setShootMode(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const openScript = (video) => {
    setScriptVideo(video);
    setScriptDraft(video.script || "");
  };
  const saveScript = () => {
    if (!batch || !scriptVideo) return;
    const sb = findSubBatchByVideoId(scriptVideo._id);
    if (!sb) {
      setScriptVideo(null);
      return;
    }
    updateMut.mutate({
      wsId: batch._id,
      subBId: sb._id,
      vId: scriptVideo._id,
      script: scriptDraft,
    });
    setScriptVideo(null);
  };

  const openShotlist = (video) => {
    setShotVideo(video);
    setShotDraft("");
    setShootMode(false);
  };
  const saveShotlist = (nextShotlist) => {
    if (!batch || !shotVideo) return;
    const sb = findSubBatchByVideoId(shotVideo._id);
    if (!sb) return;
    updateMut.mutate({
      wsId: batch._id,
      subBId: sb._id,
      vId: shotVideo._id,
      shotlist: nextShotlist,
    });
  };
  const toggleShot = (idx) => {
    if (!shotVideo) return;
    const list = (shotVideo.shotlist || []).map((s, i) =>
      i === idx ? { ...s, done: !s.done } : s,
    );
    setShotVideo({ ...shotVideo, shotlist: list });
    saveShotlist(list);
  };
  const addShot = () => {
    if (!shotVideo || !shotDraft.trim()) return;
    const list = [
      ...(shotVideo.shotlist || []),
      { text: shotDraft.trim(), done: false },
    ];
    setShotVideo({ ...shotVideo, shotlist: list });
    saveShotlist(list);
    setShotDraft("");
  };
  const removeShot = (idx) => {
    if (!shotVideo) return;
    const list = (shotVideo.shotlist || []).filter((_, i) => i !== idx);
    setShotVideo({ ...shotVideo, shotlist: list });
    saveShotlist(list);
  };
  const resetShots = () => {
    if (!shotVideo) return;
    const list = (shotVideo.shotlist || []).map((s) => ({ ...s, done: false }));
    setShotVideo({ ...shotVideo, shotlist: list });
    saveShotlist(list);
  };
  const toggleShootMode = async () => {
    if (!shotOverlayRef.current) return;
    if (!shootMode) {
      try {
        if (!document.fullscreenElement)
          await shotOverlayRef.current.requestFullscreen();
      } catch (_) {}
      setShootMode(true);
    } else {
      if (document.fullscreenElement) await document.exitFullscreen();
      setShootMode(false);
    }
  };

  const closeShotlist = async () => {
    if (shootMode) {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
      } catch (_) {}
      setShootMode(false);
    }
    setShotVideo(null);
  };

  const openSop = (video) => {
    setSopVideo(video);
    setSopDraft({
      format: video.sop?.format || "",
      muziek: video.sop?.muziek || "",
      kleurprofiel: video.sop?.kleurprofiel || "",
      extraNotes: video.sop?.extraNotes || "",
      ratioTags: video.sop?.ratioTags || [],
      stijlTags: video.sop?.stijlTags || [],
    });
  };
  const closeSop = () => {
    if (!batch || !sopVideo || !sopDraft) {
      setSopVideo(null);
      return;
    }
    const sb = findSubBatchByVideoId(sopVideo._id);
    if (!sb) {
      setSopVideo(null);
      return;
    }
    updateMut.mutate({
      wsId: batch._id,
      subBId: sb._id,
      vId: sopVideo._id,
      sop: sopDraft,
    });
    setSopVideo(null);
  };

  const SOP_RATIO_OPTIONS = [
    t("wsRatio_reels"),
    t("wsRatio_youtube"),
    t("wsRatio_feed"),
    t("wsRatio_portrait"),
  ];
  const SOP_STIJL_OPTIONS = [
    t("wsStyle_fastcuts"),
    t("wsStyle_cinematic"),
    t("wsStyle_textoverlays"),
    t("wsStyle_voiceover"),
    t("wsStyle_musicheavy"),
    t("wsStyle_mooddriven"),
  ];
  const toggleTag = (key, value) => {
    if (!sopDraft) return;
    const arr = sopDraft[key] || [];
    const next = arr.includes(value)
      ? arr.filter((x) => x !== value)
      : [...arr, value];
    setSopDraft({ ...sopDraft, [key]: next });
  };

  const updateNewBatchField = (field, value) => {
    setNewBatch((prev) => ({ ...prev, [field]: value }));
    setNewBatchErrors((prev) => {
      if (!prev[field] && !(field === "deadline" && prev.dateOrder)) return prev;
      const next = { ...prev };
      delete next[field];
      if (field === "shootDate" || field === "deadline") delete next.dateOrder;
      return next;
    });
  };

  const validateNewBatch = () => {
    const errors = {};
    if (!newBatch.name.trim()) errors.name = "Project name is required.";
    if (!newBatch.client) errors.client = "Client is required.";
    if (!newBatch.projectStage) errors.projectStage = "Phase is required.";
    if (!newBatch.shootDate) errors.shootDate = "Shoot date is required.";
    if (!newBatch.shootTime) errors.shootTime = t("wsShootTimeRequiredError");
    if (!newBatch.deadline) errors.deadline = "Deadline is required.";
    if (!newBatch.editor) errors.editor = "Lead editor is required.";
    if (
      newBatch.shootDate &&
      newBatch.deadline &&
      new Date(newBatch.deadline) < new Date(newBatch.shootDate)
    ) {
      errors.dateOrder = "Deadline must be on or after shoot date.";
    }
    return errors;
  };

  const createNewBatch = () => {
    const errors = validateNewBatch();
    setNewBatchErrors(errors);
    if (Object.keys(errors).length) return;

    createBatchMut.mutate(
      {
        name: newBatch.name.trim(),
        client: newBatch.client,
        editor: newBatch.editor,
        projectStage: newBatch.projectStage,
        shootStatus: "planned",
        deadline: newBatch.deadline,
        shootDate: newBatch.shootDate,
        shootTime: newBatch.shootTime,
        videos: [],
      },
      {
        onSuccess: () => {
          setShowBatchModal(false);
          setNewBatchErrors({});
          setNewBatch({
            name: "",
            client: "",
            editor: "",
            projectStage: "preproduction",
            shootDate: "",
            shootTime: "",
            deadline: "",
          });
        },
      },
    );
  };

  const createNewVideo = async () => {
    if (!batch || !addVideoBatchId || !newVideoName.trim()) return;
    await addWorkspaceVideo(batch._id, addVideoBatchId, {
      name: newVideoName.trim(),
      editFase: "tentative",
    });
    setNewVideoName("");
    setAddVideoBatchId(null);
    qc.invalidateQueries({ queryKey: ["workspaces"] });
  };

  const createNewSubBatch = () => {
    const name = newBatchSubName.trim();
    if (!batch || !name) return;
    addSubBatchMut.mutate(
      { wsId: batch._id, data: { name } },
      {
        onSuccess: () => {
          setShowCreateBatchModal(false);
          setNewBatchSubName("");
        },
      },
    );
  };

  if (user?.role !== "team") {
    return <Navigate to="/portaal" replace />;
  }

  const deleteWorkspaceOverlay = pendingDeleteBatch && (
    <div
      className="modal-overlay open"
      onMouseDown={() => {
        if (!deleteBatchMut.isLoading) setPendingDeleteBatch(null);
      }}
    >
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("wsDeleteWorkspace")}</div>
          <button
            className="modal-close"
            onClick={() => setPendingDeleteBatch(null)}
            disabled={deleteBatchMut.isLoading}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "4px 2px 8px", color: "var(--text-2)" }}>
          {t("wsConfirmDeleteBatch", { name: pendingDeleteBatch.name })}
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-ghost"
            onClick={() => setPendingDeleteBatch(null)}
            disabled={deleteBatchMut.isLoading}
          >
            {t("cancel")}
          </button>
          <button
            className="btn btn-primary"
            style={{ background: "#c04040", borderColor: "#c04040" }}
            disabled={deleteBatchMut.isLoading}
            onClick={() => {
              const id = pendingDeleteBatch._id;
              const isCurrent = batchId === id;
              deleteBatchMut.mutate(id, {
                onSuccess: () => {
                  setPendingDeleteBatch(null);
                  if (isCurrent) setBatchId(null);
                },
              });
            }}
          >
            {t("wsDeleteWorkspace")}
          </button>
        </div>
      </div>
    </div>
  );

  const editProjectOverlay = showEditProjectModal && batch && (
    <div
      className="modal-overlay open"
      onMouseDown={() => setShowEditProjectModal(false)}
    >
      <div className="modal" style={{ maxWidth: "520px" }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("wsEditProject")}</div>
          <button
            className="modal-close"
            onClick={() => setShowEditProjectModal(false)}
          >
            ✕
          </button>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="ws-edit-project-name">{t("wsProjectNameLabel")}</label>
          <input
            id="ws-edit-project-name"
            className="form-input"
            value={projectNameDraft}
            onChange={(e) => {
              setProjectNameDraft(e.target.value);
              if (projectNameError) setProjectNameError("");
            }}
            placeholder={t("wsProjectNameExample")}
          />
          {projectNameError ? (
            <div style={{ marginTop: "6px", fontSize: "12px", color: "#c04040" }}>
              {projectNameError}
            </div>
          ) : null}
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-ghost"
            onClick={() => setShowEditProjectModal(false)}
          >
            {t("cancel")}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              const nextName = projectNameDraft.trim();
              if (!nextName) {
                setProjectNameError(t("wsProjectNameRequired"));
                return;
              }
              updateBatchMut.mutate(
                { id: batch._id, data: { name: nextName } },
                {
                  onSuccess: () => {
                    setShowEditProjectModal(false);
                    setProjectNameError("");
                  },
                },
              );
            }}
          >
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );

  const batchCreateOverlay = showBatchModal && (
    <div
      className="modal-overlay open"
      onMouseDown={() => setShowBatchModal(false)}
    >
      <div
        className="modal ws-create-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header ws-create-modal-head">
          <div className="modal-title" style={{ fontSize: "24px" }}>
            {t("wsNewWorkspaceProject")}
          </div>
          <button
            className="modal-close"
            onClick={() => setShowBatchModal(false)}
          >
            ✕
          </button>
        </div>
        <div className="form-group">
          <label className="form-label">{t("wsProjectNameLabel")}</label>
          <input
            className="form-input"
            style={newBatchErrors.name ? { borderColor: "#c04040" } : undefined}
            value={newBatch.name}
            onChange={(e) => updateNewBatchField("name", e.target.value)}
            placeholder={t("wsProjectNameExample")}
          />
          {newBatchErrors.name && (
            <div style={{ marginTop: "6px", fontSize: "12px", color: "#c04040" }}>
              {newBatchErrors.name}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">{t("taskClientLabel")}</label>
          <select
            className="form-select"
            style={newBatchErrors.client ? { borderColor: "#c04040" } : undefined}
            value={newBatch.client}
            onChange={(e) => updateNewBatchField("client", e.target.value)}
          >
            <option value="">{t("taskClientPlaceholder")}</option>
            {clients.map((c) => (
              <option key={c._id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          {newBatchErrors.client && (
            <div style={{ marginTop: "6px", fontSize: "12px", color: "#c04040" }}>
              {newBatchErrors.client}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">{t("phase")}</label>
          <select
            className="form-select"
            style={newBatchErrors.projectStage ? { borderColor: "#c04040" } : undefined}
            value={newBatch.projectStage}
            onChange={(e) => updateNewBatchField("projectStage", e.target.value)}
          >
            <option value="development">{t("wsStage_development")}</option>
            <option value="preproduction">{t("wsStage_preproduction")}</option>
            <option value="shooting">{t("wsStage_shooting")}</option>
            <option value="post-production">{t("wsStage_postproduction")}</option>
            <option value="completed">{t("wsStage_completed")}</option>
          </select>
          {newBatchErrors.projectStage && (
            <div style={{ marginTop: "6px", fontSize: "12px", color: "#c04040" }}>
              {newBatchErrors.projectStage}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">{t("wsShootDateLabel")}</label>
          <input
            type="date"
            className="form-input"
            style={newBatchErrors.shootDate ? { borderColor: "#c04040" } : undefined}
            value={newBatch.shootDate}
            onChange={(e) => updateNewBatchField("shootDate", e.target.value)}
          />
          {newBatchErrors.shootDate && (
            <div style={{ marginTop: "6px", fontSize: "12px", color: "#c04040" }}>
              {newBatchErrors.shootDate}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">{t("wsShootTimeLabel")}</label>
          <input
            type="time"
            className="form-input"
            style={newBatchErrors.shootTime ? { borderColor: "#c04040" } : undefined}
            value={newBatch.shootTime}
            onChange={(e) => updateNewBatchField("shootTime", e.target.value)}
          />
          {newBatchErrors.shootTime && (
            <div style={{ marginTop: "6px", fontSize: "12px", color: "#c04040" }}>
              {newBatchErrors.shootTime}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">{t("wsDeadlineLabel")}</label>
          <input
            type="date"
            className="form-input"
            style={newBatchErrors.deadline ? { borderColor: "#c04040" } : undefined}
            value={newBatch.deadline}
            onChange={(e) => updateNewBatchField("deadline", e.target.value)}
          />
          {newBatchErrors.deadline && (
            <div style={{ marginTop: "6px", fontSize: "12px", color: "#c04040" }}>
              {newBatchErrors.deadline}
            </div>
          )}
          {newBatchErrors.dateOrder && (
            <div style={{ marginTop: "6px", fontSize: "12px", color: "#c04040" }}>
              {newBatchErrors.dateOrder}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">{t("wsLeadEditorLabel")}</label>
          <select
            className="form-select"
            style={newBatchErrors.editor ? { borderColor: "#c04040" } : undefined}
            value={newBatch.editor}
            onChange={(e) => updateNewBatchField("editor", e.target.value)}
          >
            <option value="">{t("wsTeamPlaceholder")}</option>
            {teamMembers.map((member) => (
              <option key={member._id || member.email || member.name} value={member.name}>
                {member.name}
                {member.role ? ` — ${member.role}` : ""}
              </option>
            ))}
          </select>
          {newBatchErrors.editor && (
            <div style={{ marginTop: "6px", fontSize: "12px", color: "#c04040" }}>
              {newBatchErrors.editor}
            </div>
          )}
        </div>
        <div className="modal-footer ws-create-modal-foot">
          <button
            className="btn btn-ghost ws-create-modal-btn ws-create-modal-btn-ghost"
            onClick={() => setShowBatchModal(false)}
          >
            {t("cancel")}
          </button>
          <button
            className="btn btn-primary ws-create-modal-btn"
            disabled={createBatchMut.isPending}
            onClick={createNewBatch}
            style={createBatchMut.isPending ? { display: "inline-flex", alignItems: "center", gap: "8px" } : undefined}
          >
            {createBatchMut.isPending ? (
              <>
                <LoadingSpinner size={18} />
                <span>{t("wsCreateProject")}</span>
              </>
            ) : (
              t("wsCreateProject")
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const subBatchCreateOverlay = showCreateBatchModal && batch && (
    <div
      className="modal-overlay open"
      onMouseDown={() => setShowCreateBatchModal(false)}
    >
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("wsNewBatchTitle")}</div>
          <button
            className="modal-close"
            onClick={() => setShowCreateBatchModal(false)}
          >
            ✕
          </button>
        </div>
        <div className="form-group">
          <label className="form-label">{t("wsBatchNameLabel")}</label>
          <input
            autoFocus
            className="form-input"
            value={newBatchSubName}
            onChange={(e) => setNewBatchSubName(e.target.value)}
            placeholder={t("wsBatchNameExample")}
            onKeyDown={(e) => {
              if (e.key === "Enter") createNewSubBatch();
            }}
          />
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-ghost"
            onClick={() => setShowCreateBatchModal(false)}
          >
            {t("cancel")}
          </button>
          <button
            className="btn btn-primary"
            disabled={!newBatchSubName.trim() || addSubBatchMut.isPending}
            onClick={createNewSubBatch}
            style={addSubBatchMut.isPending ? { display: "inline-flex", alignItems: "center", gap: "8px" } : undefined}
          >
            {addSubBatchMut.isPending ? (
              <>
                <LoadingSpinner size={18} />
                <span>{t("wsCreateBatch")}</span>
              </>
            ) : (
              t("wsCreateBatch")
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const subBatchDeleteOverlay = pendingDeleteSubBatch && batch && (
    <div
      className="modal-overlay open"
      onMouseDown={() => {
        if (!deleteSubBatchMut.isLoading) setPendingDeleteSubBatch(null);
      }}
    >
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{t("wsDeleteBatchBtn")}</div>
          <button
            className="modal-close"
            onClick={() => setPendingDeleteSubBatch(null)}
            disabled={deleteSubBatchMut.isLoading}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "4px 2px 8px", color: "var(--text-2)" }}>
          {t("wsConfirmDeleteBatchSub", { name: pendingDeleteSubBatch.name })}
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-ghost"
            onClick={() => setPendingDeleteSubBatch(null)}
            disabled={deleteSubBatchMut.isLoading}
          >
            {t("cancel")}
          </button>
          <button
            className="btn btn-primary"
            style={{ background: "#c04040", borderColor: "#c04040" }}
            disabled={deleteSubBatchMut.isLoading}
            onClick={() => {
              deleteSubBatchMut.mutate(
                { wsId: batch._id, bId: pendingDeleteSubBatch._id },
                {
                  onSuccess: () => {
                    setPendingDeleteSubBatch(null);
                  },
                },
              );
            }}
          >
            {t("wsDeleteBatchBtn")}
          </button>
        </div>
      </div>
    </div>
  );

  const scriptShotSopOverlays = (
    <>
      {scriptVideo && (
        <div
          id="script-overlay"
          className="open"
          onMouseDown={() => setScriptVideo(null)}
        >
          <div id="script-box" onMouseDown={(e) => e.stopPropagation()}>
            <div id="script-head">
              <span style={{ fontSize: "18px", flexShrink: 0 }} aria-hidden>
                📝
              </span>
              <span id="script-head-title">
                {t("script")} — {scriptVideo.name}
              </span>
              <button
                type="button"
                className="modal-close"
                onClick={() => setScriptVideo(null)}
                aria-label={t("close")}
              >
                ✕
              </button>
            </div>
            <textarea
              id="script-textarea"
              value={scriptDraft}
              onChange={(e) => setScriptDraft(e.target.value)}
              placeholder={
                t("wsScriptPlaceholder")
              }
            />
            <div id="script-foot">
              <span id="script-char-count">
                {t("wsScriptStats", { words: scriptWords, chars: scriptDraft.length })}
              </span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setScriptVideo(null)}
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={saveScript}
                >
                  {t("save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shotVideo && (
        <div
          id="sl-overlay"
          ref={shotOverlayRef}
          className={`open${shootMode ? " shootmode" : ""}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) void closeShotlist();
          }}
        >
          <div id="sl-box" onMouseDown={(e) => e.stopPropagation()}>
            <div id="sl-head">
              <span style={{ fontSize: "18px", flexShrink: 0 }} aria-hidden>
                🎬
              </span>
              <span id="sl-head-title">{t("shotlist")} — {shotVideo.name}</span>
              <div
                id="sl-head-right"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginLeft: "auto",
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  id="sl-shootbtn"
                  className={`sl-shootbtn${shootMode ? " on" : ""}`}
                  onClick={toggleShootMode}
                >
                  {shootMode ? t("wsCloseShootMode") : t("shootMode")}
                </button>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => closeShotlist()}
                  aria-label={t("close")}
                >
                  ✕
                </button>
              </div>
            </div>
            <div id="sl-content">
              <div id="sl-list-side">
                {(shotVideo.shotlist || []).length > 0 && (
                  <div id="sl-progress-wrap">
                    <div id="sl-progress-bar">
                      <div
                        id="sl-progress-fill"
                        style={{
                          width: `${Math.round(((shotVideo.shotlist || []).filter((s) => s.done).length / Math.max((shotVideo.shotlist || []).length, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div id="sl-progress-txt">
                      {(shotVideo.shotlist || []).filter((s) => s.done).length}/
                      {(shotVideo.shotlist || []).length} {t("wsShotsDone")} ·{" "}
                      {Math.round(
                        ((shotVideo.shotlist || []).filter((s) => s.done).length /
                          Math.max((shotVideo.shotlist || []).length, 1)) *
                          100,
                      )}
                      %
                    </div>
                  </div>
                )}
                <div id="sl-list-wrap">
                  <div id="sl-list">
                    {(shotVideo.shotlist || []).length === 0 ? (
                      <div
                        style={{
                          padding: "20px 24px",
                          fontSize: "13px",
                          color: "var(--text-3)",
                          fontStyle: "italic",
                        }}
                      >
                        {t("wsNoShots")}
                      </div>
                    ) : (
                      (shotVideo.shotlist || []).map((s, i) => (
                        <div
                          key={`${s.text}-${i}`}
                          className={`sl-item${s.done ? " done" : ""}`}
                          onClick={() => toggleShot(i)}
                        >
                          <div className="sl-cb">{s.done ? "✓" : ""}</div>
                          <div className="sl-num">
                            {String(i + 1).padStart(2, "0")}
                          </div>
                          <div className="sl-text">{s.text}</div>
                          <button
                            type="button"
                            className="sl-del"
                            title={t("delete")}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeShot(i);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div id="sl-add-row">
                  <input
                    id="sl-add-inp"
                    value={shotDraft}
                    onChange={(e) => setShotDraft(e.target.value)}
                    placeholder={t("wsShotAddPlaceholder")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addShot();
                      }
                    }}
                  />
                  <button type="button" id="sl-add-btn" onClick={addShot}>
                    {t("shotlistAdd")}
                  </button>
                </div>
              </div>
              <div id="sl-script-side">
                <div
                  style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--bg-alt)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "16px" }} aria-hidden>
                    📝
                  </span>
                  <span
                    style={{
                      fontFamily: "Montserrat, sans-serif",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--text)",
                    }}
                  >
                    {t("script")}
                  </span>
                </div>
                <div id="sl-script-panel">
                  {shotVideo.script?.trim()
                    ? shotVideo.script
                    : t("wsScriptUnavailable")}
                </div>
              </div>
            </div>
            <div id="sl-foot">
              <button
                type="button"
                className="sl-reset-btn"
                onClick={resetShots}
              >
                ↺ Reset alle vinkjes
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => closeShotlist()}
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {sopVideo && sopDraft && (
        <div
          id="sop-overlay"
          className="open"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSop();
          }}
        >
          <div id="sop-box" onMouseDown={(e) => e.stopPropagation()}>
            <div id="sop-head">
              <span style={{ fontSize: "18px", flexShrink: 0 }} aria-hidden>
                📋
              </span>
              <span id="sop-head-title">{t("sop")} — {sopVideo.name}</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => closeSop()}
                aria-label={t("close")}
              >
                ✕
              </button>
            </div>
            <div id="sop-body">
              <div>
                <div className="sop-card">
                  <div className="sop-card-title">{t("wsSopFormatRatio")}</div>
                  <div className="sop-tags">
                    {SOP_RATIO_OPTIONS.map((tag) => {
                      const on = (sopDraft.ratioTags || []).includes(tag);
                      return (
                        <button
                          type="button"
                          key={tag}
                          className={`sop-tag${on ? " on" : ""}`}
                          onClick={() => toggleTag("ratioTags", tag)}
                        >
                          {on ? "✓ " : ""}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  <label className="sop-lbl">
                    {t("wsSopDurationLabel")}
                  </label>
                  <input
                    className="sop-inp"
                    id="sop-f-format"
                    value={sopDraft.format}
                    onChange={(e) =>
                      setSopDraft({ ...sopDraft, format: e.target.value })
                    }
                    placeholder={t("wsSopDurationPlaceholder")}
                  />
                </div>
                <div className="sop-card" style={{ marginTop: "12px" }}>
                  <div className="sop-card-title">{t("wsSopStyleFeel")}</div>
                  <div className="sop-tags">
                    {SOP_STIJL_OPTIONS.map((tag) => {
                      const on = (sopDraft.stijlTags || []).includes(tag);
                      return (
                        <button
                          type="button"
                          key={tag}
                          className={`sop-tag${on ? " on" : ""}`}
                          onClick={() => toggleTag("stijlTags", tag)}
                        >
                          {on ? "✓ " : ""}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                  <label className="sop-lbl">{t("wsSopLutLabel")}</label>
                  <input
                    className="sop-inp"
                    id="sop-f-kleurprofiel"
                    value={sopDraft.kleurprofiel}
                    onChange={(e) =>
                      setSopDraft({ ...sopDraft, kleurprofiel: e.target.value })
                    }
                    placeholder={t("wsSopLutPlaceholder")}
                  />
                </div>
              </div>
              <div>
                <div className="sop-card">
                  <div className="sop-card-title">{t("wsSopMusicAudio")}</div>
                  <textarea
                    className="sop-ta"
                    id="sop-f-muziek"
                    value={sopDraft.muziek}
                    onChange={(e) =>
                      setSopDraft({ ...sopDraft, muziek: e.target.value })
                    }
                    placeholder={t("wsSopMusicPlaceholder")}
                  />
                </div>
                <div className="sop-card" style={{ marginTop: "12px" }}>
                  <div className="sop-card-title">
                    {t("wsSopEditorInstructions")}
                  </div>
                  <textarea
                    className="sop-ta"
                    id="sop-f-extraNotes"
                    style={{ minHeight: "130px" }}
                    value={sopDraft.extraNotes}
                    onChange={(e) =>
                      setSopDraft({ ...sopDraft, extraNotes: e.target.value })
                    }
                    placeholder={
                      t("wsSopInstructionsPlaceholder")
                    }
                  />
                </div>
                <div
                  style={{
                    marginTop: "12px",
                    padding: "10px 14px",
                    background: "var(--accent-pale)",
                    borderRadius: "8px",
                    border: "1px solid var(--accent-light)",
                    fontSize: "12px",
                    color: "var(--text-2)",
                    lineHeight: 1.5,
                  }}
                >
                  {t("wsSopTip")}
                </div>
              </div>
            </div>
            <div id="sop-foot">
              <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {t("wsSopAutoSaved")}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => closeSop()}
              >
                {t("close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (batch) {
    const links = batch.links || [];
    const resources = batch.resources || {};
    const activeResources = resources[resTab] || [];
    const workflowSteps = [
      { n: 1, icon: "⬇️", title: t("wsWorkflowStep1Title"), desc: t("wsWorkflowStep1Desc") },
      { n: 2, icon: "✂️", title: t("wsWorkflowStep2Title"), desc: t("wsWorkflowStep2Desc") },
      { n: 3, icon: "🎬", title: t("wsWorkflowStep3Title"), desc: t("wsWorkflowStep3Desc") },
      { n: 4, icon: "📤", title: t("wsWorkflowStep4Title"), desc: t("wsWorkflowStep4Desc") },
      { n: 5, icon: "🔗", title: t("wsWorkflowStep5Title"), desc: t("wsWorkflowStep5Desc") },
      { n: 6, icon: "✅", title: t("wsWorkflowStep6Title"), desc: t("wsWorkflowStep6Desc") },
    ];

    const setBatchField = (field, value) => {
      if (!isTeamAdmin) return;
      updateBatchMut.mutate({ id: batch._id, data: { [field]: value } });
    };
    const saveBatchNotes = () => {
      if (!isTeamAdmin || !batch?._id) return;
      const nextNotes = batchNotesDraft.trim();
      const currentNotes = (batch.notes || "").trim();
      if (nextNotes === currentNotes) return;
      setBatchNotesStatus("saving");
      setBatchNotesError("");
      updateBatchNotesMut.mutate({ id: batch._id, notes: nextNotes });
    };

    const addProjectLink = () => {
      if (!isTeamAdmin) return;
      const label = newLink.label.trim();
      const url = newLink.url.trim();
      if (!url) return;
      const next = [...links, { label: label || url, url }];
      updateBatchMut.mutate({ id: batch._id, data: { links: next } });
      setNewLink({ label: "", url: "" });
    };

    const deleteProjectLink = (index) => {
      if (!isTeamAdmin) return;
      const next = links.filter((_, i) => i !== index);
      updateBatchMut.mutate({ id: batch._id, data: { links: next } });
    };

    const addResourceItem = () => {
      const name = resDraftName.trim();
      const note = resDraftNote.trim();
      if (!name) return;
      const nextResources = {
        ...resources,
        [resTab]: [...activeResources, { name, note, status: "" }],
      };
      updateBatchMut.mutate({
        id: batch._id,
        data: { resources: nextResources },
      });
      setResDraftName("");
      setResDraftNote("");
    };

    const deleteResourceItem = (idx) => {
      if (!isTeamAdmin) return;
      const nextResources = {
        ...resources,
        [resTab]: activeResources.filter((_, i) => i !== idx),
      };
      updateBatchMut.mutate({
        id: batch._id,
        data: { resources: nextResources },
      });
    };

    return (
      <>
        <section className="view active ws-detail-surface">
          <div className="ws-detail-topbar">
            <div className="ws-detail-breadcrumbs">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate("/dashboard/workspace")}
              >
                {t("wsBackAllWorkspaces")}
              </button>
              <span
                style={{ fontSize: "13px", color: "var(--text-3)" }}
                id="ws-crumb"
              ></span>
              <span className="ws-detail-chip">👤 {batch.client || "—"}</span>
              <span className="ws-detail-chip ws-detail-chip-current">
                📁 {batch.name}
              </span>
            </div>
            <div className="ws-detail-actions">
              {isTeamAdmin ? (
                <>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setProjectNameDraft(batch.name || "");
                      setProjectNameError("");
                      setShowEditProjectModal(true);
                    }}
                  >
                    ✏️ {t("wsEditProject")}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: "#c04040", borderColor: "#e8c8c8" }}
                    onClick={() => setPendingDeleteBatch(batch)}
                  >
                    🗑️ {t("wsDeleteWorkspace")}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowCreateBatchModal(true)}
                  >
                    {t("wsAddNewBatch")}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div
            className="ws-detail-card"
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              padding: "16px 16px 18px",
              marginBottom: "14px",
            }}
          >
            <div
              className="ws-detail-hero"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              <div style={{ fontSize: "26px" }}>{batch.emoji || "🎬"}</div>
              <div>
                <div
                  className="ws-detail-hero-title"
                  style={{
                    fontFamily: "Montserrat",
                    fontSize: "34px",
                    fontWeight: "500",
                    lineHeight: 1.05,
                  }}
                >
                  {batch.name}
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-3)" }}>
                  {batch.client} · {t("wsShootLabel")}: {batch.shootDate || "—"}
                </div>
              </div>
            </div>
            <div
              className="ws-prop-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6,minmax(0,1fr))",
                gap: "10px",
                marginBottom: "10px",
              }}
            >
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">{t("wsShootStatusLabel")}</div>
                <select
                  className="form-select"
                  value={batch.shootStatus || "planned"}
                  disabled={!isTeamAdmin}
                  onChange={(e) => setBatchField("shootStatus", e.target.value)}
                >
                  <option value="wrapped">{t("wsShoot_wrapped")}</option>
                  <option value="tentative">{t("wsShoot_tentative")}</option>
                  <option value="waiting">{t("wsShoot_waiting")}</option>
                  <option value="planned">{t("wsShoot_planned")}</option>
                </select>
              </div>
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">{t("wsShootDateLabel")}</div>
                <input
                  className="form-input ws-shoot-date-input"
                  type="date"
                  value={batch.shootDate || ""}
                  disabled={!isTeamAdmin}
                  onChange={(e) => setBatchField("shootDate", e.target.value)}
                />
              </div>
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">{t("wsShootTimeLabel")}</div>
                <input
                  className="form-input"
                  type="time"
                  value={batch.shootTime || ""}
                  disabled={!isTeamAdmin}
                  onChange={(e) => setBatchField("shootTime", e.target.value)}
                />
              </div>
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">{t("wsDeadlineLabel")}</div>
                <input
                  className="form-input ws-deadline-date-input"
                  type="date"
                  value={batch.deadline || ""}
                  disabled={!isTeamAdmin}
                  onChange={(e) => setBatchField("deadline", e.target.value)}
                />
              </div>
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">{t("wsEditorLabel")}</div>
                <select
                  className="form-select"
                  value={batch.editor || ""}
                  disabled={!isTeamAdmin}
                  onChange={(e) => setBatchField("editor", e.target.value)}
                >
                  <option value="">{t("wsTeamPlaceholder")}</option>
                  {teamMembers.map((member) => (
                    <option key={member._id || member.email || member.name} value={member.name}>
                      {member.name}
                    </option>
                  ))}
                  {batch.editor &&
                    !teamMembers.some((member) => member.name === batch.editor) && (
                      <option value={batch.editor}>{batch.editor}</option>
                    )}
                </select>
              </div>
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">{t("wsProjectStageLabel")}</div>
                <select
                  className="form-select"
                  value={batch.projectStage || "preproduction"}
                  disabled={!isTeamAdmin}
                  onChange={(e) =>
                    setBatchField("projectStage", e.target.value)
                  }
                >
                  <option value="development">{t("wsStage_development")}</option>
                  <option value="preproduction">{t("wsStage_preproduction")}</option>
                  <option value="shooting">{t("wsStage_shooting")}</option>
                  <option value="post-production">{t("wsStage_postproduction")}</option>
                  <option value="completed">{t("wsStage_completed")}</option>
                </select>
              </div>
              <div className="ws-prop-tile">
                <div className="ws-prop-tile-label">{t("taskClientLabel")}</div>
                <input
                  className="form-input"
                  value={batch.client || ""}
                  disabled={!isTeamAdmin}
                  onChange={(e) => setBatchField("client", e.target.value)}
                />
              </div>
            </div>
            <div className="ws-prop-tile ws-prop-tile-wide">
              <div className="ws-prop-tile-label">{t("wsBatchNotes")}</div>
              <textarea
                className="ws-prop-area"
                value={batchNotesDraft}
                disabled={!isTeamAdmin}
                onChange={(e) => {
                  setBatchNotesDraft(e.target.value);
                  if (batchNotesStatus === "saved" || batchNotesStatus === "error") {
                    setBatchNotesStatus("idle");
                  }
                }}
                onBlur={saveBatchNotes}
              />
              {batchNotesStatus === "saving" ? (
                <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-3)" }}>
                  Saving notes...
                </div>
              ) : null}
              {batchNotesStatus === "saved" ? (
                <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--sage)" }}>
                  Notes saved.
                </div>
              ) : null}
              {batchNotesStatus === "error" ? (
                <div style={{ marginTop: "6px", fontSize: "12px", color: "#c04040" }}>
                  {batchNotesError || "Failed to save batch notes."}
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="ws-detail-card"
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div className="ws-sop-title">
              {t("wsProjectLinksTitle")}
            </div>
            {links.map((lk, idx) => (
              <div key={`${lk.url}-${idx}`} className="ws-link-row-item">
                <span style={{ display: "inline-flex", width: "20px" }}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 87.3 78"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
                      fill="#0066da"
                    ></path>
                    <path
                      d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
                      fill="#00ac47"
                    ></path>
                    <path
                      d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
                      fill="#ea4335"
                    ></path>
                    <path
                      d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
                      fill="#00832d"
                    ></path>
                    <path
                      d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
                      fill="#2684fc"
                    ></path>
                    <path
                      d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
                      fill="#ffba00"
                    ></path>
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600 }}>
                    {lk.label}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-3)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {lk.url}
                  </div>
                </div>
                <a
                  href={
                    lk.url?.startsWith("http") ? lk.url : `https://${lk.url}`
                  }
                  target="_blank"
                  rel="noopener"
                  style={{ fontSize: "11px", color: "var(--text-2)" }}
                >
                  {t("wsOpenLink")}
                </a>
                {isTeamAdmin ? (
                  <button
                    className="link-row-remove"
                    onClick={() => deleteProjectLink(idx)}
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            ))}
            {isTeamAdmin ? (
              <div className="ws-link-add-row" style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <input
                  className="form-input"
                  style={{ maxWidth: "220px" }}
                  placeholder={t("wsLinkLabelPlaceholder")}
                  value={newLink.label}
                  onChange={(e) =>
                    setNewLink((p) => ({ ...p, label: e.target.value }))
                  }
                />
                <input
                  className="form-input"
                  placeholder={t("wsLinkUrlPlaceholder")}
                  value={newLink.url}
                  onChange={(e) =>
                    setNewLink((p) => ({ ...p, url: e.target.value }))
                  }
                />
                <button
                  className="btn btn-primary btn-sm ws-link-add-btn"
                  onClick={addProjectLink}
                >
                  {t("wsAddLink")}
                </button>
              </div>
            ) : null}
          </div>

          <div
            className="ws-detail-card"
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div className="ws-sop-title">
              {t("wsWorkflowTitle")}
            </div>
            <div>
              {workflowSteps.map((s, i) => (
                <div
                  className="ws-workflow-step"
                  key={s.n}
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "11px 0",
                    borderBottom:
                      i === workflowSteps.length - 1
                        ? "none"
                        : "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      width: "26px",
                      height: "26px",
                      borderRadius: "50%",
                      background: "var(--sidebar)",
                      color: "#FAF7F2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: "700",
                      flexShrink: 0,
                      marginTop: "1px",
                    }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "var(--text)",
                        marginBottom: "3px",
                      }}
                    >
                      {s.icon} {s.title}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-2)",
                        lineHeight: 1.6,
                      }}
                    >
                      {s.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {subBatches.length === 0 && (
            <div
              className="ws-detail-card"
              style={{
                background: "var(--card)",
                borderRadius: "var(--radius)",
                boxShadow: "var(--shadow)",
                padding: "24px",
                textAlign: "center",
                color: "var(--text-3)",
                fontSize: "13px",
              }}
            >
              {t("wsBatchesEmpty")}
            </div>
          )}
          {subBatches.map((sb) => {
            const videos = sb.videos || [];
            const done = videos.filter(
              (v) => v.editFase === "finished",
            ).length;
            const total = videos.length;
            return (
          <div
            key={sb._id}
            className="ws-detail-card"
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              overflow: "hidden",
              marginBottom: "14px",
            }}
          >
            <div
              className="ws-videos-head"
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  flex: "1 1 auto",
                  minWidth: 0,
                }}
              >
                <span style={{ fontSize: "18px" }}>{sb.emoji || "🎬"}</span>
                <span
                  style={{
                    fontFamily: "Montserrat",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  {sb.name}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--text-3)",
                    fontWeight: 500,
                  }}
                >
                  ({total})
                </span>
              </div>
              <div
                className="ws-videos-head-right"
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
                  {t("wsVideosDoneProgress", { done, total })} ·{" "}
                  {Math.round((done / Math.max(total, 1)) * 100)}%
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPendingDeleteSubBatch(sb)}
                  style={{ color: "#c04040", whiteSpace: "nowrap" }}
                >
                  {t("wsDeleteBatchBtn")}
                </button>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setAddVideoBatchId(sb._id)}
                >
                  {t("wsAddVideo")}
                </button>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="ws-table">
                <thead>
                  <tr>
                    {[
                      "#",
                      t("wsVidColName"),
                      t("wsVidColFase"),
                      t("wsVidColAssets"),
                      t("wsVidColExport"),
                      `📝 ${t("script")}`,
                      `📁 ${t("brandAssets")}`,
                      `🎬 ${t("shotlist")}`,
                      `📋 ${t("sop")}`,
                      t("notes"),
                      "",
                    ].map((h) => (
                      <th key={h} className="ws-th">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {videos.map((v, i) => {
                    const shots = v.shotlist || [];
                    const done = shots.filter((s) => s.done).length;
                    const ef = FASE_MAP[v.editFase];
                    const sopTags = [
                      ...(v.sop?.ratioTags || []),
                      ...(v.sop?.stijlTags || []),
                    ];
                    return (
                      <tr key={v._id} className="ws-tr ws-vid-row">
                        <td className="ws-td">
                          <div
                            className="ws-td-inner"
                            style={{
                              color: "var(--text-3)",
                              fontSize: "11px",
                              fontWeight: "600",
                            }}
                          >
                            {i + 1}
                          </div>
                        </td>
                        <EditCell
                          value={v.name}
                          placeholder={t("wsFilenamePlaceholder")}
                          onSave={(val) =>
                            updateMut.mutate({
                              wsId: batch._id,
                              subBId: sb._id,
                              vId: v._id,
                              name: val,
                            })
                          }
                          icon="📄"
                          textWeight={500}
                        />
                        <td className="ws-td" style={{ padding: 0 }}>
                          <div style={{ padding: "4px 8px" }}>
                            {ef && (
                              <span className={`ws-pill ${ef.cls}`}>
                                {t(ef.labelKey)}
                              </span>
                            )}
                            <FaseSelect
                              value={v.editFase}
                              onChange={(val) =>
                                updateMut.mutate({
                                  wsId: batch._id,
                                  subBId: sb._id,
                                  vId: v._id,
                                  editFase: val,
                                })
                              }
                            />
                          </div>
                        </td>
                        <EditCell
                          value={v.assets}
                          placeholder={t("wsAddDrivePH")}
                          onSave={(val) =>
                            updateMut.mutate({
                              wsId: batch._id,
                              subBId: sb._id,
                              vId: v._id,
                              assets: val,
                            })
                          }
                          isLink
                        />
                        <EditCell
                          value={v.export}
                          placeholder={t("wsAddExportPH")}
                          onSave={(val) =>
                            updateMut.mutate({
                              wsId: batch._id,
                              subBId: sb._id,
                              vId: v._id,
                              export: val,
                            })
                          }
                          isLink
                        />
                        <td
                          className="ws-td"
                          title={t("wsEditScript")}
                          onClick={() => openScript(v)}
                        >
                          <div
                            className="ws-td-inner"
                            style={{ cursor: "pointer", alignItems: "flex-start" }}
                          >
                            {v.script?.trim() ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-2)",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  lineHeight: 1.35,
                                }}
                              >
                                {v.script.trim().length > 120
                                  ? `${v.script.trim().slice(0, 120)}…`
                                  : v.script.trim()}
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-3)",
                                  fontStyle: "italic",
                                }}
                              >
                                {t("wsScriptAdd")}
                              </span>
                            )}
                          </div>
                        </td>
                        <EditCell
                          value={v.driveLink}
                          placeholder={t("wsDriveLinkPlaceholder")}
                          onSave={(val) =>
                            updateMut.mutate({
                              wsId: batch._id,
                              subBId: sb._id,
                              vId: v._id,
                              driveLink: val,
                            })
                          }
                          isLink
                        />
                        <td
                          className="ws-td"
                          title={t("wsOpenShotlist")}
                          onClick={() => openShotlist(v)}
                        >
                          <div
                            className="ws-td-inner"
                            style={{ flexDirection: "column", gap: "3px" }}
                          >
                            {shots.length > 0 ? (
                              <>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                  }}
                                >
                                  <div
                                    style={{
                                      flex: 1,
                                      height: "5px",
                                      background: "var(--border)",
                                      borderRadius: "3px",
                                      overflow: "hidden",
                                    }}
                                  >
                                    <div
                                      style={{
                                        height: "100%",
                                        background: "var(--sage)",
                                        width: `${Math.round((done / shots.length) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: "700",
                                      color: "var(--sage)",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {done}/{shots.length}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-3)",
                                  fontStyle: "italic",
                                }}
                              >
                                {t("wsCreateShotlist")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className="ws-td"
                          title={t("wsEditSop")}
                          onClick={() => openSop(v)}
                        >
                          <div
                            className="ws-td-inner"
                            style={{ flexWrap: "wrap", gap: "4px" }}
                          >
                            {sopTags.slice(0, 2).map((t, ti) => (
                              <span
                                key={`${t}-${ti}`}
                                style={{
                                  fontSize: "9px",
                                  fontWeight: "700",
                                  padding: "2px 6px",
                                  borderRadius: "10px",
                                  background: "var(--accent-pale)",
                                  color: "var(--accent)",
                                }}
                              >
                                {t}
                              </span>
                            ))}
                            {sopTags.length > 2 && (
                              <span
                                style={{ fontSize: "10px", color: "var(--text-3)" }}
                              >
                                +{sopTags.length - 2}
                              </span>
                            )}
                            {!sopTags.length && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--text-3)",
                                  fontStyle: "italic",
                                }}
                              >
                                {t("wsFillSop")}
                              </span>
                            )}
                          </div>
                        </td>
                        <EditCell
                          value={v.notes}
                          placeholder={t("wsNotePlaceholder")}
                          multiline
                          onSave={(val) =>
                            updateMut.mutate({
                              wsId: batch._id,
                              subBId: sb._id,
                              vId: v._id,
                              notes: val,
                            })
                          }
                        />
                        <td className="ws-td">
                          <div className="ws-tr-actions">
                            {v.editFase === "client_approved" ? (
                              <span className="ws-action-muted ws-action-ok">
                                ✓ Klant akkoord
                              </span>
                            ) : v.editFase === "waitreview" ||
                              v.editFase === "client_review" ||
                              v.editFase === "client_revision" ? (
                              <span className="ws-action-muted ws-action-client">
                                👁 Bij klant
                              </span>
                            ) : (
                              <button
                                type="button"
                                className={`ws-portal-btn ${
                                  v.editFase === "intern_approved"
                                    ? "ws-portal-btn-ready"
                                    : "ws-portal-btn-muted"
                                }`}
                                title={
                                  v.editFase === "intern_approved"
                                    ? t("wsInternApprovedSend")
                                    : t("wsApproveInternFirst")
                                }
                                onClick={() => {
                                  if (v.editFase !== "intern_approved") {
                                    window.alert(t("wsApproveInternFirst"));
                                    return;
                                  }
                                  updateMut.mutate({
                                    wsId: batch._id,
                                    subBId: sb._id,
                                    vId: v._id,
                                    editFase: "waitreview",
                                  });
                                }}
                              >
                                {v.editFase === "intern_approved"
                                  ? "→ Stuur naar klant"
                                  : t("wsToPortal")}
                              </button>
                            )}
                            <button
                              type="button"
                              className="ws-video-delete-btn"
                              aria-label={t("wsDeleteVideoAria")}
                              onClick={async () => {
                                if (window.confirm(t("wsConfirmDeleteVideo"))) {
                                  await deleteWorkspaceVideo(
                                    batch._id,
                                    sb._id,
                                    v._id,
                                  );
                                  qc.invalidateQueries({ queryKey: ["workspaces"] });
                                }
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
            );
          })}

          <div
            className="ws-detail-card"
            style={{
              background: "var(--card)",
              borderRadius: "var(--radius)",
              boxShadow: "var(--shadow)",
              marginTop: "14px",
              overflow: "hidden",
            }}
          >
            <div className="ws-res-tabs">
              {WS_RES_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`ws-res-tab${resTab === tab.key ? " active" : ""}`}
                  onClick={() => {
                    setResTab(tab.key);
                    setResDraftName("");
                    setResDraftNote("");
                  }}
                >
                  <span>{tab.icon}</span>
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>
            <div className="ws-res-body">
              {activeResources.map((item, idx) => (
                <div key={`${item.name}-${idx}`} className="ws-res-item">
                  <span className="ws-res-item-icon">📄</span>
                  <div className="ws-res-item-name">{item.name}</div>
                  <div className="ws-res-item-meta">
                    {item.note || item.status || "—"}
                  </div>
                  {isTeamAdmin ? (
                    <button
                      type="button"
                      className="ws-res-item-del"
                      onClick={() => deleteResourceItem(idx)}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              ))}

              <div
                className="ws-res-add-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr auto",
                  gap: "8px",
                  marginTop: "8px",
                }}
              >
                <input
                  className="form-input"
                  placeholder={t("eventNameLabel")}
                  value={resDraftName}
                  onChange={(e) => setResDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addResourceItem();
                  }}
                />
                <input
                  className="form-input"
                  placeholder={t("wsOptionalNote")}
                  value={resDraftNote}
                  onChange={(e) => setResDraftNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addResourceItem();
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={addResourceItem}
                  disabled={!resDraftName.trim()}
                >
                  {t("wsAddItem")}
                </button>
              </div>
            </div>
          </div>
        </section>

        {addVideoBatchId && (
          <div
            className="modal-overlay open"
            onMouseDown={() => setAddVideoBatchId(null)}
          >
            <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">{t("wsNewVideoTitle")}</div>
                <button
                  className="modal-close"
                  onClick={() => setAddVideoBatchId(null)}
                >
                  ✕
                </button>
              </div>
              <div className="form-group">
                <label className="form-label">{t("wsVidColName")}</label>
                <input
                  autoFocus
                  className="form-input"
                  value={newVideoName}
                  onChange={(e) => setNewVideoName(e.target.value)}
                  placeholder={t("wsVideoNameExample")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createNewVideo();
                  }}
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-ghost"
                  onClick={() => setAddVideoBatchId(null)}
                >
                  {t("cancel")}
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!newVideoName.trim()}
                  onClick={createNewVideo}
                >
                  {t("wsAddItem")}
                </button>
              </div>
            </div>
          </div>
        )}
        {deleteWorkspaceOverlay}
        {editProjectOverlay}
        {scriptShotSopOverlays}
        {batchCreateOverlay}
        {subBatchCreateOverlay}
        {subBatchDeleteOverlay}
      </>
    );
  }

  return (
    <>
      <section className="view active">
        <div className="page-header ws-page-header">
          <div>
            <div className="page-title">
              {t("workspace")} <em>— {t("navEditors")}</em>
            </div>
            <div className="page-subtitle">
              {t("wsPageSubtitle")}
            </div>
          </div>
          <button
            className="ws-new-btn"
            onClick={() => setShowBatchModal(true)}
          >
            {t("wsAddWorkspace")}
          </button>
        </div>
        <div
          style={{
            background: "var(--card)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow)",
            overflow: "hidden",
          }}
        >
          <div className="ws-tabs">
            {WS_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`ws-tab${wsTab === tab.key ? " active" : ""}`}
                data-wstab={tab.key}
                onClick={() => setWsTab(tab.key)}
              >
                <span className="ws-tab-icon">{tab.icon}</span>
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
          <div className="ws-table-wrap">
            <table className="ws-table">
              <thead>
                <tr>
                  <th className="ws-th">{t("wsShootDateHeader")}</th>
                  <th className="ws-th">{t("wsShootStatusHeader")}</th>
                  <th className="ws-th" style={{ minWidth: 220 }}>
                    {t("wsBatchProjectHeader")}
                  </th>
                  <th className="ws-th">{t("wsVideosHeader")}</th>
                  <th className="ws-th" style={{ minWidth: 130 }}>
                    Progress
                  </th>
                  <th className="ws-th">{t("wsDeadlineHeader")}</th>
                  <th className="ws-th">{t("wsStageHeader")}</th>
                  <th className="ws-th">{t("wsEditorHeader")}</th>
                  <th className="ws-th">{t("wsClientHeader")}</th>
                  <th className="ws-th" style={{ width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {isWorkspacesLoading
                  ? Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={`ws-skeleton-${idx}`} className="ws-tr ws-tr-skeleton">
                        <td className="ws-td">
                          <div className="ws-td-inner">
                            <span className="ws-row-skel ws-row-skel-date" />
                          </div>
                        </td>
                        <td className="ws-td">
                          <div className="ws-td-inner">
                            <span className="ws-row-skel ws-row-skel-pill" />
                          </div>
                        </td>
                        <td className="ws-td">
                          <div className="ws-project-link">
                            <span className="ws-row-skel ws-row-skel-project" />
                          </div>
                        </td>
                        <td className="ws-td">
                          <div className="ws-td-inner">
                            <span className="ws-row-skel ws-row-skel-count" />
                          </div>
                        </td>
                        <td className="ws-td">
                          <div className="ws-td-inner ws-row-skel-progress-wrap">
                            <span className="ws-row-skel ws-row-skel-progress" />
                            <span className="ws-row-skel ws-row-skel-meta" />
                          </div>
                        </td>
                        <td className="ws-td">
                          <div className="ws-td-inner">
                            <span className="ws-row-skel ws-row-skel-date" />
                          </div>
                        </td>
                        <td className="ws-td">
                          <div className="ws-td-inner">
                            <span className="ws-row-skel ws-row-skel-pill" />
                          </div>
                        </td>
                        <td className="ws-td">
                          <div className="ws-td-inner">
                            <span className="ws-row-skel ws-row-skel-editor" />
                          </div>
                        </td>
                        <td className="ws-td">
                          <div className="ws-td-inner">
                            <span className="ws-row-skel ws-row-skel-client" />
                          </div>
                        </td>
                        <td className="ws-td">
                          <div className="ws-td-inner">
                            <span className="ws-row-skel ws-row-skel-action" />
                          </div>
                        </td>
                      </tr>
                    ))
                  : filteredBatches.map((b) => {
                  const videos = (b.batches || []).flatMap(
                    (sb) => sb.videos || [],
                  );
                  const total = videos.length;
                  const done = videos.filter(
                    (v) => v.editFase === "finished",
                  ).length;
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  const anyProgress = videos.some((v) =>
                    [
                      "inprogress",
                      "waitreview",
                      "client_review",
                      "client_revision",
                      "uploaddrive",
                    ].includes(v.editFase),
                  );
                  const allDone = total > 0 && done === total;
                  const barColor = allDone
                    ? "var(--sage)"
                    : anyProgress
                      ? "var(--amber)"
                      : "var(--blue)";
                  const shootStatus =
                    SHOOT_STATUS_MAP[b.shootStatus || "planned"];
                  const stage = PROJECT_STAGE_MAP[b.projectStage];
                  const editor = b.editor || "";
                  const editorColor = AV_COLORS[editor] || "var(--text-3)";
                  const editorInit =
                    AV_INIT[editor] || (editor ? editor.slice(0, 2) : "?");
                  return (
                    <tr
                      key={b._id}
                      className="ws-tr"
                      onClick={() => navigate(`/dashboard/workspace/${b._id}`)}
                    >
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          <span
                            className={
                              b.shootDate
                                ? "ws-date-cell ws-date-shoot"
                                : "ws-date-empty"
                            }
                          >
                            {formatShortDate(b.shootDate)}
                          </span>
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          {shootStatus ? (
                            <span className={`ws-pill ${shootStatus.cls}`}>
                              {t(shootStatus.labelKey)}
                            </span>
                          ) : (
                            <span className="ws-date-empty">—</span>
                          )}
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-project-link">
                          <span
                            style={{ fontWeight: 500, color: "var(--text)" }}
                          >
                            {b.name}
                          </span>
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--text-2)",
                            }}
                          >
                            {total}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text-3)",
                              marginLeft: 4,
                            }}
                          >
                            {t(total === 1 ? "wsFilmSingular" : "wsFilmPlural")}
                          </span>
                        </div>
                      </td>
                      <td className="ws-td">
                        <div
                          className="ws-td-inner"
                          style={{
                            flexDirection: "column",
                            alignItems: "flex-start",
                            padding: "8px 10px",
                            gap: 3,
                          }}
                        >
                          <div
                            style={{
                              width: "100%",
                              height: 5,
                              background: "var(--border)",
                              borderRadius: 4,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                background: barColor,
                                borderRadius: 4,
                              }}
                            />
                          </div>
                          <span
                            style={{ fontSize: 10, color: "var(--text-3)" }}
                          >
                            {t("wsVideosDoneProgress", { done, total })}
                          </span>
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          {b.deadline ? (
                            <span
                              className="ws-date-cell ws-date-deadline"
                            >
                              {formatShortDate(b.deadline)}
                            </span>
                          ) : (
                            <span className="ws-date-empty">—</span>
                          )}
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          {stage ? (
                            <span className={`ws-pill ${stage.cls}`}>
                              {t(stage.labelKey)}
                            </span>
                          ) : (
                            <span className="ws-date-empty">—</span>
                          )}
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          {editor ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <div
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: "50%",
                                  background: editorColor,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 8,
                                  fontWeight: 700,
                                  color: "white",
                                }}
                              >
                                {editorInit}
                              </div>
                              <span
                                style={{ fontSize: 12, color: "var(--text-2)" }}
                              >
                                {editor}
                              </span>
                            </div>
                          ) : (
                            <span className="ws-date-empty">—</span>
                          )}
                        </div>
                      </td>
                      <td className="ws-td">
                        <div className="ws-td-inner">
                          <span
                            style={{ fontSize: 12, color: "var(--text-2)" }}
                          >
                            {b.client || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="ws-td">
                        <div
                          className="ws-tr-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--text-3)",
                              fontSize: 13,
                              padding: 3,
                            }}
                            onClick={() => setPendingDeleteBatch(b)}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="ws-add-row" onClick={() => setShowBatchModal(true)}>
              {t("wsAddWorkspaceFooter")}
            </div>
          </div>
        </div>
      </section>

      {scriptShotSopOverlays}
      {deleteWorkspaceOverlay}
      {batchCreateOverlay}
      {subBatchCreateOverlay}
      {subBatchDeleteOverlay}
    </>
  );
}

function EditCell({
  value,
  placeholder,
  onSave,
  isLink,
  multiline,
  preview,
  icon = null,
  textWeight = 400,
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || "");

  useEffect(() => {
    if (!editing) setVal(value || "");
  }, [value, editing]);

  const commit = () => {
    const current = value || "";
    if (val !== current) onSave(val);
    setEditing(false);
  };

  if (editing) {
    return (
      <td
        className="ws-td"
        style={
          multiline
            ? { height: "auto", minHeight: 48, verticalAlign: "top" }
            : undefined
        }
      >
        {multiline ? (
          <textarea
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setVal(value || "");
                setEditing(false);
              }
            }}
            style={{
              width: "100%",
              minHeight: "72px",
              border: "1.5px solid var(--accent)",
              borderRadius: "5px",
              padding: "5px 8px",
              fontSize: "12px",
              fontFamily: "inherit",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        ) : (
          <input
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commit();
              }
              if (e.key === "Escape") {
                setVal(value || "");
                setEditing(false);
              }
            }}
            style={{
              width: "100%",
              border: "1.5px solid var(--accent)",
              borderRadius: "5px",
              padding: "5px 8px",
              fontSize: "12px",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        )}
      </td>
    );
  }
  const display = value
    ? preview
      ? value.slice(0, preview) + (value.length > preview ? "…" : "")
      : value
    : null;
  const toHref = (raw) => {
    if (!raw) return "";
    const trimmed = String(raw).trim();
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  return (
    <td className="ws-td" onClick={() => setEditing(true)}>
      <div className="ws-td-inner" style={{ cursor: "pointer" }}>
        {display ? (
          isLink ? (
            <a
              href={toHref(value)}
              target="_blank"
              rel="noopener"
              style={{
                fontSize: "11px",
                color: "var(--blue)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "block",
                maxWidth: "130px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              🔗 {display}
            </a>
          ) : (
            <>
              {icon && <span style={{ fontSize: "12px" }}>{icon}</span>}
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--text-2)",
                  fontWeight: textWeight,
                }}
              >
                {display}
              </span>
            </>
          )
        ) : (
          <span
            style={{
              fontSize: "11px",
              color: "var(--text-3)",
              fontStyle: "italic",
            }}
          >
            {placeholder}
          </span>
        )}
      </div>
    </td>
  );
}
