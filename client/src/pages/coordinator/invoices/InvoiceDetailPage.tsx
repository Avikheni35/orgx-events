import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, Chip, Stack, Button, Table, TableHead, TableRow, TableCell, TableBody, Divider, Alert } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoicesApi, type EventInvoice } from '../../../api/invoices';

const STATUS_COLORS: Record<EventInvoice['status'], 'default' | 'primary' | 'success' | 'error'> = {
  draft: 'default', sent: 'primary', paid: 'success', cancelled: 'error',
};

const STATUS_TRANSITIONS: Partial<Record<EventInvoice['status'], EventInvoice['status']>> = {
  draft: 'sent', sent: 'paid',
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [error, setError] = useState('');

  const STATUS_LABELS: Record<EventInvoice['status'], string> = {
    draft: t('status.draft'), sent: t('status.sent'), paid: t('status.paid'), cancelled: t('status.cancelled'),
  };

  const { data, isLoading } = useQuery({ queryKey: ['invoice', id], queryFn: () => invoicesApi.get(id!) });
  const invoice = data?.data;

  const { mutate: advance } = useMutation({
    mutationFn: (status: string) => invoicesApi.setStatus(id!, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice', id] }),
    onError: () => setError(t('invoices.statusFailed')),
  });

  if (isLoading || !invoice) return <Box sx={{ p: 3 }}>{t('common.loading')}</Box>;

  const nextStatus = STATUS_TRANSITIONS[invoice.status];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{invoice.invoiceNumber}</Typography>
            <Chip label={STATUS_LABELS[invoice.status]} color={STATUS_COLORS[invoice.status]} size="small" />
          </Stack>
          <Typography variant="h5" fontWeight={700}>{invoice.clientName}</Typography>
          {invoice.eventName && <Typography color="text.secondary">{t('invoices.event')} {invoice.eventName}</Typography>}
        </Box>
        <Stack direction="row" spacing={1}>
          {nextStatus && (
            <Button variant="contained" onClick={() => advance(nextStatus)}>→ {STATUS_LABELS[nextStatus]}</Button>
          )}
          {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
            <Button variant="outlined" color="error" onClick={() => advance('cancelled')}>{t('invoices.cancelAction')}</Button>
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Stack spacing={3}>
        <Card><CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4}>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('invoices.invoiceDate')}</Typography>
              <Typography fontWeight={600}>{new Date(invoice.invoiceDate).toLocaleDateString('de-DE')}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('invoices.dueDate')}</Typography>
              <Typography fontWeight={600}>{new Date(invoice.dueDate).toLocaleDateString('de-DE')}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('invoices.agencyLabel')}</Typography>
              <Typography fontWeight={600}>{invoice.agencyName}</Typography>
            </Box>
          </Stack>
        </CardContent></Card>

        <Card>
          <Table>
            <TableHead><TableRow>
              <TableCell>{t('invoices.descriptionLabel')}</TableCell>
              <TableCell align="right">{t('invoices.hours')}</TableCell>
              <TableCell align="right">{t('invoices.hourlyRate')}</TableCell>
              <TableCell align="right">{t('invoices.amountLabel')}</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {invoice.lineItems.map((li, i) => (
                <TableRow key={i}>
                  <TableCell>{li.description}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{li.hours.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {li.ratePerHour.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {li.amount.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box sx={{ p: 2, maxWidth: 320, ml: 'auto' }}>
            <Divider sx={{ mb: 1 }} />
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography variant="body2">{t('invoices.net')}</Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {invoice.subtotal.toFixed(2)}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography variant="body2">{t('invoices.vatAmount', { rate: invoice.vatRate })}</Typography>
              <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {invoice.vatAmount.toFixed(2)}</Typography>
            </Stack>
            <Divider sx={{ my: 0.5 }} />
            <Stack direction="row" justifyContent="space-between">
              <Typography fontWeight={700}>{t('invoices.totalLabel')}</Typography>
              <Typography fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {invoice.total.toFixed(2)}</Typography>
            </Stack>
          </Box>
        </Card>

        {invoice.notes && (
          <Card><CardContent>
            <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('common.notes')}</Typography>
            <Typography>{invoice.notes}</Typography>
          </CardContent></Card>
        )}
      </Stack>
    </Box>
  );
}
