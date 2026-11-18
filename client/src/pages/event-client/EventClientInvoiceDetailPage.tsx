import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, Chip, Stack, Divider, Alert, IconButton, Button,
  Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import { useTranslation } from 'react-i18next';
import { eventClientPortalApi } from '../../api/eventClientPortal';

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'success' | 'error'> = {
  draft: 'default', sent: 'primary', paid: 'success', cancelled: 'error',
};

export default function EventClientInvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const STATUS_LABELS: Record<string, string> = {
    draft: t('status.draft'),
    sent: t('status.sent'),
    paid: t('status.paid'),
    cancelled: t('status.cancelled'),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['ec-invoice', invoiceId],
    queryFn: () => eventClientPortalApi.getInvoice(invoiceId!),
    enabled: !!invoiceId,
  });
  const invoice = data?.data;

  const handleDownloadPdf = async () => {
    try {
      const res = await eventClientPortalApi.downloadInvoicePdf(invoiceId!);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rechnung-${invoice?.invoiceNumber ?? invoiceId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    }
  };

  if (isLoading) return <Box sx={{ p: 3 }}>{t('common.loading')}</Box>;
  if (error || !invoice) return <Box sx={{ p: 3 }}><Alert severity="error">{t('eventClient.invoiceNotFound')}</Alert></Box>;

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" mb={3}>
        <IconButton onClick={() => navigate('/event-client/invoices')} size="small"><ArrowBackIcon /></IconButton>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h5" fontWeight={700} sx={{ fontFamily: 'monospace' }}>{invoice.invoiceNumber}</Typography>
            <Chip label={STATUS_LABELS[invoice.status] ?? invoice.status} color={STATUS_COLORS[invoice.status] ?? 'default'} size="small" />
          </Stack>
          <Typography variant="body2" color="text.secondary">{invoice.clientName}</Typography>
        </Box>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadPdf}>PDF</Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={4} flexWrap="wrap" rowGap={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('eventClient.issuer')}</Typography>
              <Typography variant="body2" fontWeight={600}>{invoice.agencyName}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('eventClient.invoiceDate')}</Typography>
              <Typography variant="body2">{new Date(invoice.invoiceDate).toLocaleDateString()}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('eventClient.dueDate')}</Typography>
              <Typography variant="body2">{new Date(invoice.dueDate).toLocaleDateString()}</Typography>
            </Box>
            {invoice.eventName && (
              <Box>
                <Typography variant="caption" color="text.secondary">Event</Typography>
                <Typography variant="body2">{invoice.eventName}</Typography>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('common.description')}</TableCell>
              <TableCell align="right">{t('eventClient.hours')}</TableCell>
              <TableCell align="right">{t('eventClient.ratePerHour')}</TableCell>
              <TableCell align="right">{t('eventClient.amount')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoice.lineItems.map((li, i) => (
              <TableRow key={i}>
                <TableCell>{li.description}</TableCell>
                <TableCell align="right">{li.hours.toFixed(2)}</TableCell>
                <TableCell align="right">€{li.ratePerHour.toFixed(2)}</TableCell>
                <TableCell align="right">€{li.amount.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ p: 2 }}>
          <Stack alignItems="flex-end" spacing={0.5}>
            <Stack direction="row" spacing={4}>
              <Typography variant="body2">{t('eventClient.subtotal')}</Typography>
              <Typography variant="body2">€{invoice.subtotal.toFixed(2)}</Typography>
            </Stack>
            <Stack direction="row" spacing={4}>
              <Typography variant="body2">{t('eventClient.vatLabel', { rate: invoice.vatRate })}</Typography>
              <Typography variant="body2">€{invoice.vatAmount.toFixed(2)}</Typography>
            </Stack>
            <Divider sx={{ width: 200, my: 0.5 }} />
            <Stack direction="row" spacing={4}>
              <Typography variant="body1" fontWeight={700}>{t('eventClient.total')}</Typography>
              <Typography variant="body1" fontWeight={700}>€{invoice.total.toFixed(2)}</Typography>
            </Stack>
          </Stack>
        </Box>
      </Card>

      {invoice.notes && (
        <Card>
          <CardContent>
            <Typography variant="caption" color="text.secondary">{t('common.notes')}</Typography>
            <Typography variant="body2">{invoice.notes}</Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
