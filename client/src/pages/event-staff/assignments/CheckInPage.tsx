import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Divider, Stack, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LocationOffIcon from '@mui/icons-material/LocationOff';
import { useTranslation } from 'react-i18next';
import { assignmentsApi } from '../../../api/assignments';

function fmtTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CheckInPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['my-assignments'],
    queryFn: () => assignmentsApi.mine(),
  });

  const assignment = data?.data.find((a) => a._id === id);

  const checkInMutation = useMutation({
    mutationFn: (location?: { lat: number; lng: number }) =>
      assignmentsApi.checkin(id!, location),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-assignments'] });
      setError('');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => assignmentsApi.checkout(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-assignments'] });
      setError('');
    },
  });

  async function handleCheckIn() {
    setError('');
    setGpsLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10_000 })
      );
      await checkInMutation.mutateAsync({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      try {
        await checkInMutation.mutateAsync(undefined);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } } };
        setError(e.response?.data?.message ?? t('eventStaff.checkin.checkInError'));
      }
    } finally {
      setGpsLoading(false);
    }
  }

  async function handleCheckOut() {
    try {
      await checkOutMutation.mutateAsync();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? t('eventStaff.checkin.checkOutError'));
    }
  }

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}><CircularProgress /></Box>;
  }
  if (!assignment) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{t('eventStaff.checkin.notFound')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>{t('common.back')}</Button>
      </Box>
    );
  }

  const checkedIn  = !!assignment.checkInTime;
  const checkedOut = !!assignment.checkOutTime;
  const now = new Date();
  const slotStart = new Date(assignment.slotStart);
  const canCheckIn  = !checkedIn  && assignment.status === 'confirmed' && now >= new Date(slotStart.getTime() - 15 * 60_000);
  const canCheckOut = checkedIn && !checkedOut;

  return (
    <Box sx={{ p: 2 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }} size="small">
        {t('common.back')}
      </Button>

      <Typography variant="h6" fontWeight={700} mb={0.25}>{t('eventStaff.checkin.title')}</Typography>
      <Typography variant="body2" color="text.secondary" mb={2.5}>
        {assignment.eventName} · {assignment.positionTitle}
      </Typography>

      <Card variant="outlined" sx={{ mb: 2.5 }}>
        <CardContent>
          <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase" letterSpacing="0.06em">
            {t('eventStaff.checkin.assignmentTime')}
          </Typography>
          <Typography fontWeight={700} mt={0.5}>{fmtDateTime(assignment.slotStart)}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('eventStaff.checkin.until')} {fmtTime(assignment.slotEnd)}
          </Typography>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1.5} mb={2.5}>
        <Card variant="outlined" sx={{ flex: 1, borderColor: checkedIn ? 'success.main' : 'divider' }}>
          <CardContent sx={{ p: '12px !important' }}>
            <Stack direction="row" spacing={0.75} alignItems="center" mb={0.5}>
              <LoginIcon color={checkedIn ? 'success' : 'disabled'} sx={{ fontSize: 18 }} />
              <Typography variant="caption" fontWeight={700}>Check-in</Typography>
            </Stack>
            {checkedIn ? (
              <Typography color="success.main" fontWeight={700} fontSize={18}>
                {fmtTime(assignment.checkInTime)}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.disabled" fontSize={12}>{t('eventStaff.checkin.pending')}</Typography>
            )}
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ flex: 1, borderColor: checkedOut ? 'primary.main' : 'divider' }}>
          <CardContent sx={{ p: '12px !important' }}>
            <Stack direction="row" spacing={0.75} alignItems="center" mb={0.5}>
              <LogoutIcon color={checkedOut ? 'primary' : 'disabled'} sx={{ fontSize: 18 }} />
              <Typography variant="caption" fontWeight={700}>Check-out</Typography>
            </Stack>
            {checkedOut ? (
              <Typography color="primary.main" fontWeight={700} fontSize={18}>
                {fmtTime(assignment.checkOutTime)}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.disabled" fontSize={12}>{t('eventStaff.checkin.pending')}</Typography>
            )}
          </CardContent>
        </Card>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {checkedIn && checkedOut && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
          {t('eventStaff.checkin.completed')}
        </Alert>
      )}

      <Divider sx={{ mb: 2.5 }} />

      <Stack spacing={1.5}>
        {canCheckIn && (
          <Button
            variant="contained" color="success" size="large" fullWidth
            startIcon={gpsLoading ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
            onClick={handleCheckIn}
            disabled={checkInMutation.isPending || gpsLoading}
          >
            {gpsLoading
              ? t('eventStaff.checkin.gpsLoading')
              : checkInMutation.isPending
                ? t('eventStaff.checkin.checkingIn')
                : t('eventStaff.checkin.checkInNow')}
          </Button>
        )}

        {!canCheckIn && !checkedIn && (
          <Alert severity="info">
            {t('eventStaff.checkin.checkInAvailableFrom', {
              time: fmtTime(new Date(slotStart.getTime() - 15 * 60_000).toISOString()),
            })}
          </Alert>
        )}

        {canCheckOut && (
          <Button
            variant="outlined" color="primary" size="large" fullWidth
            startIcon={<LogoutIcon />}
            onClick={handleCheckOut}
            disabled={checkOutMutation.isPending}
          >
            {checkOutMutation.isPending ? t('eventStaff.checkin.checkingOut') : t('eventStaff.checkin.checkOutNow')}
          </Button>
        )}

        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: 'text.disabled', pt: 0.5 }}>
          {navigator.geolocation ? (
            <LocationOnIcon fontSize="small" />
          ) : (
            <LocationOffIcon fontSize="small" />
          )}
          <Typography variant="caption">
            {navigator.geolocation
              ? t('eventStaff.checkin.gpsUsed')
              : t('eventStaff.checkin.gpsUnavailable')}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
