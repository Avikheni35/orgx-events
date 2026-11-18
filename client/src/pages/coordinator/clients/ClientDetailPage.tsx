import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, Chip, Stack, Button, Tabs, Tab, Grid, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import { eventClientsApi, type EventClientContact } from '../../../api/eventClients';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [contactDialog, setContactDialog] = useState(false);
  const [contact, setContact] = useState<EventClientContact>({ name: '', email: '', phone: '', jobTitle: '', isPrimary: false });
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['event-client', id], queryFn: () => eventClientsApi.get(id!) });
  const client = data?.data;

  const { mutate: addContact, isPending: addingContact } = useMutation({
    mutationFn: () => eventClientsApi.addContact(id!, contact),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-client', id] }); setContactDialog(false); setContact({ name: '', email: '', phone: '', jobTitle: '' }); },
    onError: () => setError(t('clients.addContactError')),
  });

  const { mutate: removeContact } = useMutation({
    mutationFn: (contactId: string) => eventClientsApi.removeContact(id!, contactId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-client', id] }),
  });

  if (isLoading || !client) return <Box sx={{ p: 3 }}>{t('common.loading')}</Box>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
            <Typography variant="h5" fontWeight={700}>{client.name}</Typography>
            <Chip label={client.status === 'active' ? t('status.active') : t('status.inactive')} color={client.status === 'active' ? 'success' : 'default'} size="small" />
            <Chip label={client.type === 'company' ? t('clients.company') : t('clients.individual')} size="small" variant="outlined" />
          </Stack>
          {client.industry && <Typography color="text.secondary">{client.industry}</Typography>}
        </Box>
        <Button variant="outlined" onClick={() => navigate(`/coordinator/clients/${id}/edit`)}>{t('common.edit')}</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('events.overview')} />
        <Tab label={`${t('clients.contacts')} (${client.contacts.length})`} />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card><CardContent>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('clients.address')}</Typography>
              {client.address ? (
                <Typography>
                  {client.address.street}<br />
                  {client.address.postalCode} {client.address.city}<br />
                  {client.address.country}
                </Typography>
              ) : <Typography color="text.secondary">{t('clients.noAddress')}</Typography>}
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card><CardContent>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('clients.billingDetails')}</Typography>
              <Stack spacing={0.5}>
                <Typography>{t('clients.paymentTermsValue', { count: client.paymentTermsDays })}</Typography>
                {client.vatId && <Typography>{t('clients.vatId')}: <strong>{client.vatId}</strong></Typography>}
              </Stack>
            </CardContent></Card>
          </Grid>
          {client.notes && (
            <Grid item xs={12}>
              <Card><CardContent>
                <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('common.notes')}</Typography>
                <Typography>{client.notes}</Typography>
              </CardContent></Card>
            </Grid>
          )}
        </Grid>
      )}

      {tab === 1 && (
        <Box>
          <Stack direction="row" justifyContent="flex-end" mb={2}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setContactDialog(true)}>{t('clients.addContact')}</Button>
          </Stack>
          <Stack spacing={2}>
            {client.contacts.length === 0 && <Typography color="text.secondary" align="center">{t('clients.noContactsYet')}</Typography>}
            {client.contacts.map((c) => (
              <Card key={c._id}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={600}>{c.name}</Typography>
                        {c.isPrimary && <Chip label={t('eventClient.primary')} size="small" color="primary" />}
                      </Stack>
                      {c.jobTitle && <Typography variant="body2" color="text.secondary">{c.jobTitle}</Typography>}
                      <Divider sx={{ my: 0.5 }} />
                      <Typography variant="body2">{c.email}</Typography>
                      {c.phone && <Typography variant="body2">{c.phone}</Typography>}
                    </Box>
                    <IconButton size="small" color="error" onClick={() => c._id && removeContact(c._id)}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      <Dialog open={contactDialog} onClose={() => setContactDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('clients.addContact')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label={`${t('common.name')} *`} value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} fullWidth />
            <TextField label={`${t('common.email')} *`} value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} fullWidth />
            <TextField label={t('common.phone')} value={contact.phone ?? ''} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} fullWidth />
            <TextField label={t('clients.jobTitle')} value={contact.jobTitle ?? ''} onChange={(e) => setContact((c) => ({ ...c, jobTitle: e.target.value }))} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => addContact()} disabled={addingContact || !contact.name || !contact.email}>{t('common.add')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
