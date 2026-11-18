import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, TextField, Button, Stack, MenuItem, Select, FormControl, InputLabel, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { eventsApi } from '../../../api/events';
import { eventClientsApi } from '../../../api/eventClients';
import { venuesApi } from '../../../api/venues';

const EVENT_TYPES = ['conference', 'concert', 'corporate', 'wedding', 'trade_show', 'festival', 'sports', 'other'];

export default function CreateEventPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', clientId: '', venueId: '', type: 'corporate', startDate: '', endDate: '', description: '', budget: '' });
  const [error, setError] = useState('');

  const { data: clients } = useQuery({ queryKey: ['event-clients'], queryFn: () => eventClientsApi.list({ limit: '100' }) });
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: () => venuesApi.list({ limit: '100' }) });

  const { mutate, isPending } = useMutation({
    mutationFn: () => eventsApi.create({
      name: form.name, clientId: form.clientId,
      venueId: form.venueId || undefined, type: form.type as never,
      startDate: new Date(form.startDate) as never,
      endDate: new Date(form.endDate) as never,
      description: form.description || undefined,
      budget: form.budget ? parseFloat(form.budget) : undefined,
    }),
    onSuccess: (res) => navigate(`/coordinator/events/${res.data._id}`),
    onError: () => setError(t('errors.createEvent')),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('events.new')}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={3}>
            <TextField label={`${t('events.name')} *`} value={form.name} onChange={(e) => set('name', e.target.value)} fullWidth />
            <FormControl fullWidth>
              <InputLabel>{t('events.client')} *</InputLabel>
              <Select value={form.clientId} label={`${t('events.client')} *`} onChange={(e) => set('clientId', e.target.value as string)}>
                {clients?.data?.clients?.map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>{t('events.venueOptional')}</InputLabel>
              <Select value={form.venueId} label={t('events.venueOptional')} onChange={(e) => set('venueId', e.target.value as string)}>
                <MenuItem value="">{t('venues.noVenueOption')}</MenuItem>
                {venues?.data?.venues?.map((v) => <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>{t('events.type')}</InputLabel>
              <Select value={form.type} label={t('events.type')} onChange={(e) => set('type', e.target.value as string)}>
                {EVENT_TYPES.map((et) => <MenuItem key={et} value={et}>{t(`templates.types.${et}`, { defaultValue: et })}</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label={t('events.startDateLabel')} type="datetime-local" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
              <TextField label={t('events.endDateLabel')} type="datetime-local" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
            </Stack>
            <TextField label={t('common.description')} value={form.description} onChange={(e) => set('description', e.target.value)} fullWidth multiline rows={3} />
            <TextField label={t('events.budget')} type="number" value={form.budget} onChange={(e) => set('budget', e.target.value)} fullWidth />
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
              <Button variant="contained" onClick={() => mutate()} disabled={isPending || !form.name || !form.clientId || !form.startDate || !form.endDate}>
                {t('events.createTitle')}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
