import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, CardActions, Stack, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, Grid, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PeopleIcon from '@mui/icons-material/People';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import { staffPoolsApi } from '../../../api/staffPools';
import { staffProfilesApi } from '../../../api/staffProfiles';

export default function StaffPoolsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [createDialog, setCreateDialog] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [selectedPool, setSelectedPool] = useState('');
  const [memberDialog, setMemberDialog] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['staff-pools'], queryFn: () => staffPoolsApi.list() });
  const pools = data?.data?.pools ?? [];

  const { data: poolDetail } = useQuery({
    queryKey: ['staff-pool', selectedPool],
    queryFn: () => staffPoolsApi.get(selectedPool),
    enabled: !!selectedPool && memberDialog,
  });

  const { data: allStaff } = useQuery({
    queryKey: ['staff-profiles', 'all'],
    queryFn: () => staffProfilesApi.list({ limit: '200' }),
    enabled: memberDialog,
  });

  const { mutate: createPool, isPending: creating } = useMutation({
    mutationFn: () => staffPoolsApi.create({ name: form.name, description: form.description || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-pools'] }); setCreateDialog(false); setForm({ name: '', description: '' }); },
    onError: () => setError(t('pools.createError')),
  });

  const { mutate: addMember } = useMutation({
    mutationFn: (staffProfileId: string) => staffPoolsApi.addMember(selectedPool, staffProfileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-pool', selectedPool] }),
  });

  const { mutate: removeMember } = useMutation({
    mutationFn: (staffProfileId: string) => staffPoolsApi.removeMember(selectedPool, staffProfileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-pool', selectedPool] }),
  });

  const poolMemberIds: string[] = (poolDetail?.data as { memberIds?: string[] } | undefined)?.memberIds ?? [];
  const allProfiles = allStaff?.data?.profiles ?? [];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('pools.title')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateDialog(true)}>{t('pools.new')}</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {isLoading && <Typography>{t('common.loading')}</Typography>}

      <Grid container spacing={2}>
        {pools.map((pool) => (
          <Grid item xs={12} sm={6} md={4} key={pool._id}>
            <Card>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography fontWeight={700}>{pool.name}</Typography>
                    {pool.description && <Typography variant="body2" color="text.secondary">{pool.description}</Typography>}
                  </Box>
                  <Chip label={pool.status} color={pool.status === 'active' ? 'success' : 'default'} size="small" />
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.5} mt={1}>
                  <PeopleIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">{t('pools.memberCount', { count: pool.memberCount })}</Typography>
                </Stack>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => { setSelectedPool(pool._id); setMemberDialog(true); }}>
                  {t('pools.manageMember')}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
        {!isLoading && pools.length === 0 && (
          <Grid item xs={12}>
            <Typography color="text.secondary" align="center">{t('pools.noPools')}</Typography>
          </Grid>
        )}
      </Grid>

      {/* Create pool dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('pools.new')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label={`${t('common.name')} *`} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} fullWidth />
            <TextField label={t('pools.description')} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} fullWidth multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => createPool()} disabled={creating || !form.name}>{t('common.create')}</Button>
        </DialogActions>
      </Dialog>

      {/* Members dialog */}
      <Dialog open={memberDialog} onClose={() => setMemberDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('pools.membersDialogTitle')}</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" color="text.secondary" mt={1} mb={1}>{t('pools.allProfiles')}</Typography>
          <Stack spacing={0.5}>
            {allProfiles.map((p) => {
              const isMember = poolMemberIds.includes(p._id);
              return (
                <Stack key={p._id} direction="row" alignItems="center" justifyContent="space-between"
                  sx={{ p: 1, borderRadius: 1, bgcolor: isMember ? 'success.light' : 'transparent', '&:hover': { bgcolor: 'action.hover' } }}>
                  <Box>
                    <Typography variant="body2" fontWeight={isMember ? 600 : 400}>{p.firstName} {p.lastName}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.email}</Typography>
                  </Box>
                  {isMember ? (
                    <IconButton size="small" color="error" onClick={() => removeMember(p._id)}><DeleteIcon fontSize="small" /></IconButton>
                  ) : (
                    <Button size="small" variant="outlined" onClick={() => addMember(p._id)}>{t('pools.addMember')}</Button>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberDialog(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
