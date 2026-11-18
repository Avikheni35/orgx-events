import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Stack, Card, CardContent, Chip, CircularProgress, Tabs, Tab,
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EuroIcon from '@mui/icons-material/Euro';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { assignmentsApi, type Assignment } from '../../../api/assignments';
import { staffAvailabilityApi } from '../../../api/staffAvailability';
import LoginIcon from '@mui/icons-material/Login';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('de-DE', { timeStyle: 'short' });
}
function duration(start: string, end: string) {
  const h = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  return `${h.toFixed(1)}h`;
}

function AssignmentCard({ a, onRespond }: { a: Assignment; onRespond?: (a: Assignment) => void }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const STATUS_CFG: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'default'; icon: React.ReactNode }> = {
    confirmed: { label: t('status.confirmed'),           color: 'success', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
    invited:   { label: t('status.invited'),             color: 'warning', icon: <HourglassEmptyIcon sx={{ fontSize: 14 }} /> },
    worked:    { label: t('status.worked'),              color: 'default', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
    declined:  { label: t('status.declined'),            color: 'error',   icon: null },
    no_show:   { label: t('assignments.noShowStatus'),   color: 'error',   icon: null },
    cancelled: { label: t('assignments.cancelledStatus'),color: 'error',   icon: null },
  };

  const cfg = STATUS_CFG[a.status] ?? { label: a.status, color: 'default' as const, icon: null };
  const isCancelled = a.status === 'cancelled';
  const borderColor = a.status === 'confirmed' ? 'success.main' : a.status === 'invited' ? 'warning.main' : isCancelled ? 'error.light' : 'divider';

  const now = new Date();
  const slotStart = new Date(a.slotStart);
  const checkedIn = !!a.checkInTime;
  const checkedOut = !!a.checkOutTime;
  const canCheckIn = a.status === 'confirmed' && !checkedOut && now >= new Date(slotStart.getTime() - 15 * 60_000);

  return (
    <Card elevation={1} sx={{ borderRadius: 2, borderLeft: '3px solid', borderColor, opacity: isCancelled ? 0.7 : 1 }}>
      <CardContent sx={{ p: '12px !important' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
          <Typography variant="body2" fontWeight={700} flex={1} noWrap pr={1}
            sx={isCancelled ? { textDecoration: 'line-through', color: 'text.secondary' } : {}}>
            {a.eventName}
          </Typography>
          <Chip label={cfg.label} color={cfg.color} size="small" sx={{ fontSize: 10, height: 18, flexShrink: 0 }} />
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block">{a.positionTitle}</Typography>
        <Stack direction="row" spacing={2} mt={0.75} flexWrap="wrap">
          <Stack direction="row" spacing={0.5} alignItems="center">
            <CalendarTodayIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
            <Typography variant="caption">{fmtDate(a.slotStart)}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
            <Typography variant="caption">{fmtTime(a.slotStart)} – {fmtTime(a.slotEnd)} ({duration(a.slotStart, a.slotEnd)})</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <EuroIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
            <Typography variant="caption">{a.payRatePerHour}/h</Typography>
          </Stack>
        </Stack>

        {a.status === 'invited' && onRespond && (
          <Stack direction="row" spacing={1} mt={1.5}>
            <Button size="small" variant="contained" color="success" fullWidth onClick={() => onRespond(a)} sx={{ fontSize: 12 }}>
              {t('assignments.confirm')}
            </Button>
            <Button size="small" variant="outlined" color="error" fullWidth onClick={() => onRespond({ ...a, _id: a._id + '__decline' })} sx={{ fontSize: 12 }}>
              {t('assignments.decline')}
            </Button>
          </Stack>
        )}

        {canCheckIn && (
          <Button
            size="small" variant={checkedIn ? 'outlined' : 'contained'} color="success" fullWidth
            startIcon={<LoginIcon sx={{ fontSize: 14 }} />}
            onClick={() => navigate(`/event-staff/assignments/${a._id}/checkin`)}
            sx={{ mt: 1.5, fontSize: 12 }}
          >
            {checkedIn ? t('assignments.checkOut') : t('assignments.checkIn')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function AssignmentsPage() {
  const [tab, setTab] = useState(0);
  const [responding, setResponding] = useState<{ assignment: Assignment; action: 'confirmed' | 'declined' } | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['my-assignments'],
    queryFn: () => assignmentsApi.mine(),
  });
  const all: Assignment[] = data?.data ?? [];

  const now = new Date();
  const invited  = all.filter((a) => a.status === 'invited' && new Date(a.slotStart) >= now);
  const upcoming = all.filter((a) => a.status === 'confirmed' && new Date(a.slotStart) >= now);
  // Cancelled always goes to past regardless of slot date; other statuses use slot date
  const past     = all.filter((a) =>
    ['cancelled', 'worked', 'no_show', 'declined'].includes(a.status) ||
    new Date(a.slotStart) < now
  );

  const handleCardRespond = (a: Assignment) => {
    const isDecline = a._id.endsWith('__decline');
    const realId = isDecline ? a._id.replace('__decline', '') : a._id;
    const realAssignment = all.find((x) => x._id === realId)!;
    setNote('');
    setResponding({ assignment: realAssignment, action: isDecline ? 'declined' : 'confirmed' });
  };

  const submitResponse = async () => {
    if (!responding) return;
    setLoading(true);
    try {
      await assignmentsApi.respondById(responding.assignment._id, responding.action, note || undefined);

      // On accept: sync to availability calendar using browser's local timezone
      if (responding.action === 'confirmed') {
        const a = responding.assignment;
        const slotDate = new Date(a.slotStart);
        const toHHMM = (d: Date) =>
          `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const localDate = `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, '0')}-${String(slotDate.getDate()).padStart(2, '0')}`;
        staffAvailabilityApi.upsertOverride({
          date: localDate,
          available: true,
          startTime: toHHMM(slotDate),
          endTime: toHHMM(new Date(a.slotEnd)),
          note: a.eventName,
        }).catch(() => {});
        qc.invalidateQueries({ queryKey: ['my-availability'] });
      }

      qc.invalidateQueries({ queryKey: ['my-assignments'] });
      setResponding(null);
    } catch {
      // keep dialog open on error
    } finally {
      setLoading(false);
    }
  };

  const list = tab === 0 ? upcoming : past;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={700} mb={2}>{t('assignments.myTitle')}</Typography>

      {/* Pending invitations section */}
      {invited.length > 0 && (
        <Box mb={3}>
          <Stack direction="row" spacing={0.75} alignItems="center" mb={1}>
            <HourglassEmptyIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            <Typography variant="subtitle2" fontWeight={700} color="warning.main">
              {t('assignments.pendingInvitationsHeader', { count: invited.length })}
            </Typography>
          </Stack>
          <Stack spacing={1.5}>
            {invited.map((a) => <AssignmentCard key={a._id} a={a} onRespond={handleCardRespond} />)}
          </Stack>
        </Box>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('assignments.upcomingTab', { count: upcoming.length })} />
        <Tab label={t('assignments.pastTab', { count: past.length })} />
      </Tabs>

      {isLoading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}

      {!isLoading && list.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CalendarTodayIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
          <Typography color="text.secondary" mt={1}>
            {tab === 0 ? t('assignments.noUpcoming') : t('assignments.noPast')}
          </Typography>
        </Box>
      )}

      <Stack spacing={1.5}>
        {list.map((a) => <AssignmentCard key={a._id} a={a} />)}
      </Stack>

      {/* Respond dialog */}
      <Dialog open={!!responding} onClose={() => setResponding(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {responding?.action === 'confirmed' ? t('assignments.acceptTitle') : t('assignments.declineTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" mb={2}>
            <strong>{responding?.assignment.eventName}</strong> – {responding?.assignment.positionTitle}
          </Typography>
          <TextField
            fullWidth multiline rows={2} label={t('assignments.noteOptional')}
            value={note} onChange={(e) => setNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResponding(null)} disabled={loading}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            color={responding?.action === 'confirmed' ? 'success' : 'error'}
            onClick={submitResponse}
            disabled={loading}
          >
            {loading ? '…' : responding?.action === 'confirmed' ? t('common.confirm') : t('assignments.decline')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
