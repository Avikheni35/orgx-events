import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, TextField, Button, Stack, MenuItem, Select, FormControl, InputLabel, Alert, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { eventClientsApi } from '../../../api/eventClients';

export default function AddClientPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '', type: 'company' as 'company' | 'individual', industry: '', vatId: '',
    paymentTermsDays: '30', notes: '',
    street: '', city: '', postalCode: '', country: 'DE',
  });
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const { mutate, isPending } = useMutation({
    mutationFn: () => eventClientsApi.create({
      name: form.name, type: form.type,
      industry: form.industry || undefined, vatId: form.vatId || undefined,
      paymentTermsDays: parseInt(form.paymentTermsDays),
      notes: form.notes || undefined,
      address: { street: form.street, city: form.city, postalCode: form.postalCode, country: form.country },
    }),
    onSuccess: (res) => navigate(`/coordinator/clients/${res.data._id}`),
    onError: () => setError(t('clients.createError')),
  });

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('clients.new')}</Typography>
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
                  <InputLabel>{t('clients.type')}</InputLabel>
                  <Select value={form.type} label={t('clients.type')} onChange={(e) => set('type', e.target.value)}>
                    <MenuItem value="company">{t('clients.company')}</MenuItem>
                    <MenuItem value="individual">{t('clients.individual')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={t('clients.industry')} value={form.industry} onChange={(e) => set('industry', e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label={t('clients.vatId')} value={form.vatId} onChange={(e) => set('vatId', e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label={t('clients.paymentTermsDays')} type="number" value={form.paymentTermsDays} onChange={(e) => set('paymentTermsDays', e.target.value)} fullWidth inputProps={{ min: 0 }} />
              </Grid>
            </Grid>

            <Typography variant="subtitle2" color="text.secondary">{t('clients.address')}</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField label={t('clients.street')} value={form.street} onChange={(e) => set('street', e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField label={t('clients.postalCode')} value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField label={t('clients.city')} value={form.city} onChange={(e) => set('city', e.target.value)} fullWidth />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField label={t('clients.country')} value={form.country} onChange={(e) => set('country', e.target.value)} fullWidth />
              </Grid>
            </Grid>

            <TextField label={t('common.notes')} value={form.notes} onChange={(e) => set('notes', e.target.value)} fullWidth multiline rows={3} />

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
              <Button variant="contained" onClick={() => mutate()} disabled={isPending || !form.name}>
                {t('clients.createTitle')}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
