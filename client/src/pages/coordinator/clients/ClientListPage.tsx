import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Card, Table, TableHead, TableRow, TableCell, TableBody, Chip, Stack, TablePagination } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { eventClientsApi } from '../../../api/eventClients';
import { useState } from 'react';

export default function ClientListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const { data, isLoading } = useQuery({
    queryKey: ['event-clients', page],
    queryFn: () => eventClientsApi.list({ page: String(page + 1), limit: '20' }),
  });
  const clients = data?.data?.clients ?? [];
  const total = data?.data?.total ?? 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('clients.title')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/coordinator/clients/new')}>{t('clients.new')}</Button>
      </Stack>
      <Card>
        <Table>
          <TableHead><TableRow>
            <TableCell>{t('common.name')}</TableCell>
            <TableCell>{t('clients.type')}</TableCell>
            <TableCell>{t('clients.industry')}</TableCell>
            <TableCell>{t('clients.contacts')}</TableCell>
            <TableCell>{t('clients.paymentTermsDays')}</TableCell>
            <TableCell>{t('common.status')}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} align="center">{t('common.loading')}</TableCell></TableRow>}
            {!isLoading && clients.length === 0 && <TableRow><TableCell colSpan={6} align="center">{t('clients.noClients')}</TableCell></TableRow>}
            {clients.map((c) => (
              <TableRow key={c._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/coordinator/clients/${c._id}`)}>
                <TableCell><Typography fontWeight={600}>{c.name}</Typography></TableCell>
                <TableCell>{c.type === 'company' ? t('clients.company') : t('clients.individual')}</TableCell>
                <TableCell>{c.industry ?? '—'}</TableCell>
                <TableCell>{c.contacts.length}</TableCell>
                <TableCell>{t('clients.paymentTermsValue', { count: c.paymentTermsDays })}</TableCell>
                <TableCell><Chip label={c.status === 'active' ? t('status.active') : t('status.inactive')} color={c.status === 'active' ? 'success' : 'default'} size="small" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination component="div" count={total} page={page} rowsPerPage={20} onPageChange={(_, p) => setPage(p)} rowsPerPageOptions={[20]} />
      </Card>
    </Box>
  );
}
