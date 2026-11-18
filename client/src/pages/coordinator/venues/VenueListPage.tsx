import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Card, Table, TableHead, TableRow, TableCell, TableBody, Chip, Stack, TablePagination } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTranslation } from 'react-i18next';
import { venuesApi } from '../../../api/venues';

export default function VenueListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const { data, isLoading } = useQuery({
    queryKey: ['venues', page],
    queryFn: () => venuesApi.list({ page: String(page + 1), limit: '20' }),
  });
  const venues = data?.data?.venues ?? [];
  const total = data?.data?.total ?? 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('venues.title')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/coordinator/venues/new')}>{t('venues.new')}</Button>
      </Stack>
      <Card>
        <Table>
          <TableHead><TableRow>
            <TableCell>{t('common.name')}</TableCell>
            <TableCell>{t('venues.type')}</TableCell>
            <TableCell>{t('clients.city')}</TableCell>
            <TableCell align="right">{t('venues.capacity')}</TableCell>
            <TableCell>{t('common.status')}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} align="center">{t('common.loading')}</TableCell></TableRow>}
            {!isLoading && venues.length === 0 && <TableRow><TableCell colSpan={5} align="center">{t('venues.noVenues')}</TableCell></TableRow>}
            {venues.map((v) => (
              <TableRow key={v._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/coordinator/venues/${v._id}`)}>
                <TableCell><Typography fontWeight={600}>{v.name}</Typography></TableCell>
                <TableCell><Chip label={v.type} size="small" variant="outlined" /></TableCell>
                <TableCell>{v.address?.city ?? '—'}</TableCell>
                <TableCell align="right">{v.capacity?.toLocaleString('de-DE') ?? '—'}</TableCell>
                <TableCell><Chip label={v.status} color={v.status === 'active' ? 'success' : 'default'} size="small" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination component="div" count={total} page={page} rowsPerPage={20} onPageChange={(_, p) => setPage(p)} rowsPerPageOptions={[20]} />
      </Card>
    </Box>
  );
}
