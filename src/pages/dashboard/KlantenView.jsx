// KlantenView.jsx - Client management (Info, Portaal, Retainer, …) — MERN API
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DASHBOARD_BASE } from '../../paths';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  sendPortalNote,
  getPortalNotes,
  getPortalVideos,
  getBatches,
  getClientDocuments,
  presignClientDocumentUpload,
  createClientDocument,
  presignPortalWhatsappUpload,
  createPortalWhatsappMessage,
  getPortalWhatsappMessages,
} from '../../api';
import { useLang } from '../../context/LangContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import FormInput from '../../components/FormInput';

const ACCENT_COLORS = ['#C4522A', '#3A6EA8', '#7A9E7E', '#7A5EA8', '#C8953A', '#5E8A6E', '#E07830'];

function pickColor(seed) {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % ACCENT_COLORS.length;
  return ACCENT_COLORS[h];
}

function fmtDate(ds) {
  if (!ds) return '—';
  try {
    const p = ds.split('-');
    return `${parseInt(p[2], 10)} ${['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][parseInt(p[1], 10) - 1]} ${p[0]}`;
  } catch {
    return ds;
  }
}

const TABS = [
  { id: 'info', label: '👤 Info' },
  { id: 'portaal', label: '🌐 Portaal' },
  { id: 'documenten', label: '📄 Documenten' },
  { id: 'whatsapp', label: '💬 WhatsApp' },
  { id: 'contacten', label: '👥 Contacten' },
  { id: 'retainer', label: '💼 Retainer' },
  { id: 'vragenlijst', label: '📋 Vragenlijst' },
];

function RetainerTab({ client, onSave }) {
  const [r, setR] = useState(client.retainer || {});
  useEffect(() => {
    setR(client.retainer || {});
  }, [client._id, client.retainer]);

  const save = (key, val) => {
    setR((prev) => {
      if ((prev?.[key] ?? '') === (val ?? '')) return prev;
      const updated = { ...(prev || {}), [key]: val };
      onSave({ retainer: updated });
      return updated;
    });
  };

  const statuses = ['actief', 'gepauzeerd', 'opgezegd', 'concept'];
  const status = r.status || '';

  const bannerBg =
    status === 'actief' ? 'var(--sage-light)' : status ? 'var(--amber-light)' : 'var(--bg-alt)';
  const bannerBorder =
    status === 'actief' ? 'var(--sage)' : status ? 'var(--amber)' : 'var(--border)';
  const statusIcon =
    status === 'actief' ? '✅' : status === 'gepauzeerd' ? '⏸️' : status === 'opgezegd' ? '❌' : '📋';

  const field = (key, label, ph) => (
    <div key={key}>
      <label
        style={{
          fontSize: '10px',
          fontWeight: '700',
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
          display: 'block',
          marginBottom: '4px',
        }}
      >
        {label}
      </label>
      <input
        key={`${client._id}-${key}`}
        defaultValue={r[key] || ''}
        placeholder={ph}
        onBlur={(e) => save(key, e.target.value)}
        style={{
          width: '100%',
          padding: '9px 12px',
          border: '1.5px solid var(--border)',
          borderRadius: '8px',
          fontFamily: 'DM Sans,sans-serif',
          fontSize: '13px',
          color: 'var(--text)',
          background: 'var(--bg-alt)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );

  return (
    <div>
      <div
        className="retainer-status-banner"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '14px 18px',
          borderRadius: '10px',
          marginBottom: '20px',
          background: bannerBg,
          border: `1.5px solid ${bannerBorder}`,
        }}
      >
        <span style={{ fontSize: '20px' }}>{statusIcon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Montserrat', fontSize: '14px', fontWeight: '600' }}>
            {r.pakket || 'Geen retainer ingesteld'}
          </div>
          {r.prijs && (
            <div style={{ fontSize: '13px', color: 'var(--text-2)', marginTop: '2px' }}>
              {r.prijs} · {r.periode}
            </div>
          )}
        </div>
        <select
          className="retainer-status-select"
          value={r.status || 'concept'}
          onChange={(e) => save('status', e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1.5px solid var(--border)',
            borderRadius: '7px',
            fontFamily: 'inherit',
            fontSize: '12px',
            fontWeight: '700',
            outline: 'none',
          }}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        {field('pakket', '📦 Pakketnaam', 'bijv. Social Media Retainer M')}
        {field('prijs', '💰 Prijs', 'bijv. € 1.450')}
        {field('periode', '🔁 Betalingsperiode', 'bijv. Maandelijks')}
        {field('betaalmethode', '💳 Betaalmethode', 'bijv. Automatische incasso')}
        {field('startdatum', '📅 Startdatum', 'JJJJ-MM-DD')}
        {field('einddatum', '📅 Einddatum', 'Leeg = doorlopend')}
        {field('looptijd', '⏱ Looptijd', 'bijv. 12 maanden')}
      </div>
      <div
        style={{
          background: 'var(--bg-alt)',
          borderRadius: '10px',
          padding: '16px 18px',
          marginBottom: '16px',
          border: '1.5px solid var(--border)',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            marginBottom: '12px',
          }}
        >
          🎬 Deliverables
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
          {field('shoots', '📷 Shoots', 'bijv. 2 shoots/maand')}
          {field('videos', '🎬 Videos', 'bijv. 8 reels/maand')}
        </div>
        <div style={{ marginTop: '10px' }}>{field('extras', '➕ Extra deliverables', 'bijv. Stories, BTS')}</div>
      </div>
      <div style={{ marginBottom: '8px' }}>
        <label
          style={{
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            display: 'block',
            marginBottom: '6px',
          }}
        >
          📝 Interne notities
        </label>
        <textarea
          key={`ret-notes-${client._id}`}
          defaultValue={r.notities || ''}
          placeholder="Contractnotities, afspraken, verlengingen..."
          onBlur={(e) => save('notities', e.target.value)}
          style={{
            width: '100%',
            minHeight: '72px',
            padding: '10px 12px',
            border: '1.5px solid var(--border)',
            borderRadius: '8px',
            fontFamily: "'DM Sans',sans-serif",
            fontSize: '13px',
            color: 'var(--text)',
            background: 'var(--bg-alt)',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.6,
            boxSizing: 'border-box',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          background: 'var(--bg-alt)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '16px' }}>🌐</span>
        <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-2)' }}>
          Retainergegevens zichtbaar in klantportaal
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
          }}
        >
          <input
            type="checkbox"
            checked={!!r.zichtbaarInPortaal}
            onChange={(e) => save('zichtbaarInPortaal', e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
          />
          Toon in portaal
        </label>
      </div>
    </div>
  );
}

function countDeliveredForClient(batches, clientId) {
  const id = String(clientId);
  return batches
    .filter((b) => String(b.clientId) === id)
    .flatMap((b) => b.videos || [])
    .filter((v) => v.approved).length;
}

function PortaalTab({ client }) {
  const [reply, setReply] = useState('');
  const qc = useQueryClient();
  const { data: notes = [] } = useQuery({
    queryKey: ['portalNotes', client._id],
    queryFn: () => getPortalNotes(client._id),
    refetchInterval: 8000,
  });
  const { data: reviewVideos = [] } = useQuery({
    queryKey: ['portalVideos', client._id],
    queryFn: () => getPortalVideos(client._id),
    refetchInterval: 8000,
  });
  const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: getBatches });

  const clientMsgs = notes.filter((n) => n.from === 'client');
  const delivered = useMemo(() => countDeliveredForClient(batches, client._id), [batches, client._id]);

  const sendMut = useMutation({
    mutationFn: () => sendPortalNote(client._id, reply),
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries({ queryKey: ['portalNotes', client._id] });
    },
  });

  const submitReply = () => {
    if (reply.trim()) sendMut.mutate();
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          [clientMsgs.length, 'Berichten van klant', 'var(--accent)'],
          [reviewVideos.length, 'In review', 'var(--blue)'],
          [delivered, "Video's opgeleverd", 'var(--sage)'],
        ].map(([n, l, c]) => (
          <div
            key={l}
            style={{
              background: 'var(--bg-alt)',
              borderRadius: '9px',
              padding: '14px 16px',
              textAlign: 'center',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontFamily: 'Montserrat', fontSize: '26px', fontWeight: '700', color: c }}>{n}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>{l}</div>
          </div>
        ))}
      </div>
      {client.portalEmail ? (
        <div
          style={{
            background: 'var(--bg-alt)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            border: '1px dashed var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '18px' }}>🔑</span>
          <div style={{ fontSize: '13px', color: 'var(--text-2)', flex: 1, minWidth: '200px' }}>
            Portaal login: <strong>{client.portalEmail}</strong>
            <span style={{ color: 'var(--text-3)', marginLeft: '8px' }}>(wachtwoord beveiligd opgeslagen)</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => window.open('/portaal', '_blank')}
            style={{ background: 'var(--sidebar)', color: 'white', borderColor: 'var(--sidebar)' }}
          >
            🌐 Portaal bekijken
          </button>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--bg-alt)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            border: '1px dashed var(--border)',
            fontSize: '13px',
            color: 'var(--text-3)',
          }}
        >
          Geen portaalaccount gekoppeld aan deze klant.
        </div>
      )}
      {reviewVideos.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
              marginBottom: '10px',
            }}
          >
            🎬 Video&apos;s ter beoordeling door klant
          </div>
            {reviewVideos.map((v) => {
            const statusColor = v.revision ? 'var(--amber)' : 'var(--blue)';
            const statusLabel = v.revision ? '✏️ Revisie aangevraagd' : '⏳ Wacht op reactie';
            const vid = v._id || v.id;
            return (
              <div
                key={vid ? String(vid) : `${v.batchId}-${v.name}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'var(--bg-alt)',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  marginBottom: '6px',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500' }}>{v.name}</div>
                  {v.revisionNote && (
                    <div style={{ fontSize: '11px', color: 'var(--amber)', marginTop: '3px' }}>💬 {v.revisionNote}</div>
                  )}
                </div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: statusColor, whiteSpace: 'nowrap', marginLeft: '12px' }}>
                  {statusLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            fontSize: '10px',
            fontWeight: '700',
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            marginBottom: '12px',
          }}
        >
          💬 Berichten & notities
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '320px',
            overflowY: 'auto',
            marginBottom: '12px',
            paddingRight: '4px',
          }}
        >
          {notes.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic', padding: '8px 0' }}>
              Nog geen berichten uitgewisseld.
            </div>
          ) : (
            notes.map((n) => (
              <div key={n._id} style={{ display: 'flex', justifyContent: n.from === 'client' ? 'flex-start' : 'flex-end', gap: '8px' }}>
                {n.from === 'client' && (
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: client.color || 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'Montserrat,sans-serif',
                      fontSize: '10px',
                      fontWeight: '700',
                      color: 'white',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {client.name
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '75%',
                    background: n.from === 'client' ? 'white' : '#EFF4FF',
                    border: `1px solid ${n.from === 'client' ? 'var(--border)' : '#C8D8FF'}`,
                    borderRadius: n.from === 'client' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                    padding: '10px 14px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      color: n.from === 'client' ? 'var(--accent)' : 'var(--blue)',
                      marginBottom: '4px',
                    }}
                  >
                    {n.author} · {new Date(n.createdAt).toLocaleDateString('nl-NL')}
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: 1.5 }}>{n.text}</div>
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitReply();
              }
            }}
            placeholder={`Antwoord sturen naar ${client.name}…`}
            rows={2}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1.5px solid var(--border)',
              borderRadius: '9px',
              fontFamily: 'DM Sans,sans-serif',
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={submitReply}
            disabled={!reply.trim() || sendMut.isPending}
            style={sendMut.isPending ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : undefined}
          >
            {sendMut.isPending ? (
              <>
                <LoadingSpinner size={18} />
                <span>Stuur</span>
              </>
            ) : (
              'Stuur'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtFileSize(sizeBytes) {
  const n = Number(sizeBytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function DocumentenTab({ client, lang }) {
  const qc = useQueryClient();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    setSelectedFile(null);
    setPreviewUrl('');
    setUploadError('');
  }, [client?._id]);

  useEffect(() => {
    if (!selectedFile || !selectedFile.type?.startsWith('image/')) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['clientDocuments', client._id],
    queryFn: () => getClientDocuments(client._id),
    enabled: !!client?._id,
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error(lang === 'en' ? 'Select a file first.' : 'Selecteer eerst een bestand.');
      const presign = await presignClientDocumentUpload(client._id, {
        filename: selectedFile.name,
        contentType: selectedFile.type || 'application/octet-stream',
      });

      const uploadRes = await fetch(presign.uploadUrl, {
        method: presign.method || 'PUT',
        headers: { 'Content-Type': presign.contentType || selectedFile.type || 'application/octet-stream' },
        body: selectedFile,
      });
      if (!uploadRes.ok) {
        throw new Error(lang === 'en' ? 'File upload failed.' : 'Bestand uploaden mislukt.');
      }

      return createClientDocument(client._id, {
        key: presign.key,
        fileUrl: presign.fileUrl,
        name: selectedFile.name,
        contentType: selectedFile.type || undefined,
        sizeBytes: selectedFile.size,
      });
    },
    onSuccess: () => {
      setSelectedFile(null);
      setUploadError('');
      qc.invalidateQueries({ queryKey: ['clientDocuments', client._id] });
    },
    onError: (e) => {
      setUploadError(e.message || (lang === 'en' ? 'Could not upload document.' : 'Document kon niet worden geüpload.'));
    },
  });

  const handleUploadClick = () => {
    if (!selectedFile) {
      setUploadError(lang === 'en' ? 'Please select a document first.' : 'Selecteer eerst een document.');
      return;
    }
    setUploadError('');
    uploadMut.mutate();
  };

  const fileTypeLabel = selectedFile?.type
    ? selectedFile.type
    : lang === 'en'
      ? 'Unknown type'
      : 'Onbekend type';

  return (
    <div style={{ padding: '12px 0' }}>
      <div
        style={{
          border: '1.5px dashed var(--border)',
          borderRadius: '10px',
          background: 'var(--bg-alt)',
          padding: '14px',
          marginBottom: '14px',
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 1fr) auto',
          columnGap: '14px',
          rowGap: '12px',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setSelectedFile(file);
              setUploadError('');
            }}
            style={{ maxWidth: '100%' }}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            {lang === 'en' ? 'Choose a file to upload for this client.' : 'Kies een bestand om te uploaden voor deze klant.'}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleUploadClick}
          disabled={uploadMut.isPending}
          style={uploadMut.isPending ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : { alignSelf: 'center' }}
        >
          {uploadMut.isPending ? (
            <>
              <LoadingSpinner size={16} />
              <span>{lang === 'en' ? 'Uploading…' : 'Uploaden…'}</span>
            </>
          ) : (
            lang === 'en' ? 'Upload document' : 'Document uploaden'
          )}
        </button>

        {selectedFile && (
          <div
            style={{
              gridColumn: '1 / -1',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'white',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              minWidth: 0,
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={selectedFile.name}
                style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            ) : (
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-alt)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                📄
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                {fmtFileSize(selectedFile.size)} · {fileTypeLabel}
              </div>
            </div>
          </div>
        )}
      </div>

      {uploadError && (
        <p role="alert" style={{ ...fieldErrStyle, marginBottom: '12px' }}>
          {uploadError}
        </p>
      )}

      {isLoading ? (
        <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>{lang === 'en' ? 'Loading documents…' : 'Documenten laden…'}</div>
      ) : docs.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic' }}>
          {lang === 'en' ? 'No documents yet. Upload your first file above.' : 'Nog geen documenten. Upload hierboven je eerste bestand.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {docs.map((doc) => (
            <div
              key={doc._id || doc.key}
              style={{
                background: 'var(--bg-alt)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.name || 'document'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                  {fmtFileSize(doc.sizeBytes)} · {doc.uploadedByName || '—'} ·{' '}
                  {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'nl-NL') : '—'}
                </div>
              </div>
              <a href={doc.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                {lang === 'en' ? 'Open' : 'Openen'}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WhatsAppTab({ client, lang }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setText('');
    setSelectedFile(null);
    setPreviewUrl('');
    setErrorMsg('');
  }, [client?._id]);

  useEffect(() => {
    if (!selectedFile || !selectedFile.type?.startsWith('image/')) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['portalWhatsappMessages', client._id],
    queryFn: () => getPortalWhatsappMessages(client._id),
    enabled: !!client?._id,
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const trimmedText = text.trim();
      if (!trimmedText && !selectedFile) {
        throw new Error(lang === 'en' ? 'Add text or select an image first.' : 'Voeg eerst tekst toe of selecteer een afbeelding.');
      }

      const attachments = [];
      if (selectedFile) {
        const presign = await presignPortalWhatsappUpload(client._id, {
          filename: selectedFile.name,
          contentType: selectedFile.type || 'application/octet-stream',
          sizeBytes: selectedFile.size,
        });

        const uploadRes = await fetch(presign.uploadUrl, {
          method: presign.method || 'PUT',
          headers: { 'Content-Type': presign.contentType || selectedFile.type || 'application/octet-stream' },
          body: selectedFile,
        });
        if (!uploadRes.ok) {
          throw new Error(lang === 'en' ? 'Image upload failed.' : 'Uploaden van afbeelding is mislukt.');
        }

        attachments.push({
          key: presign.key,
          url: presign.fileUrl,
          name: selectedFile.name,
          contentType: selectedFile.type || undefined,
          sizeBytes: selectedFile.size,
        });
      }

      return createPortalWhatsappMessage(client._id, {
        text: trimmedText,
        attachments,
      });
    },
    onSuccess: () => {
      setText('');
      setSelectedFile(null);
      setErrorMsg('');
      qc.invalidateQueries({ queryKey: ['portalWhatsappMessages', client._id] });
    },
    onError: (e) => {
      setErrorMsg(e.message || (lang === 'en' ? 'Could not save WhatsApp item.' : 'WhatsApp-item kon niet worden opgeslagen.'));
    },
  });

  return (
    <div style={{ padding: '12px 0' }}>
      <div
        style={{
          border: '1.5px dashed var(--border)',
          borderRadius: '10px',
          background: 'var(--bg-alt)',
          padding: '14px',
          marginBottom: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErrorMsg('');
          }}
          rows={3}
          placeholder={lang === 'en' ? 'Optional context/message for Paolo WhatsApp item…' : 'Optionele context/bericht voor Paolo WhatsApp-item…'}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1.5px solid var(--border)',
            borderRadius: '9px',
            fontFamily: 'DM Sans,sans-serif',
            fontSize: '13px',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setSelectedFile(e.target.files?.[0] || null);
              setErrorMsg('');
            }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending}
            style={submitMut.isPending ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : undefined}
          >
            {submitMut.isPending ? (
              <>
                <LoadingSpinner size={16} />
                <span>{lang === 'en' ? 'Saving…' : 'Opslaan…'}</span>
              </>
            ) : (
              lang === 'en' ? 'Save WhatsApp item' : 'WhatsApp-item opslaan'
            )}
          </button>
        </div>
        {selectedFile && (
          <div
            style={{
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: 'white',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              minWidth: 0,
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={selectedFile.name}
                style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }}
              />
            ) : null}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{fmtFileSize(selectedFile.size)}</div>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <p role="alert" style={{ ...fieldErrStyle, marginBottom: '12px' }}>
          {errorMsg}
        </p>
      )}

      {isLoading ? (
        <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>{lang === 'en' ? 'Loading WhatsApp items…' : 'WhatsApp-items laden…'}</div>
      ) : messages.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic' }}>
          {lang === 'en' ? 'No WhatsApp items yet.' : 'Nog geen WhatsApp-items.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {messages.map((msg) => {
            const firstAttachment = Array.isArray(msg.attachments) ? msg.attachments[0] : null;
            return (
              <div
                key={msg._id}
                style={{
                  background: 'var(--bg-alt)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '6px' }}>
                  {msg.author || '—'} · {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString(lang === 'en' ? 'en-GB' : 'nl-NL') : '—'}
                </div>
                {msg.text ? <div style={{ fontSize: '13px', marginBottom: firstAttachment ? '8px' : 0 }}>{msg.text}</div> : null}
                {firstAttachment ? (
                  <a href={firstAttachment.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                    {lang === 'en' ? 'Open screenshot' : 'Screenshot openen'}
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const fieldErrStyle = { fontSize: '12px', color: '#c04040', marginTop: '6px', marginBottom: 0, lineHeight: 1.4 };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getClientContacts(client) {
  const fromArray = Array.isArray(client?.contacts) ? client.contacts : [];
  const normalized = fromArray
    .map((contact) => ({
      name: (contact?.name || '').trim(),
      email: (contact?.email || '').trim(),
      phone: (contact?.phone || '').trim(),
      role: (contact?.role || '').trim(),
      primary: !!contact?.primary,
    }))
    .filter((contact) => contact.name || contact.email || contact.phone || contact.role);

  if (normalized.length === 0) {
    const fallback = {
      name: (client?.contact || '').trim(),
      email: (client?.email || '').trim(),
      phone: (client?.phone || '').trim(),
      role: '',
      primary: true,
    };
    if (fallback.name || fallback.email || fallback.phone) normalized.push(fallback);
  }

  if (normalized.length > 0 && !normalized.some((contact) => contact.primary)) {
    normalized[0].primary = true;
  }
  return normalized;
}

function AddClientModal({ open, onClose, onSave, saving, lang, serverError, onClearServerError }) {
  const [name, setName] = useState('');
  const [sector, setSector] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [since, setSince] = useState('');
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (open) {
      setName('');
      setSector('');
      setContact('');
      setEmail('');
      setPhone('');
      setSince('');
      setPortalEmail('');
      setPortalPassword('');
      setFieldErrors({});
    }
  }, [open]);

  if (!open) return null;

  const title = lang === 'en' ? 'Add new client' : 'Nieuwe klant toevoegen';

  const clearServerError = () => {
    if (serverError) onClearServerError?.();
  };

  const setErr = (key, msg) => {
    setFieldErrors((prev) => ({ ...prev, [key]: msg || '' }));
  };

  const handleSave = () => {
    const err = {};
    const en = lang === 'en';
    if (!name.trim()) err.name = en ? 'Enter a company name.' : 'Vul een bedrijfsnaam in.';
    const em = email.trim();
    if (em && !EMAIL_REGEX.test(em)) err.email = en ? 'Enter a valid email address.' : 'Vul een geldig e-mailadres in.';
    const pe = portalEmail.trim().toLowerCase();
    const pp = portalPassword.trim();
    if (pe && !EMAIL_REGEX.test(pe)) {
      err.portalEmail = en ? 'Enter a valid portal email.' : 'Vul een geldig portaal-e-mailadres in.';
    }
    if ((pe && !pp) || (!pe && pp)) {
      if (!pe && pp) {
        err.portalEmail = en ? 'Portal email is required when setting a password.' : 'Portaal-e-mail is verplicht bij een wachtwoord.';
      }
      if (pe && !pp) {
        err.portalPassword = en
          ? 'Portal password is required when setting portal email (min. 8 characters).'
          : 'Portaalwachtwoord is verplicht bij portaal-e-mail (min. 8 tekens).';
      }
    }
    if (pe && pp && pp.length < 8) {
      err.portalPassword = en
        ? 'Portal password must be at least 8 characters.'
        : 'Portaalwachtwoord moet minimaal 8 tekens zijn.';
    }
    setFieldErrors(err);
    if (Object.keys(err).length) return;
    onSave({
      name: name.trim(),
      sector: sector.trim() || undefined,
      contact: contact.trim() || undefined,
      email: em ? em : undefined,
      phone: phone.trim() || undefined,
      contacts:
        contact.trim() || em || phone.trim()
          ? [
              {
                name: contact.trim() || undefined,
                email: em || undefined,
                phone: phone.trim() || undefined,
                primary: true,
              },
            ]
          : undefined,
      since: since || undefined,
      color: pickColor(name),
      portalEmail: pe || undefined,
      portalPassword: pp || undefined,
    });
  };

  const inputErrBorder = (key) => (fieldErrors[key] ? { borderColor: '#c04040' } : undefined);

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={lang === 'en' ? 'Close' : 'Sluiten'}>
            ✕
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">
              {lang === 'en' ? 'Company name' : 'Bedrijfsnaam'} <span style={{ color: '#c04040' }}>*</span>
            </label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (fieldErrors.name) setErr('name', '');
                clearServerError();
              }}
              placeholder={lang === 'en' ? 'Company name…' : 'Naam van het bedrijf…'}
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? 'add-client-name-err' : undefined}
              style={inputErrBorder('name')}
            />
            {fieldErrors.name && (
              <p id="add-client-name-err" role="alert" style={fieldErrStyle}>
                {fieldErrors.name}
              </p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Sector' : 'Sector'}</label>
            <input
              className="form-input"
              value={sector}
              onChange={(e) => {
                setSector(e.target.value);
                clearServerError();
              }}
              placeholder="bijv. Fitness & Wellness"
            />
          </div>
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Contact person' : 'Contactpersoon'}</label>
            <input
              className="form-input"
              value={contact}
              onChange={(e) => {
                setContact(e.target.value);
                clearServerError();
              }}
              placeholder={lang === 'en' ? 'Name' : 'Naam contactpersoon'}
            />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setErr('email', '');
                clearServerError();
              }}
              placeholder="email@bedrijf.nl"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'add-client-email-err' : undefined}
              style={inputErrBorder('email')}
            />
            {fieldErrors.email && (
              <p id="add-client-email-err" role="alert" style={fieldErrStyle}>
                {fieldErrors.email}
              </p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Phone' : 'Telefoon'}</label>
            <input
              className="form-input"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                clearServerError();
              }}
              placeholder="06-12345678"
            />
          </div>
          <div className="form-group">
            <label className="form-label">{lang === 'en' ? 'Client since' : 'Klant since'}</label>
            <input
              className="form-input"
              type="date"
              value={since}
              onChange={(e) => {
                setSince(e.target.value);
                clearServerError();
              }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              {lang === 'en' ? 'Portal login email (optional)' : 'Portaal login e-mail (optioneel)'}
            </label>
            <input
              className="form-input"
              type="email"
              value={portalEmail}
              onChange={(e) => {
                setPortalEmail(e.target.value);
                if (fieldErrors.portalEmail) setErr('portalEmail', '');
                if (fieldErrors.portalPassword) setErr('portalPassword', '');
                clearServerError();
              }}
              placeholder="client@bedrijf.nl"
              aria-invalid={!!fieldErrors.portalEmail}
              aria-describedby={fieldErrors.portalEmail ? 'add-client-portal-email-err' : undefined}
              style={inputErrBorder('portalEmail')}
            />
            {fieldErrors.portalEmail && (
              <p id="add-client-portal-email-err" role="alert" style={fieldErrStyle}>
                {fieldErrors.portalEmail}
              </p>
            )}
          </div>
          <div className="form-group">
            <FormInput
              className="form-group"
              inputClassName="form-input"
              id="add-client-portal-password"
              type="password"
              label={lang === 'en' ? 'Portal login password (optional)' : 'Portaal login wachtwoord (optioneel)'}
              value={portalPassword}
              onChange={(e) => {
                setPortalPassword(e.target.value);
                if (fieldErrors.portalEmail) setErr('portalEmail', '');
                if (fieldErrors.portalPassword) setErr('portalPassword', '');
                clearServerError();
              }}
              placeholder={lang === 'en' ? 'Only with portal email, min. 8 characters' : 'Alleen met portaal-e-mail, min. 8 tekens'}
              style={inputErrBorder('portalPassword')}
              errorMessage={fieldErrors.portalPassword}
            />
          </div>
        </div>
        {serverError && (
          <p
            role="alert"
            style={{
              ...fieldErrStyle,
              marginTop: '12px',
              padding: '10px 12px',
              background: '#FDF2F2',
              borderRadius: '8px',
              border: '1px solid #e8c8c8',
            }}
          >
            {serverError}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {lang === 'en' ? 'Cancel' : 'Annuleer'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={saving ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : undefined}
          >
            {saving ? (
              <>
                <LoadingSpinner size={18} />
                <span>{lang === 'en' ? 'Save client' : 'Klant opslaan'}</span>
              </>
            ) : (
              lang === 'en' ? 'Save client' : 'Klant opslaan'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteClientModal({ open, onClose, onConfirm, deleting, lang, clientName }) {
  if (!open) return null;

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{lang === 'en' ? 'Delete client' : 'Klant verwijderen'}</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={lang === 'en' ? 'Close' : 'Sluiten'}>
            ✕
          </button>
        </div>
        <p style={{ fontSize: '14px', color: 'var(--text-2)', marginTop: 0 }}>
          {lang === 'en'
            ? `Permanently delete "${clientName}"? This cannot be undone.`
            : `"${clientName}" permanent verwijderen? Dit kan niet ongedaan worden gemaakt.`}
        </p>
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={deleting}>
            {lang === 'en' ? 'Cancel' : 'Annuleer'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={deleting}
            style={{ background: '#c04040', borderColor: '#c04040' }}
          >
            {deleting ? (lang === 'en' ? 'Deleting…' : 'Verwijderen…') : lang === 'en' ? 'Delete permanently' : 'Permanent verwijderen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PortalAccessModal({ open, onClose, onSave, saving, lang, currentEmail, serverError, onClearServerError }) {
  const [portalEmail, setPortalEmail] = useState('');
  const [portalPassword, setPortalPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setPortalEmail(currentEmail || '');
    setPortalPassword('');
    setFieldErrors({});
  }, [open, currentEmail]);

  if (!open) return null;

  const en = lang === 'en';
  const hasExistingPortal = Boolean((currentEmail || '').trim());

  const save = () => {
    const pe = portalEmail.trim().toLowerCase();
    const pp = portalPassword.trim();
    const err = {};
    if (!pe) {
      err.portalEmail = en ? 'Enter a portal login email.' : 'Vul een portaal login e-mail in.';
    } else if (!EMAIL_REGEX.test(pe)) {
      err.portalEmail = en ? 'Enter a valid email address.' : 'Vul een geldig e-mailadres in.';
    }
    if (!hasExistingPortal && !pp) {
      err.portalPassword = en
        ? 'Enter a password (min. 8 characters) for the first portal login.'
        : 'Vul een wachtwoord in (min. 8 tekens) voor de eerste portaaltoegang.';
    }
    if (pp && pp.length < 8) {
      err.portalPassword = en
        ? 'Password must be at least 8 characters.'
        : 'Wachtwoord moet minimaal 8 tekens zijn.';
    }
    setFieldErrors(err);
    if (Object.keys(err).length) return;
    onSave({
      portalEmail: pe || undefined,
      portalPassword: pp || undefined,
    });
  };

  const portalInputErr = (key) => (fieldErrors[key] ? { borderColor: '#c04040' } : undefined);

  return (
    <div className="modal-overlay open" role="dialog" aria-modal="true" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{lang === 'en' ? 'Portal access' : 'Portaaltoegang'}</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={lang === 'en' ? 'Close' : 'Sluiten'}>
            ✕
          </button>
        </div>
        <div className="form-group">
          <label className="form-label">
            {lang === 'en' ? 'Portal login email' : 'Portaal login e-mail'} <span style={{ color: '#c04040' }}>*</span>
          </label>
          <input
            className="form-input"
            type="email"
            value={portalEmail}
            onChange={(e) => {
              setPortalEmail(e.target.value);
              if (fieldErrors.portalEmail) setFieldErrors((p) => ({ ...p, portalEmail: '' }));
              onClearServerError?.();
            }}
            placeholder="client@bedrijf.nl"
            aria-invalid={!!fieldErrors.portalEmail}
            aria-describedby={fieldErrors.portalEmail ? 'portal-access-email-err' : undefined}
            style={portalInputErr('portalEmail')}
          />
          {fieldErrors.portalEmail && (
            <p id="portal-access-email-err" role="alert" style={fieldErrStyle}>
              {fieldErrors.portalEmail}
            </p>
          )}
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <FormInput
            className="form-group"
            inputClassName="form-input"
            id="portal-access-password"
            type="password"
            label={lang === 'en' ? 'New password (optional)' : 'Nieuw wachtwoord (optioneel)'}
            value={portalPassword}
            onChange={(e) => {
              setPortalPassword(e.target.value);
              if (fieldErrors.portalPassword) setFieldErrors((p) => ({ ...p, portalPassword: '' }));
              onClearServerError?.();
            }}
            placeholder={lang === 'en' ? 'Only fill to set/reset password' : 'Alleen invullen om wachtwoord te zetten/resetten'}
            style={portalInputErr('portalPassword')}
            errorMessage={fieldErrors.portalPassword}
          />
        </div>
        {serverError && (
          <p role="alert" style={{ ...fieldErrStyle, marginTop: '10px' }}>
            {serverError}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {lang === 'en' ? 'Cancel' : 'Annuleer'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={save}
            disabled={saving}
            style={saving ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : undefined}
          >
            {saving ? (
              <>
                <LoadingSpinner size={18} />
                <span>{lang === 'en' ? 'Saving…' : 'Opslaan…'}</span>
              </>
            ) : (
              lang === 'en' ? 'Save access' : 'Toegang opslaan'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KlantenView() {
  const { t, lang } = useLang();
  const { clientId: clientIdParam } = useParams();
  const navigate = useNavigate();
  const selectedId = clientIdParam || null;
  const [tab, setTab] = useState('info');
  const [addOpen, setAddOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [portalAccessOpen, setPortalAccessOpen] = useState(false);
  const [contactsDraft, setContactsDraft] = useState([]);
  const [isInfoEditing, setIsInfoEditing] = useState(false);
  const [infoDraft, setInfoDraft] = useState({
    name: '',
    sector: '',
    contact: '',
    email: '',
    phone: '',
    since: '',
    phase: '',
    notes: '',
    status: 'active',
  });
  const [addSaveError, setAddSaveError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [portalAccessError, setPortalAccessError] = useState('');
  const qc = useQueryClient();

  const { data: clients = [], isLoading: isClientsLoading } = useQuery({ queryKey: ['clients'], queryFn: getClients });
  const {
    data: selectedFresh,
    isError: isSelectedError,
    isFetched: isSelectedFetched,
    isPending: isSelectedPending,
  } = useQuery({
    queryKey: ['client', selectedId],
    queryFn: () => getClient(selectedId),
    enabled: !!selectedId,
  });

  const selected = selectedFresh || clients.find((c) => String(c._id) === String(selectedId)) || null;
  const showDetailShell = Boolean(selectedId && (selected || isSelectedPending));

  useEffect(() => {
    if (!selectedId || !isSelectedFetched || !isSelectedError) return;
    navigate(`${DASHBOARD_BASE}/klanten`, { replace: true });
  }, [selectedId, isSelectedFetched, isSelectedError, navigate]);

  useEffect(() => {
    if (clientIdParam) setTab('info');
  }, [clientIdParam]);

  useEffect(() => {
    if (!selected?._id) {
      setContactsDraft([]);
      return;
    }
    setContactsDraft(getClientContacts(selected));
  }, [selected?._id, selected?.contacts, selected?.contact, selected?.email, selected?.phone]);

  useEffect(() => {
    if (!selected?._id) {
      setIsInfoEditing(false);
      return;
    }
    setInfoDraft({
      name: selected.name || '',
      sector: selected.sector || '',
      contact: selected.contact || '',
      email: selected.email || '',
      phone: selected.phone || '',
      since: selected.since || '',
      phase: selected.phase || '',
      notes: selected.notes || '',
      status: selected.urgent ? 'urgent' : 'active',
    });
    setIsInfoEditing(false);
  }, [
    selected?._id,
    selected?.name,
    selected?.sector,
    selected?.contact,
    selected?.email,
    selected?.phone,
    selected?.since,
    selected?.phase,
    selected?.notes,
    selected?.urgent,
  ]);

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }) => updateClient(id, d),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', data._id] });
    },
  });

  const createMut = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setAddSaveError('');
      setAddOpen(false);
    },
    onError: (e) =>
      setAddSaveError(e.message || (lang === 'en' ? 'Could not save client.' : 'Klant kon niet worden opgeslagen.')),
  });

  const deleteMut = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setDeleteError('');
      setDeleteOpen(false);
      navigate(`${DASHBOARD_BASE}/klanten`, { replace: true });
    },
    onError: (e) =>
      setDeleteError(e.message || (lang === 'en' ? 'Could not delete client.' : 'Klant kon niet worden verwijderd.')),
  });

  const portalAccessMut = useMutation({
    mutationFn: ({ id, ...d }) => updateClient(id, d),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['client', data._id] });
      setPortalAccessError('');
      setPortalAccessOpen(false);
    },
    onError: (e) =>
      setPortalAccessError(
        e.message || (lang === 'en' ? 'Could not save portal access.' : 'Portaaltoegang kon niet worden opgeslagen.'),
      ),
  });

  const subtitle =
    lang === 'en'
      ? `${clients.length} active client relationship${clients.length === 1 ? '' : 's'}`
      : `${clients.length} actieve klantrelatie${clients.length === 1 ? '' : 's'}`;

  const openDetail = (c) => {
    setTab('info');
    navigate(`${DASHBOARD_BASE}/klanten/${c._id}`);
  };

  const backToList = () => {
    setDeleteError('');
    setDeleteOpen(false);
    setPortalAccessError('');
    setPortalAccessOpen(false);
    navigate(`${DASHBOARD_BASE}/klanten`);
  };

  const saveClient = (data) => {
    if (!selected) return;
    updateMut.mutate({ id: selected._id, ...data });
  };

  const saveInfoChanges = () => {
    const primaryContacts = getClientContacts(selected);
    const nextContacts = primaryContacts.length
      ? primaryContacts.map((item, idx) =>
          item.primary || idx === 0
            ? {
                ...item,
                name: infoDraft.contact.trim(),
                email: infoDraft.email.trim(),
                phone: infoDraft.phone.trim(),
              }
            : item,
        )
      : [
          {
            name: infoDraft.contact.trim(),
            email: infoDraft.email.trim(),
            phone: infoDraft.phone.trim(),
            role: '',
            primary: true,
          },
        ];

    saveClient({
      name: infoDraft.name.trim(),
      sector: infoDraft.sector.trim() || undefined,
      phase: infoDraft.phase.trim() || undefined,
      since: infoDraft.since || undefined,
      notes: infoDraft.notes.trim() || undefined,
      contact: infoDraft.contact.trim() || undefined,
      email: infoDraft.email.trim() || undefined,
      phone: infoDraft.phone.trim() || undefined,
      urgent: infoDraft.status === 'urgent',
      urgentReason: infoDraft.status === 'urgent' ? selected?.urgentReason || 'Urgent' : undefined,
      contacts: nextContacts,
    });
    setIsInfoEditing(false);
  };

  const deleteCurrent = () => {
    if (!selected) return;
    setDeleteError('');
    setDeleteOpen(true);
  };

  const confirmDeleteCurrent = () => {
    if (!selected) return;
    deleteMut.mutate(selected._id);
  };

  const openPortalAccess = () => {
    setPortalAccessError('');
    setPortalAccessOpen(true);
  };

  const addModal = (
    <AddClientModal
      open={addOpen}
      onClose={() => {
        setAddSaveError('');
        setAddOpen(false);
      }}
      onSave={(payload) => createMut.mutate(payload)}
      saving={createMut.isPending}
      lang={lang}
      serverError={addSaveError}
      onClearServerError={() => setAddSaveError('')}
    />
  );

  if (showDetailShell) {
    if (!selected) {
      return (
        <>
          <section className="view active" id="view-klanten">
            <div style={{ padding: '40px', color: 'var(--text-3)' }}>
              {lang === 'en' ? 'Loading client…' : 'Klant laden…'}
            </div>
          </section>
          {addModal}
        </>
      );
    }
    const c = selected;
    const initials = c.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <>
        <section className="view active" id="view-klanten">
        <div className="client-detail active">
          <div
            className="klanten-detail-toolbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: deleteError ? '10px' : '20px',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <button type="button" className="btn btn-ghost btn-sm" onClick={backToList}>
              ← {lang === 'en' ? 'Back to overview' : 'Terug naar overzicht'}
            </button>
            <div className="klanten-detail-toolbar-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={openPortalAccess}
                style={{ borderColor: 'var(--border)' }}
              >
                🔐 {c.portalEmail ? (lang === 'en' ? 'Portal access' : 'Portaaltoegang') : (lang === 'en' ? 'Set portal access' : 'Portaaltoegang instellen')}
              </button>
              {c.portalEmail ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => window.open('/portaal', '_blank')}
                  style={{ background: 'var(--sidebar)', color: 'white', borderColor: 'var(--sidebar)' }}
                >
                  🌐 {lang === 'en' ? 'View portal' : 'Portaal bekijken'}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={deleteCurrent}
                style={{ color: '#c04040', borderColor: '#e8c8c8' }}
              >
                {t('delete')}
              </button>
            </div>
          </div>
          {deleteError && (
            <p role="alert" style={{ ...fieldErrStyle, marginBottom: '16px' }}>
              {deleteError}
            </p>
          )}
          <div className="detail-card">
            <div className="detail-header">
              <div className="detail-logo" style={{ background: c.color || 'var(--accent)' }}>
                {initials}
              </div>
              <div style={{ flex: 1 }}>
                <div className="detail-title">{c.name}</div>
                <div className="detail-sector">{c.sector || '—'}</div>
                {c.urgent && (
                  <div className="urgent-badge" style={{ marginTop: '8px', display: 'inline-flex' }}>
                    ⚠ {c.urgentReason || (lang === 'en' ? 'Urgent' : 'Urgent')}
                  </div>
                )}
              </div>
              {tab === 'info' && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    if (isInfoEditing) {
                      setInfoDraft({
                        name: c.name || '',
                        sector: c.sector || '',
                        contact: c.contact || '',
                        email: c.email || '',
                        phone: c.phone || '',
                        since: c.since || '',
                        phase: c.phase || '',
                        notes: c.notes || '',
                        status: c.urgent ? 'urgent' : 'active',
                      });
                    }
                    setIsInfoEditing((prev) => !prev);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 20h4l10-10-4-4L4 16v4z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13 7l4 4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {isInfoEditing ? (lang === 'en' ? 'Cancel edit' : 'Bewerken annuleren') : lang === 'en' ? 'Edit' : 'Bewerk'}
                </button>
              )}
            </div>
            <div className="tabs klanten-tabs" style={{ marginBottom: '24px' }}>
              {TABS.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  className={`tab-btn${tab === tb.id ? ' active' : ''}`}
                  onClick={() => setTab(tb.id)}
                >
                  {tb.id === 'portaal' ? <PortaalTabLabel clientId={c._id} baseLabel={tb.label} /> : tb.label}
                </button>
              ))}
            </div>
            {tab === 'info' && (
              <div>
                {isInfoEditing ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      {[
                        ['name', lang === 'en' ? 'Company name' : 'Bedrijfsnaam', lang === 'en' ? 'Company name' : 'Naam van het bedrijf'],
                        ['sector', lang === 'en' ? 'Sector' : 'Sector', 'bijv. Fitness & Wellness'],
                        ['contact', t('contact'), lang === 'en' ? 'Primary contact person' : 'Primaire contactpersoon'],
                        ['email', 'E-mail', 'email@bedrijf.nl'],
                        ['phone', t('phone'), '06-12345678'],
                        ['phase', t('phase'), 'Pre-prod'],
                      ].map(([key, label, placeholder]) => (
                        <div key={key} className="form-group">
                          <label className="form-label">{label}</label>
                          <input
                            className="form-input"
                            value={infoDraft[key]}
                            placeholder={placeholder}
                            type={key === 'email' ? 'email' : 'text'}
                            onChange={(e) => setInfoDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                          />
                        </div>
                      ))}
                      <div className="form-group">
                        <label className="form-label">{t('clientSince')}</label>
                        <input
                          className="form-input"
                          type="date"
                          value={infoDraft.since}
                          onChange={(e) => setInfoDraft((prev) => ({ ...prev, since: e.target.value }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">{t('statusLabel')}</label>
                        <select
                          className="form-input"
                          value={infoDraft.status}
                          onChange={(e) => setInfoDraft((prev) => ({ ...prev, status: e.target.value }))}
                        >
                          <option value="active">{t('active')}</option>
                          <option value="urgent">{t('urgentStatus')}</option>
                        </select>
                      </div>
                    </div>
                    <div className="detail-notes" style={{ marginTop: '8px' }}>
                      <strong
                        style={{
                          display: 'block',
                          marginBottom: '6px',
                          fontSize: '11px',
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          color: 'var(--text-3)',
                        }}
                      >
                        {t('notes')}
                      </strong>
                      <textarea
                        className="form-input"
                        value={infoDraft.notes}
                        rows={4}
                        onChange={(e) => setInfoDraft((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder={lang === 'en' ? 'Add client notes…' : 'Voeg klantnotities toe…'}
                        style={{ minHeight: '92px', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={updateMut.isPending}
                        onClick={saveInfoChanges}
                        style={updateMut.isPending ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : undefined}
                      >
                        {updateMut.isPending ? (
                          <>
                            <LoadingSpinner size={18} />
                            <span>{lang === 'en' ? 'Saving…' : 'Opslaan…'}</span>
                          </>
                        ) : (
                          lang === 'en' ? 'Save changes' : 'Wijzigingen opslaan'
                        )}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={() => setIsInfoEditing(false)}>
                        {lang === 'en' ? 'Cancel' : 'Annuleer'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="detail-grid">
                      {[
                        [t('contact'), c.contact],
                        ['E-mail', c.portalEmail || c.email],
                        [t('phone'), c.phone],
                        [t('clientSince'), fmtDate(c.since)],
                        [t('phase'), c.phase],
                        [
                          t('statusLabel'),
                          <span key="st" style={{ color: c.urgent ? 'var(--orange)' : 'var(--sage)' }}>
                            {c.urgent ? t('urgentStatus') : t('active')}
                          </span>,
                        ],
                      ].map(([l, v]) => (
                        <div key={l} className="detail-field">
                          <label>{l}</label>
                          <p>{v ?? '—'}</p>
                        </div>
                      ))}
                    </div>
                    <div className="detail-notes">
                      <strong
                        style={{
                          display: 'block',
                          marginBottom: '6px',
                          fontSize: '11px',
                          letterSpacing: '.08em',
                          textTransform: 'uppercase',
                          color: 'var(--text-3)',
                        }}
                      >
                        {t('notes')}
                      </strong>
                      <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>
                        {typeof c.notes === 'string' && c.notes.trim() ? c.notes : lang === 'en' ? 'No notes yet.' : 'Geen notities beschikbaar.'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
            {tab === 'portaal' && <PortaalTab client={c} />}
            {tab === 'documenten' && <DocumentenTab client={c} lang={lang} />}
            {tab === 'whatsapp' && <WhatsAppTab client={c} lang={lang} />}
            {tab === 'retainer' && <RetainerTab client={c} onSave={saveClient} />}
            {tab === 'contacten' && (
              <div style={{ padding: '12px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                    {lang === 'en' ? 'Manage one or more contact persons for this client.' : 'Beheer een of meerdere contactpersonen voor deze klant.'}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setContactsDraft((prev) => [
                        ...prev,
                        { name: '', email: '', phone: '', role: '', primary: prev.length === 0 },
                      ])
                    }
                  >
                    + {lang === 'en' ? 'Add contact' : 'Contact toevoegen'}
                  </button>
                </div>

                {contactsDraft.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic' }}>
                    {lang === 'en' ? 'No contacts yet. Add one to get started.' : 'Nog geen contacten. Voeg er een toe om te beginnen.'}
                  </div>
                ) : (
                  contactsDraft.map((contactItem, idx) => (
                    <div
                      key={`${idx}-${contactItem.email || contactItem.name || 'contact'}`}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: '10px',
                        padding: '12px',
                        marginBottom: '10px',
                        background: 'var(--bg-alt)',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        {[
                          ['name', lang === 'en' ? 'Name' : 'Naam', lang === 'en' ? 'Contact name' : 'Naam contactpersoon'],
                          ['email', 'E-mail', 'email@bedrijf.nl'],
                          ['phone', lang === 'en' ? 'Phone' : 'Telefoon', '06-12345678'],
                          ['role', lang === 'en' ? 'Role' : 'Rol', lang === 'en' ? 'e.g. Marketing manager' : 'bijv. Marketing manager'],
                        ].map(([key, label, placeholder]) => (
                          <label key={`${idx}-${key}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                              {label}
                            </span>
                            <input
                              value={contactItem[key]}
                              placeholder={placeholder}
                              onChange={(e) =>
                                setContactsDraft((prev) =>
                                  prev.map((item, itemIdx) =>
                                    itemIdx === idx ? { ...item, [key]: e.target.value } : item,
                                  ),
                                )
                              }
                              style={{
                                width: '100%',
                                padding: '9px 12px',
                                border: '1.5px solid var(--border)',
                                borderRadius: '8px',
                                fontFamily: 'DM Sans,sans-serif',
                                fontSize: '13px',
                                color: 'var(--text)',
                                background: 'white',
                                outline: 'none',
                                boxSizing: 'border-box',
                              }}
                            />
                          </label>
                        ))}
                      </div>
                      <div style={{ marginTop: '10px', display: 'flex', gap: '8px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            setContactsDraft((prev) =>
                              prev.map((item, itemIdx) => ({ ...item, primary: itemIdx === idx })),
                            )
                          }
                        >
                          {contactItem.primary ? (lang === 'en' ? 'Primary contact' : 'Primair contact') : (lang === 'en' ? 'Set as primary' : 'Maak primair')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#c04040', borderColor: '#e8c8c8' }}
                          onClick={() =>
                            setContactsDraft((prev) => {
                              const next = prev.filter((_, itemIdx) => itemIdx !== idx);
                              if (next.length > 0 && !next.some((item) => item.primary)) {
                                next[0] = { ...next[0], primary: true };
                              }
                              return next;
                            })
                          }
                        >
                          {lang === 'en' ? 'Remove' : 'Verwijderen'}
                        </button>
                      </div>
                    </div>
                  ))
                )}

                <div style={{ marginTop: '14px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={updateMut.isPending}
                    onClick={() => saveClient({ contacts: contactsDraft })}
                    style={updateMut.isPending ? { display: 'inline-flex', alignItems: 'center', gap: '8px' } : undefined}
                  >
                    {updateMut.isPending ? (
                      <>
                        <LoadingSpinner size={18} />
                        <span>{lang === 'en' ? 'Saving…' : 'Opslaan…'}</span>
                      </>
                    ) : (
                      lang === 'en' ? 'Save contacts' : 'Contacten opslaan'
                    )}
                  </button>
                </div>
              </div>
            )}
            {tab === 'vragenlijst' && (
              <div style={{ fontSize: '13px', color: 'var(--text-3)', fontStyle: 'italic', padding: '12px 0' }}>
                {lang === 'en' ? 'Not filled in for this client yet.' : 'Nog niet ingevuld voor deze klant.'}
              </div>
            )}
          </div>
        </div>
        </section>
        {addModal}
        <DeleteClientModal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={confirmDeleteCurrent}
          deleting={deleteMut.isPending}
          lang={lang}
          clientName={selected?.name || ''}
        />
        <PortalAccessModal
          open={portalAccessOpen}
          onClose={() => setPortalAccessOpen(false)}
          onSave={(payload) => portalAccessMut.mutate({ id: selected?._id, ...payload })}
          saving={portalAccessMut.isPending}
          lang={lang}
          currentEmail={selected?.portalEmail || ''}
          serverError={portalAccessError}
          onClearServerError={() => setPortalAccessError('')}
        />
      </>
    );
  }

  return (
    <>
    <section className="view active" id="view-klanten">
      <div className="page-header">
        <div>
          <div className="page-title">
            {lang === 'en' ? (
              <>
                Clients <em>— Overview</em>
              </>
            ) : (
              <>
                Klanten <em>— Overzicht</em>
              </>
            )}
          </div>
          <div className="page-subtitle">{subtitle}</div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setAddSaveError('');
            setAddOpen(true);
          }}
        >
          + {lang === 'en' ? 'Add client' : 'Klant toevoegen'}
        </button>
      </div>
      <div className="client-list-wrap">
        <div className="client-list" aria-busy={isClientsLoading}>
          {isClientsLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`client-skeleton-${i}`}
                className="client-row"
                role="status"
                aria-hidden="true"
                style={{
                  pointerEvents: 'none',
                  opacity: 0.85,
                }}
              >
                <div
                  className="client-num"
                  style={{
                    width: '24px',
                    height: '12px',
                    borderRadius: '6px',
                    background: 'var(--skeleton-gradient)',
                    backgroundSize: '220% 100%',
                    animation: 'clientSkeletonShimmer 1.2s linear infinite',
                    color: 'transparent',
                  }}
                >
                  00
                </div>
                <div
                  className="client-name"
                  style={{
                    width: `${40 + (i % 3) * 18}%`,
                    minWidth: '140px',
                    height: '14px',
                    borderRadius: '7px',
                    background: 'var(--skeleton-gradient)',
                    backgroundSize: '220% 100%',
                    animation: 'clientSkeletonShimmer 1.2s linear infinite',
                    color: 'transparent',
                  }}
                >
                  loading
                </div>
              </div>
            ))
          ) : clients.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-3)', fontStyle: 'italic' }}>
              {lang === 'en' ? 'No clients yet. Add one to get started.' : 'Nog geen klanten. Voeg er een toe om te beginnen.'}
            </div>
          ) : (
            clients.map((c, i) => (
              <div key={c._id} className="client-row" onClick={() => openDetail(c)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openDetail(c)}>
                <div className="client-num">{String(i + 1).padStart(2, '0')}</div>
                <div className="client-name">{c.name}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
    <style>{`
      :root {
        --skeleton-gradient: linear-gradient(90deg, #eef2f7 20%, #f7f9fc 45%, #eef2f7 70%);
      }
      @keyframes clientSkeletonShimmer {
        0% {
          background-position: 100% 50%;
        }
        100% {
          background-position: -100% 50%;
        }
      }
    `}</style>
    {addModal}
    </>
  );
}

function PortaalTabLabel({ clientId, baseLabel }) {
  const { data: notes = [] } = useQuery({
    queryKey: ['portalNotes', clientId],
    queryFn: () => getPortalNotes(clientId),
    refetchInterval: 10000,
  });
  const count = notes.filter((n) => n.from === 'client').length;
  return (
    <>
      {baseLabel}
      {count > 0 && (
        <span
          style={{
            background: 'var(--accent)',
            color: 'white',
            fontSize: '9px',
            fontWeight: '700',
            padding: '1px 6px',
            borderRadius: '10px',
            marginLeft: '4px',
          }}
        >
          {count}
        </span>
      )}
    </>
  );
}

