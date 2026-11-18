import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button, Card, Table, TableHead, TableRow, TableCell, TableBody, Chip, Stack, TablePagination, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { invoicesApi, type EventInvoice } from '../../../api/invoices';

const STATUS_COLORS: Record<EventInvoice['status'], 'default' | 'primary' | 'success' | 'error'> = {
  draft: 'default', sent: 'primary', paid: 'success', cancelled: 'error',
};

type SyncStatus = 'not_configured' | 'pending' | 'synced' | 'failed';
const SYNC_COLOR: Record<SyncStatus, 'default' | 'info' | 'success' | 'error'> = {
  not_configured: 'default', pending: 'info', synced: 'success', failed: 'error',
};
const SYNC_LABEL: Record<SyncStatus, string> = {
  not_configured: '', pending: 'ERP: Ausstehend', synced: 'ERP ✓', failed: 'ERP Fehler',
};

export default function InvoiceListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, status],
    queryFn: () => invoicesApi.list({ page: String(page + 1), limit: '20', ...(status ? { status } : {}) }),
  });
  const invoices = data?.data?.invoices ?? [];
  const total = data?.data?.total ?? 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('invoices.title')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/coordinator/invoices/new')}>{t('invoices.new')}</Button>
      </Stack>
      <Card sx={{ mb: 2, p: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <MenuItem value="">{t('common.all')}</MenuItem>
            <MenuItem value="draft">{t('invoices.draft')}</MenuItem>
            <MenuItem value="sent">{t('invoices.sent')}</MenuItem>
            <MenuItem value="paid">{t('invoices.paid')}</MenuItem>
            <MenuItem value="cancelled">{t('invoices.cancelled')}</MenuItem>
          </Select>
        </FormControl>
      </Card>
      <Card>
        <Table>
          <TableHead><TableRow>
            <TableCell>{t('invoices.invoiceNumber')}</TableCell>
            <TableCell>Client</TableCell>
            <TableCell>{t('invoices.invoiceDate')}</TableCell>
            <TableCell>{t('invoices.dueDate')}</TableCell>
            <TableCell align="right">{t('invoices.subtotal')}</TableCell>
            <TableCell align="right">{t('invoices.total')}</TableCell>
            <TableCell>{t('common.status')}</TableCell>
            <TableCell>{t('timesheets.accounting')}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} align="center">{t('common.loading')}</TableCell></TableRow>}
            {!isLoading && invoices.length === 0 && <TableRow><TableCell colSpan={8} align="center">{t('invoices.noInvoices')}</TableCell></TableRow>}
            {invoices.map((inv) => (
              <TableRow key={inv._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/coordinator/invoices/${inv._id}`)}>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{inv.invoiceNumber}</TableCell>
                <TableCell>{inv.clientName}</TableCell>
                <TableCell>{new Date(inv.invoiceDate).toLocaleDateString('de-DE')}</TableCell>
                <TableCell>{new Date(inv.dueDate).toLocaleDateString('de-DE')}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {inv.subtotal.toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>€ {inv.total.toFixed(2)}</TableCell>
                <TableCell><Chip label={inv.status} color={STATUS_COLORS[inv.status]} size="small" /></TableCell>
                <TableCell>
                  {inv.syncStatus && inv.syncStatus !== 'not_configured' && (
                    <Chip label={SYNC_LABEL[inv.syncStatus]} color={SYNC_COLOR[inv.syncStatus]} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination component="div" count={total} page={page} rowsPerPage={20} onPageChange={(_, p) => setPage(p)} rowsPerPageOptions={[20]} />
      </Card>
    </Box>
  );
}
