import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Card, Table, TableHead, TableRow, TableCell, TableBody, Chip, Stack, TablePagination, Button, MenuItem, Select, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Link } from '@mui/material';
import { timesheetsApi, type EventTimesheet } from '../../../api/timesheets';

const STATUS_COLORS: Record<EventTimesheet['status'], 'default' | 'warning' | 'success' | 'error'> = {
  pending: 'warning', approved: 'success', disputed: 'error',
};

type SyncStatus = 'not_configured' | 'pending' | 'synced' | 'failed';
const SYNC_COLOR: Record<SyncStatus, 'default' | 'info' | 'success' | 'error'> = {
  not_configured: 'default', pending: 'info', synced: 'success', failed: 'error',
};
const SYNC_LABEL: Record<SyncStatus, string> = {
  not_configured: '', pending: 'Wird gebucht…', synced: 'Gebucht ✓', failed: 'Fehler',
};

function SyncChip({ status }: { status?: SyncStatus }) {
  if (!status || status === 'not_configured') return null;
  return <Chip label={SYNC_LABEL[status]} color={SYNC_COLOR[status]} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />;
}

export default function TimesheetsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('pending');
  const [disputeId, setDisputeId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['timesheets', page, status],
    queryFn: () => timesheetsApi.list({ page: String(page + 1), limit: '20', ...(status ? { status } : {}) }),
  });
  const timesheets = data?.data?.timesheets ?? [];
  const total = data?.data?.total ?? 0;

  const { mutate: approve } = useMutation({
    mutationFn: (id: string) => timesheetsApi.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timesheets'] }),
    onError: () => setError('Genehmigung fehlgeschlagen.'),
  });

  const { mutate: dispute, isPending: disputing } = useMutation({
    mutationFn: () => timesheetsApi.dispute(disputeId, reason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['timesheets'] }); setDisputeId(''); setReason(''); },
    onError: () => setError('Einspruch fehlgeschlagen.'),
  });

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('timesheets.title')}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Card sx={{ mb: 2, p: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <MenuItem value="">{t('common.all')}</MenuItem>
            <MenuItem value="pending">{t('status.open')}</MenuItem>
            <MenuItem value="approved">{t('status.approved')}</MenuItem>
            <MenuItem value="disputed">{t('timesheets.dispute')}</MenuItem>
          </Select>
        </FormControl>
      </Card>
      <Card>
        <Table>
          <TableHead><TableRow>
            <TableCell>{t('nav.events')}</TableCell>
            <TableCell>{t('nav.staff')}</TableCell>
            <TableCell>{t('timesheets.position')}</TableCell>
            <TableCell>{t('timesheets.planned')}</TableCell>
            <TableCell align="right">{t('timesheets.hours')}</TableCell>
            <TableCell align="right">{t('timesheets.gross')}</TableCell>
            <TableCell>{t('common.status')}</TableCell>
            <TableCell>{t('timesheets.accounting')}</TableCell>
            <TableCell />
          </TableRow></TableHead>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={9} align="center">{t('common.loading')}</TableCell></TableRow>}
            {!isLoading && timesheets.length === 0 && <TableRow><TableCell colSpan={9} align="center">{t('timesheets.noTimesheets')}</TableCell></TableRow>}
            {timesheets.map((ts) => (
              <TableRow key={ts._id}>
                <TableCell>
                  <Link
                    component="button"
                    variant="body2"
                    fontWeight={600}
                    underline="hover"
                    onClick={() => navigate(`/coordinator/events/${ts.eventId}/timesheet`)}
                  >
                    {ts.eventName}
                  </Link>
                </TableCell>
                <TableCell>{ts.staffName}</TableCell>
                <TableCell>{ts.positionTitle}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>
                  {new Date(ts.plannedStartTime).toLocaleDateString('de-DE')}<br />
                  {new Date(ts.plannedStartTime).toLocaleTimeString('de-DE', { timeStyle: 'short' })} – {new Date(ts.plannedEndTime).toLocaleTimeString('de-DE', { timeStyle: 'short' })}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{ts.totalHours.toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {ts.grossPay.toFixed(2)}</TableCell>
                <TableCell><Chip label={ts.status} color={STATUS_COLORS[ts.status]} size="small" /></TableCell>
                <TableCell><SyncChip status={ts.syncStatus} /></TableCell>
                <TableCell>
                  {ts.status === 'pending' && (
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" variant="contained" color="success" onClick={() => approve(ts._id)}>{t('timesheets.approve')}</Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => setDisputeId(ts._id)}>{t('timesheets.dispute')}</Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination component="div" count={total} page={page} rowsPerPage={20} onPageChange={(_, p) => setPage(p)} rowsPerPageOptions={[20]} />
      </Card>

      <Dialog open={!!disputeId} onClose={() => setDisputeId('')} maxWidth="sm" fullWidth>
        <DialogTitle>{t('timesheets.disputeTitle')}</DialogTitle>
        <DialogContent>
          <TextField label={t('timesheets.disputeReason')} value={reason} onChange={(e) => setReason(e.target.value)} fullWidth multiline rows={3} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisputeId('')}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" onClick={() => dispute()} disabled={disputing || !reason.trim()}>{t('timesheets.submitDispute')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
