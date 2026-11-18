import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Stack, Card, CardContent, Chip, Divider,
  CircularProgress, Button,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import EventIcon from '@mui/icons-material/Event';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { assignmentsApi } from '../../api/assignments';
import { eventApplicationsApi } from '../../api/eventApplications';

function fmt(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('de-DE', { timeStyle: 'short' });
}

export default function EventStaffHomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: asgData, isLoading: asgLoading } = useQuery({
    queryKey: ['my-assignments'],
    queryFn: () => assignmentsApi.mine(),
  });
  const assignments = asgData?.data ?? [];

  const { data: appData, isLoading: appLoading } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => eventApplicationsApi.mine(),
  });
  const applications = appData?.data ?? [];

  const now = new Date();
  const upcoming = assignments.filter((a) => a.status === 'confirmed' && new Date(a.slotStart) >= now)
    .slice(0, 3);
  const pendingInvites = assignments.filter((a) => a.status === 'invited' && new Date(a.slotStart) >= now)
    .slice(0, 3);
  const pendingApps = applications.filter((a) => a.status === 'pending').slice(0, 3);

  return (
    <Box sx={{ p: 2 }}>
      {/* Greeting */}
      <Typography variant="h6" fontWeight={700} mb={0.5}>{t('eventStaff.home.greeting')}</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        {t('eventStaff.home.subtitle')}
      </Typography>

      {/* Stats */}
      <Stack direction="row" spacing={1.5} mb={3}>
        {[
          { label: t('eventStaff.home.confirmedAssignments'), value: assignments.filter((a) => a.status === 'confirmed').length, color: 'success.main' },
          { label: t('eventStaff.home.openInvitations'),      value: assignments.filter((a) => a.status === 'invited' && new Date(a.slotStart) >= now).length,   color: 'warning.main' },
          { label: t('eventStaff.home.applications'),         value: applications.filter((a) => a.status === 'pending').length,  color: 'primary.main' },
        ].map((s) => (
          <Card key={s.label} sx={{ flex: 1 }} elevation={1}>
            <CardContent sx={{ p: '10px !important', textAlign: 'center' }}>
              <Typography variant="h5" fontWeight={700} color={s.color}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, lineHeight: 1.2 }}>{s.label}</Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Pending invitations banner */}
      {pendingInvites.length > 0 && (
        <Card sx={{ mb: 2.5, borderLeft: '4px solid', borderColor: 'warning.main', borderRadius: 2, bgcolor: 'warning.50' }} elevation={1}>
          <CardContent sx={{ p: '12px 14px !important' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={0.75} alignItems="center">
                <HourglassEmptyIcon sx={{ fontSize: 18, color: 'warning.main' }} />
                <Typography variant="body2" fontWeight={700} color="warning.dark">
                  {t('assignments.pendingInvites', {
                    count: pendingInvites.length,
                    inviteWord: pendingInvites.length === 1 ? t('assignments.invitation') : t('assignments.invitations'),
                  })}
                </Typography>
              </Stack>
              <Button size="small" color="warning" variant="contained" onClick={() => navigate('/event-staff/assignments')} sx={{ fontSize: 11 }}>
                {t('assignments.respondNow')}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Upcoming confirmed */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
          <Typography variant="subtitle2" fontWeight={700}>{t('assignments.upcoming')}</Typography>
        </Stack>
        <Button size="small" onClick={() => navigate('/event-staff/assignments')}>{t('common.all')}</Button>
      </Stack>

      {asgLoading && <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={20} /></Box>}

      {!asgLoading && upcoming.length === 0 && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ py: 2, textAlign: 'center' }}>
            <AssignmentIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary" mt={0.5}>{t('assignments.noUpcoming')}</Typography>
          </CardContent>
        </Card>
      )}

      <Stack spacing={1} mb={3}>
        {upcoming.map((a) => (
          <Card key={a._id} elevation={1} sx={{ borderLeft: '3px solid', borderColor: 'success.main' }}>
            <CardContent sx={{ p: '12px !important' }}>
              <Typography variant="body2" fontWeight={700} noWrap>{a.eventName}</Typography>
              <Typography variant="caption" color="text.secondary">{a.positionTitle}</Typography>
              <Stack direction="row" justifyContent="space-between" mt={0.5}>
                <Typography variant="caption">{fmt(a.slotStart)}</Typography>
                <Typography variant="caption" fontWeight={600}>{fmtTime(a.slotStart)} – {fmtTime(a.slotEnd)}</Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      {/* Pending applications */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <HourglassEmptyIcon sx={{ fontSize: 16, color: 'warning.main' }} />
          <Typography variant="subtitle2" fontWeight={700}>{t('assignments.myApplications')}</Typography>
        </Stack>
        <Button size="small" onClick={() => navigate('/event-staff/events')}>{t('nav.events')}</Button>
      </Stack>

      {appLoading && <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={20} /></Box>}

      {!appLoading && pendingApps.length === 0 && (
        <Card variant="outlined">
          <CardContent sx={{ py: 2, textAlign: 'center' }}>
            <EventIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
            <Typography variant="body2" color="text.secondary" mt={0.5}>{t('assignments.noApplications')}</Typography>
            <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/event-staff/events')}>
              {t('assignments.discoverEvents')}
            </Button>
          </CardContent>
        </Card>
      )}

      <Stack spacing={1}>
        {pendingApps.map((a) => (
          <Card key={a._id} elevation={1} sx={{ borderLeft: '3px solid', borderColor: 'warning.main' }}>
            <CardContent sx={{ p: '12px !important' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" fontWeight={700} noWrap flex={1}>{a.eventName}</Typography>
                <Chip label={t('assignments.applied')} size="small" color="warning" sx={{ fontSize: 10, height: 18 }} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Beworben: {new Date(a.appliedAt).toLocaleDateString('de-DE')}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
