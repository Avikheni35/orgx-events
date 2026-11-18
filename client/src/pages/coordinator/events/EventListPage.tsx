import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Button, Card, Table, TableHead, TableRow, TableCell, TableBody, Chip, Stack, MenuItem, Select, FormControl, InputLabel, TablePagination } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { eventsApi, type EventStatus } from '../../../api/events';

const STATUS_OPTIONS: EventStatus[] = ['draft', 'planning', 'staffing', 'confirmed', 'in_progress', 'completed', 'cancelled'];
const STATUS_COLORS: Record<EventStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  draft: 'default', planning: 'info', staffing: 'secondary', confirmed: 'primary',
  in_progress: 'warning', completed: 'success', cancelled: 'error',
};

export default function EventListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['events', status, page],
    queryFn: () => eventsApi.list({ ...(status ? { status } : {}), page: String(page + 1), limit: String(limit) }),
  });

  const events = data?.data?.events ?? [];
  const total = data?.data?.total ?? 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('events.title')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/coordinator/events/new')}>{t('events.new')}</Button>
      </Stack>

      <Card sx={{ mb: 2, p: 2 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <MenuItem value="">Alle</MenuItem>
            {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
      </Card>

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nr.</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>Ende</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Positionen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={7} align="center">Laden...</TableCell></TableRow>}
            {!isLoading && events.length === 0 && <TableRow><TableCell colSpan={7} align="center">Keine Events gefunden.</TableCell></TableRow>}
            {events.map((ev) => (
              <TableRow key={ev._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/coordinator/events/${ev._id}`)}>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{ev.eventNumber}</TableCell>
                <TableCell><Typography fontWeight={600}>{ev.name}</Typography></TableCell>
                <TableCell>{ev.clientName}</TableCell>
                <TableCell>{new Date(ev.startDate).toLocaleDateString('de-DE')}</TableCell>
                <TableCell>{new Date(ev.endDate).toLocaleDateString('de-DE')}</TableCell>
                <TableCell><Chip label={ev.status} color={STATUS_COLORS[ev.status]} size="small" /></TableCell>
                <TableCell>{ev.positions?.length ?? 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div" count={total} page={page} rowsPerPage={limit}
          onPageChange={(_, p) => setPage(p)} rowsPerPageOptions={[limit]}
        />
      </Card>
    </Box>
  );
}
