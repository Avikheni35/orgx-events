import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Card, Table, TableHead, TableRow, TableCell, TableBody, Chip, TablePagination } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { eventClientPortalApi } from '../../api/eventClientPortal';

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'error'> = {
  draft: 'default', sent: 'primary', paid: 'success', cancelled: 'error',
};

export default function EventClientInvoicesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [page, setPage] = useState(0);

  const STATUS_LABELS: Record<string, string> = {
    draft: t('status.draft'),
    sent: t('status.sent'),
    paid: t('status.paid'),
    cancelled: t('status.cancelled'),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['ec-invoices', page],
    queryFn: () => eventClientPortalApi.listInvoices({ page: String(page + 1), limit: '20' }),
  });
  const invoices = data?.data?.invoices ?? [];
  const total = data?.data?.total ?? 0;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('eventClient.myInvoices')}</Typography>
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('eventClient.invoiceNr')}</TableCell>
              <TableCell>Event</TableCell>
              <TableCell>{t('eventClient.invoiceDate')}</TableCell>
              <TableCell>{t('eventClient.dueOn')}</TableCell>
              <TableCell align="right">{t('eventClient.amount')}</TableCell>
              <TableCell>{t('common.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} align="center">{t('common.loading')}</TableCell></TableRow>}
            {!isLoading && invoices.length === 0 && <TableRow><TableCell colSpan={6} align="center">{t('eventClient.noInvoices')}</TableCell></TableRow>}
            {invoices.map((inv) => (
              <TableRow key={inv._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/event-client/invoices/${inv._id}`)}>
                <TableCell><Typography fontWeight={600} sx={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</Typography></TableCell>
                <TableCell>{inv.eventName ?? '—'}</TableCell>
                <TableCell>{new Date(inv.invoiceDate).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(inv.dueDate).toLocaleDateString()}</TableCell>
                <TableCell align="right"><Typography fontWeight={600}>€{inv.total.toFixed(2)}</Typography></TableCell>
                <TableCell><Chip label={STATUS_LABELS[inv.status] ?? inv.status} color={STATUS_COLORS[inv.status] ?? 'default'} size="small" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination component="div" count={total} page={page} rowsPerPage={20} onPageChange={(_, p) => setPage(p)} rowsPerPageOptions={[20]} />
      </Card>
    </Box>
  );
}
