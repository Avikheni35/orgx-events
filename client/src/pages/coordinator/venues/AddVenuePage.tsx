import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, TextField, Button, Stack, MenuItem, Select, FormControl, InputLabel, Alert, Grid, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { venuesApi } from '../../../api/venues';

const VENUE_TYPES = ['indoor', 'outdoor', 'hybrid'] as const;

export default function AddVenuePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const COMMON_FACILITIES = [t('venues.facilityStage'), t('venues.facilityCatering'), t('venues.facilityParking'), t('venues.facilityWardrobe'), t('venues.facilitySoundLight'), t('venues.facilityProjector'), t('venues.facilityWifi'), t('venues.facilityAC'), t('venues.facilityAccessibility')];
  const [form, setForm] = useState({ name: '', type: 'indoor' as typeof VENUE_TYPES[number], capacity: '', notes: '', street: '', city: '', postalCode: '', country: 'DE' });
  const [facilities, setFacilities] = useState<string[]>([]);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const toggleFacility = (f: string) =>
    setFacilities((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  const { mutate, isPending } = useMutation({
    mutationFn: () => venuesApi.create({
      name: form.name, type: form.type,
      capacity: form.capacity ? parseInt(form.capacity) : undefined,
      notes: form.notes || undefined, facilities,
      address: { street: form.street, city: form.city, postalCode: form.postalCode, country: form.country },
    }),
    onSuccess: (res) => navigate(`/coordinator/venues/${res.data._id}`),
    onError: () => setError(t('venues.createError')),
  });

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('venues.new')}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField label={`${t('common.name')} *`} value={form.name} onChange={(e) => set('name', e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>{t('venues.type')}</InputLabel>
                  <Select value={form.type} label={t('venues.type')} onChange={(e) => set('type', e.target.value)}>
                    {VENUE_TYPES.map((vt) => <MenuItem key={vt} value={vt}>{vt}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label={t('venues.capacity')} type="number" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} fullWidth inputProps={{ min: 1 }} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" color="text.secondary">{t('clients.address')}</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField label={t('clients.street')} value={form.street} onChange={(e) => set('street', e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={4}>
                <TextField label={t('clients.postalCode')} value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={5}>
                <TextField label={t('clients.city')} value={form.city} onChange={(e) => set('city', e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={3}>
                <TextField label={t('clients.country')} value={form.country} onChange={(e) => set('country', e.target.value)} fullWidth />
              </Grid>
            </Grid>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('venues.facilities')}</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {COMMON_FACILITIES.map((f) => (
                  <Chip key={f} label={f} clickable onClick={() => toggleFacility(f)}
                    color={facilities.includes(f) ? 'primary' : 'default'} variant={facilities.includes(f) ? 'filled' : 'outlined'} />
                ))}
              </Stack>
            </Box>

            <TextField label={t('common.notes')} value={form.notes} onChange={(e) => set('notes', e.target.value)} fullWidth multiline rows={3} />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
              <Button variant="contained" onClick={() => mutate()} disabled={isPending || !form.name}>
                {t('venues.createTitle')}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
