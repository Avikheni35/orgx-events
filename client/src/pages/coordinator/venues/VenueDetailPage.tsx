import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Button, Card, CardContent, Chip, Stack, Divider, Tab, Tabs,
  Table, TableHead, TableRow, TableCell, TableBody,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from 'react-i18next';
import { venuesApi, type Venue } from '../../../api/venues';
import { eventsApi, type Event } from '../../../api/events';

const TYPE_LABELS: Record<string, string> = { indoor: 'Indoor', outdoor: 'Outdoor', hybrid: 'Hybrid' };
const STATUS_COLORS: Record<string, 'success' | 'default'> = { active: 'success', inactive: 'default' };
const EVENT_STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'primary' | 'success' | 'error'> = {
  draft: 'default', planning: 'info', staffing: 'warning', confirmed: 'primary',
  in_progress: 'primary', completed: 'success', cancelled: 'error',
};

export default function VenueDetailPage() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Venue>>({});
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => venuesApi.get(venueId!),
    enabled: !!venueId,
  });
  const venue = data?.data;

  const { data: eventsData } = useQuery({
    queryKey: ['venue-events', venueId],
    queryFn: () => eventsApi.list({ venueId: venueId!, limit: '50' }),
    enabled: !!venueId && tab === 1,
  });
  const events: Event[] = eventsData?.data?.events ?? [];

  const { mutate: updateVenue, isPending: updating } = useMutation({
    mutationFn: (data: Partial<Venue>) => venuesApi.update(venueId!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['venue', venueId] }); qc.invalidateQueries({ queryKey: ['venues'] }); setEditOpen(false); },
    onError: () => setError(t('venues.updateFailed')),
  });

  const { mutate: deleteVenue, isPending: deleting } = useMutation({
    mutationFn: () => venuesApi.delete(venueId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['venues'] }); navigate('/coordinator/venues'); },
    onError: () => setError(t('venues.deleteFailed')),
  });

  const openEdit = () => {
    if (!venue) return;
    setEditForm({ name: venue.name, type: venue.type, capacity: venue.capacity, address: venue.address, facilities: venue.facilities, notes: venue.notes, status: venue.status });
    setEditOpen(true);
  };

  if (isLoading) return <Box sx={{ p: 3 }}>{t('common.loading')}</Box>;
  if (!venue) return <Box sx={{ p: 3 }}><Alert severity="error">{t('venues.notFound')}</Alert></Box>;

  const addr = venue.address;
  const addressStr = [addr?.street, addr?.postalCode, addr?.city, addr?.country].filter(Boolean).join(', ');
  const mapsUrl = addressStr ? `https://www.google.com/maps/search/${encodeURIComponent(addressStr)}` : null;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton onClick={() => navigate('/coordinator/venues')} size="small"><ArrowBackIcon /></IconButton>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h5" fontWeight={700}>{venue.name}</Typography>
              <Chip label={venue.status} color={STATUS_COLORS[venue.status]} size="small" />
              <Chip label={TYPE_LABELS[venue.type] ?? venue.type} size="small" variant="outlined" />
            </Stack>
            {addressStr && <Typography variant="body2" color="text.secondary">{addressStr}</Typography>}
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<EditIcon />} onClick={openEdit}>{t('common.edit')}</Button>
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteOpen(true)}>{t('common.delete')}</Button>
        </Stack>
      </Stack>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={4} flexWrap="wrap" rowGap={2}>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('venues.capacityLabel')}</Typography>
              <Typography variant="body1" fontWeight={600}>{venue.capacity?.toLocaleString('de-DE') ?? '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('venues.facilities')}</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" mt={0.5}>
                {venue.facilities.length > 0
                  ? venue.facilities.map((f) => <Chip key={f} label={f} size="small" variant="outlined" />)
                  : <Typography variant="body2">—</Typography>}
              </Stack>
            </Box>
            {mapsUrl && (
              <Box>
                <Typography variant="caption" color="text.secondary">{t('common.address')}</Typography>
                <Box>
                  <Button size="small" endIcon={<OpenInNewIcon />} href={mapsUrl} target="_blank" rel="noreferrer" sx={{ p: 0, mt: 0.5, textTransform: 'none' }}>
                    {t('venues.openMaps')}
                  </Button>
                </Box>
              </Box>
            )}
          </Stack>
          {venue.notes && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary">{venue.notes}</Typography>
            </>
          )}
        </CardContent>
      </Card>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Info" />
        <Tab label={`Events${events.length > 0 ? ` (${events.length})` : ''}`} />
      </Tabs>

      {tab === 1 && (
        <Card>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('events.name')}</TableCell>
                <TableCell>{t('common.date')}</TableCell>
                <TableCell>{t('events.client')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center">{t('venues.noEventsAtVenue')}</TableCell></TableRow>
              )}
              {events.map((e) => (
                <TableRow key={e._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/coordinator/events/${e._id}`)}>
                  <TableCell><Typography fontWeight={600}>{e.name}</Typography><Typography variant="caption" color="text.secondary">{e.eventNumber}</Typography></TableCell>
                  <TableCell>{new Date(e.startDate).toLocaleDateString('de-DE')}</TableCell>
                  <TableCell>{e.clientName}</TableCell>
                  <TableCell><Chip label={e.status} color={EVENT_STATUS_COLORS[e.status] ?? 'default'} size="small" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('venues.editTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('common.name')} value={editForm.name ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} fullWidth required />
            <TextField select label={t('venues.type')} value={editForm.type ?? 'indoor'} onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value as Venue['type'] }))} fullWidth>
              {['indoor', 'outdoor', 'hybrid'].map((t) => <MenuItem key={t} value={t}>{TYPE_LABELS[t]}</MenuItem>)}
            </TextField>
            <TextField label={t('venues.capacityLabel')} type="number" value={editForm.capacity ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, capacity: e.target.value ? Number(e.target.value) : undefined }))} fullWidth />
            <TextField label={t('clients.street')} value={editForm.address?.street ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, address: { ...p.address, street: e.target.value } }))} fullWidth />
            <Stack direction="row" spacing={2}>
              <TextField label={t('clients.postalCode')} value={editForm.address?.postalCode ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, address: { ...p.address, postalCode: e.target.value } }))} sx={{ width: 120 }} />
              <TextField label={t('clients.city')} value={editForm.address?.city ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, address: { ...p.address, city: e.target.value } }))} fullWidth />
            </Stack>
            <TextField label={t('common.notes')} value={editForm.notes ?? ''} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} multiline rows={3} fullWidth />
            <TextField select label={t('common.status')} value={editForm.status ?? 'active'} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as Venue['status'] }))} fullWidth>
              <MenuItem value="active">{t('status.active')}</MenuItem>
              <MenuItem value="inactive">{t('status.inactive')}</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" disabled={updating} onClick={() => updateVenue(editForm)}>{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>{t('venues.deleteTitle', { name: venue.name })}</DialogTitle>
        <DialogContent>
          <Typography>{t('venues.deleteConfirm')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" color="error" disabled={deleting} onClick={() => deleteVenue()}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
