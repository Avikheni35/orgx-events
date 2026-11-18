import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, Button, Stack, Alert, MenuItem, Select, FormControl, InputLabel, Checkbox, Table, TableHead, TableRow, TableCell, TableBody, TextField, Grid } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '../../../api/invoices';
import { timesheetsApi } from '../../../api/timesheets';
import { eventClientsApi } from '../../../api/eventClients';

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [clientId, setClientId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [vatRate, setVatRate] = useState('19');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { data: clients } = useQuery({ queryKey: ['event-clients'], queryFn: () => eventClientsApi.list({ limit: '100' }) });
  const { data: tsData } = useQuery({
    queryKey: ['timesheets-approved', clientId],
    queryFn: () => timesheetsApi.list({ status: 'approved', clientId, limit: '100' }),
    enabled: !!clientId,
  });
  const timesheets = tsData?.data?.timesheets ?? [];

  const toggle = (id: string) =>
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleAll = () =>
    setSelectedIds(selectedIds.length === timesheets.length ? [] : timesheets.map((ts) => ts._id));

  const { mutate, isPending } = useMutation({
    mutationFn: () => invoicesApi.create({ clientId, timesheetIds: selectedIds, invoiceDate, dueDate, vatRate: parseFloat(vatRate), notes: notes || undefined }),
    onSuccess: (res) => navigate(`/coordinator/invoices/${res.data._id}`),
    onError: () => setError(t('invoices.createError')),
  });

  const selectedTimesheets = timesheets.filter((ts) => selectedIds.includes(ts._id));
  const subtotal = selectedTimesheets.reduce((sum, ts) => sum + ts.grossPay, 0);
  const vat = subtotal * parseFloat(vatRate || '0') / 100;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('invoices.new')}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack spacing={3}>
        <Card><CardContent>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>{t('invoices.selectClient')}</Typography>
          <FormControl fullWidth>
            <InputLabel>{t('events.client')} *</InputLabel>
            <Select value={clientId} label={`${t('events.client')} *`} onChange={(e) => { setClientId(e.target.value as string); setSelectedIds([]); }}>
              {clients?.data?.clients?.map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
        </CardContent></Card>

        {clientId && (
          <Card><CardContent>
            <Typography variant="subtitle1" fontWeight={600} mb={2}>{t('invoices.selectTimesheets')}</Typography>
            {timesheets.length === 0 ? (
              <Typography color="text.secondary">{t('invoices.noApprovedTimesheets')}</Typography>
            ) : (
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell padding="checkbox"><Checkbox checked={selectedIds.length === timesheets.length} indeterminate={selectedIds.length > 0 && selectedIds.length < timesheets.length} onChange={toggleAll} /></TableCell>
                  <TableCell>{t('events.title')}</TableCell>
                  <TableCell>{t('timesheets.employee')}</TableCell>
                  <TableCell>{t('timesheets.position')}</TableCell>
                  <TableCell align="right">{t('invoices.hours')}</TableCell>
                  <TableCell align="right">{t('timesheets.gross')}</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {timesheets.map((ts) => (
                    <TableRow key={ts._id} selected={selectedIds.includes(ts._id)}>
                      <TableCell padding="checkbox"><Checkbox checked={selectedIds.includes(ts._id)} onChange={() => toggle(ts._id)} /></TableCell>
                      <TableCell>{ts.eventName}</TableCell>
                      <TableCell>{ts.staffName}</TableCell>
                      <TableCell>{ts.positionTitle}</TableCell>
                      <TableCell align="right">{ts.totalHours.toFixed(2)}</TableCell>
                      <TableCell align="right">€ {ts.grossPay.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        )}

        <Card><CardContent>
          <Typography variant="subtitle1" fontWeight={600} mb={2}>{t('invoices.invoiceDetails')}</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField label={t('invoices.invoiceDateLabel')} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label={t('invoices.dueDateLabel')} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label={t('invoices.vatPercent')} type="number" value={vatRate} onChange={(e) => setVatRate(e.target.value)} fullWidth inputProps={{ min: 0, max: 100 }} />
            </Grid>
            <Grid item xs={12}>
              <TextField label={t('common.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline rows={2} />
            </Grid>
          </Grid>
        </CardContent></Card>

        {selectedIds.length > 0 && (
          <Card sx={{ bgcolor: 'action.hover' }}><CardContent>
            <Stack direction="row" justifyContent="space-between">
              <Typography>{t('invoices.net')}</Typography>
              <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {subtotal.toFixed(2)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography>{t('invoices.vatAmount', { rate: vatRate })}</Typography>
              <Typography sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {vat.toFixed(2)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography fontWeight={700}>{t('invoices.totalLabel')}</Typography>
              <Typography fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {(subtotal + vat).toFixed(2)}</Typography>
            </Stack>
          </CardContent></Card>
        )}

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button variant="outlined" onClick={() => navigate(-1)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => mutate()}
            disabled={isPending || !clientId || selectedIds.length === 0 || !invoiceDate || !dueDate}>
            {t('invoices.createTitle')}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
