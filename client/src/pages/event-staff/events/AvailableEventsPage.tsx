import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Stack, Card, CardContent, Chip, Button,
  CircularProgress, TextField, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PeopleIcon from '@mui/icons-material/People';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { eventApplicationsApi } from '../../../api/eventApplications';
import type { Event } from '../../../api/events';

export default function AvailableEventsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const STATUS_LABEL: Record<string, { label: string; color: 'warning' | 'info' | 'success' }> = {
    planning:  { label: t('eventClient.statusLabels.planning'),  color: 'warning' },
    staffing:  { label: t('eventClient.statusLabels.staffing'),  color: 'info' },
    confirmed: { label: t('eventClient.statusLabels.confirmed'), color: 'success' },
  };

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['available-events'],
    queryFn: () => eventApplicationsApi.availableEvents(),
  });
  const events: Event[] = (eventsData?.data as Event[]) ?? [];

  const { data: appData } = useQuery({
    queryKey: ['my-applications'],
    queryFn: () => eventApplicationsApi.mine(),
  });
  const appliedEventIds = new Set((appData?.data ?? []).filter((a) => a.status === 'pending').map((a) => a.eventId));

  const { mutate: apply, isPending: applying } = useMutation({
    mutationFn: (eventId: string) => eventApplicationsApi.apply(eventId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-applications'] }); qc.invalidateQueries({ queryKey: ['available-events'] }); },
  });

  const { mutate: withdraw } = useMutation({
    mutationFn: (appId: string) => eventApplicationsApi.withdraw(appId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-applications'] }); },
  });

  const filtered = events.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.venueName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={700} mb={2}>{t('availableEvents.title')}</Typography>

      <TextField
        fullWidth size="small" placeholder={t('availableEvents.searchPlaceholder')}
        value={search} onChange={(e) => setSearch(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        sx={{ mb: 2 }}
      />

      {isLoading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}

      {!isLoading && filtered.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CalendarTodayIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
          <Typography color="text.secondary" mt={1}>{t('availableEvents.noAvailableEvents')}</Typography>
        </Box>
      )}

      <Stack spacing={1.5}>
        {filtered.map((ev) => {
          const statusCfg = STATUS_LABEL[ev.status] ?? { label: ev.status, color: 'default' as const };
          const hasApplied = appliedEventIds.has(ev._id);
          const app = (appData?.data ?? []).find((a) => a.eventId === ev._id && a.status === 'pending');
          const totalSlots = ev.positions.reduce((s, p) => s + p.slots.length * p.headcount, 0);

          return (
            <Card key={ev._id} elevation={1} sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: '14px !important' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={0.75}>
                  <Typography variant="body1" fontWeight={700} flex={1} noWrap pr={1}>{ev.name}</Typography>
                  <Chip label={statusCfg.label} color={statusCfg.color} size="small" sx={{ fontSize: 10, height: 18, flexShrink: 0 }} />
                </Stack>

                <Stack spacing={0.4} mb={1}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <CalendarTodayIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(ev.startDate).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })}
                      {' – '}
                      {new Date(ev.endDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </Typography>
                  </Stack>
                  {ev.venueName && (
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <LocationOnIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">{ev.venueName}</Typography>
                    </Stack>
                  )}
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <PeopleIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {t('availableEvents.positionCount', { count: ev.positions.length })} · {t('availableEvents.slotsCount', { count: totalSlots })}
                    </Typography>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1}>
                  <Button
                    size="small" variant="outlined" onClick={() => navigate(`/event-staff/events/${ev._id}`)}
                    sx={{ flex: 1 }}
                  >
                    {t('availableEvents.details')}
                  </Button>
                  {hasApplied ? (
                    <Button
                      size="small" variant="outlined" color="error"
                      onClick={() => app && withdraw(app._id)}
                      sx={{ flex: 1 }}
                    >
                      {t('availableEvents.withdraw')}
                    </Button>
                  ) : (
                    <Button
                      size="small" variant="contained"
                      onClick={() => apply(ev._id)}
                      disabled={applying}
                      sx={{ flex: 1 }}
                    >
                      {t('availableEvents.apply')}
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
