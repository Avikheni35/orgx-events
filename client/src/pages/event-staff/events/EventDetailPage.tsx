import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Stack, Card, CardContent, Chip, Button,
  CircularProgress, IconButton, Divider, Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import EuroIcon from '@mui/icons-material/Euro';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { eventsApi } from '../../../api/events';
import { eventApplicationsApi } from '../../../api/eventApplications';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString(undefined, { timeStyle: 'short' });
}

export default function EventStaffEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [note] = useState('');
  const [applied, setApplied] = useState(false);

  const { data: evData, isLoading } = useQuery({
    queryKey: ['event-public', id],
    queryFn: () => eventsApi.get(id!),
  });
  const event = evData?.data;

  const { data: appData } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => eventApplicationsApi.mine(),
  });
  const myApp = (appData?.data ?? []).find((a) => a.eventId === id && a.status === 'pending');

  const { mutate: apply, isPending: applying } = useMutation({
    mutationFn: () => eventApplicationsApi.apply(id!, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-applications'] });
      qc.invalidateQueries({ queryKey: ['available-events'] });
      setApplied(true);
    },
  });

  const { mutate: withdraw, isPending: withdrawing } = useMutation({
    mutationFn: () => eventApplicationsApi.withdraw(myApp!._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-applications'] });
      setApplied(false);
    },
  });

  if (isLoading || !event) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  const isApplied = !!myApp || applied;

  return (
    <Box>
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton size="small" onClick={() => navigate('/event-staff/events')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="subtitle1" fontWeight={700} noWrap flex={1}>{event.name}</Typography>
        </Stack>
      </Box>

      <Box sx={{ p: 2 }}>
        {isApplied && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {t('eventStaff.events.appliedSuccess')}
          </Alert>
        )}

        <Card elevation={1} sx={{ mb: 2, borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={700} mb={1}>{event.name}</Typography>
            <Stack spacing={0.75}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CalendarTodayIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                <Typography variant="body2">{fmtDate(event.startDate)}</Typography>
              </Stack>
              {event.venueName && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <LocationOnIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                  <Typography variant="body2">{event.venueName}</Typography>
                </Stack>
              )}
              {event.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {event.description}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Typography variant="subtitle2" fontWeight={700} mb={1}>{t('eventStaff.events.positionsSlots')}</Typography>
        <Stack spacing={1.5} mb={3}>
          {event.positions.map((pos) => (
            <Card key={pos._id} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: '12px !important' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.75}>
                  <Typography variant="body2" fontWeight={700}>{pos.title}</Typography>
                  <Stack direction="row" spacing={0.5}>
                    {pos.roleType && <Chip label={pos.roleType} size="small" color="primary" variant="outlined" sx={{ fontSize: 10 }} />}
                    <Stack direction="row" alignItems="center" spacing={0.3}>
                      <EuroIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                      <Typography variant="caption" fontWeight={600}>{pos.payRatePerHour}/h</Typography>
                    </Stack>
                  </Stack>
                </Stack>
                {pos.dresscode && (
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                    👔 {pos.dresscode}
                  </Typography>
                )}
                {pos.skills.length > 0 && (
                  <Stack direction="row" flexWrap="wrap" gap={0.4} mb={0.75}>
                    {pos.skills.map((s) => <Chip key={s} label={s} size="small" sx={{ fontSize: 10, height: 16 }} />)}
                  </Stack>
                )}
                <Divider sx={{ my: 0.75 }} />
                <Stack spacing={0.5}>
                  {pos.slots.map((slot) => (
                    <Stack key={slot._id} direction="row" alignItems="center" spacing={0.75}>
                      <AccessTimeIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                      <Typography variant="caption">
                        {new Date(slot.startTime).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                        {' · '}
                        {fmtTime(slot.startTime)} – {fmtTime(slot.endTime)}
                        {slot.breakMinutes > 0 && ` (${slot.breakMinutes}' ${t('timesheets.break')})`}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>

        {isApplied ? (
          <Button
            fullWidth variant="outlined" color="error" size="large"
            onClick={() => withdraw()} disabled={withdrawing}
          >
            {t('eventStaff.events.withdrawApplication')}
          </Button>
        ) : (
          <Button
            fullWidth variant="contained" size="large"
            onClick={() => apply()} disabled={applying}
          >
            {t('eventStaff.events.applyNow')}
          </Button>
        )}
      </Box>
    </Box>
  );
}
