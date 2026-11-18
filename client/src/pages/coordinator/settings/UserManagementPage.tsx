import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EmailIcon from '@mui/icons-material/Email';
import { useTranslation } from 'react-i18next';
import { userManagementApi, ManagedUser, InviteUserPayload } from '../../../api/userManagement';

const ROLE_COLOR: Record<string, 'default' | 'primary' | 'secondary'> = { coordinator: 'primary', event_staff: 'default', event_client: 'secondary' };

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE');
}

export default function UserManagementPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['m2-users', roleFilter],
    queryFn: () => userManagementApi.list(roleFilter || undefined).then((r) => r.data),
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState<InviteUserPayload>({ firstName: '', lastName: '', email: '', role: 'event_staff' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saved, setSaved] = useState('');

  const inviteMutation = useMutation({
    mutationFn: () => userManagementApi.invite(form).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['m2-users'] });
      setInviteOpen(false);
      setForm({ firstName: '', lastName: '', email: '', role: 'event_staff' });
      setSaved(t('users.inviteSent'));
      setTimeout(() => setSaved(''), 3000);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      userManagementApi.setStatus(id, status).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['m2-users'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => userManagementApi.delete(id).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['m2-users'] });
      setDeleteId(null);
    },
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => userManagementApi.resendInvite(id).then((r) => r.data),
    onSuccess: () => { setSaved(t('users.resendSent')); setTimeout(() => setSaved(''), 3000); },
  });

  const users: ManagedUser[] = data ?? [];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('users.title')}</Typography>
          <Typography variant="body2" color="text.secondary">{t('users.subtitle')}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setInviteOpen(true)}>{t('users.invite')}</Button>
      </Stack>

      {saved && <Alert severity="success" sx={{ mb: 2 }}>{saved}</Alert>}

      <Stack direction="row" spacing={2} mb={2}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>{t('users.filterRole')}</InputLabel>
          <Select label={t('users.filterRole')} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <MenuItem value="">{t('common.all')}</MenuItem>
            <MenuItem value="coordinator">{t('users.coordinator')}</MenuItem>
            <MenuItem value="event_staff">{t('users.eventStaff')}</MenuItem>
            <MenuItem value="event_client">{t('users.eventClient')}</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {isLoading && <CircularProgress />}
      {!isLoading && users.length === 0 && (
        <Alert severity="info">{t('users.noUsers')}</Alert>
      )}

      {users.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('common.name')}</TableCell>
              <TableCell>{t('common.email')}</TableCell>
              <TableCell>{t('users.role')}</TableCell>
              <TableCell>{t('common.status')}</TableCell>
              <TableCell>{t('users.registered')}</TableCell>
              <TableCell>{t('users.lastLogin')}</TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u._id} hover>
                <TableCell><Typography fontWeight={600}>{u.firstName} {u.lastName}</Typography></TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Chip label={u.role === 'coordinator' ? t('users.coordinator') : u.role === 'event_staff' ? t('users.eventStaff') : t('users.eventClient')} size="small" color={ROLE_COLOR[u.role] ?? 'default'} /></TableCell>
                <TableCell>
                  <Chip
                    label={u.status === 'active' ? t('status.active') : t('status.inactive')}
                    size="small"
                    color={u.status === 'active' ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>{fmtDate(u.createdAt)}</TableCell>
                <TableCell>{fmtDate(u.lastLoginAt)}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title={t('users.resendInvite')}>
                      <IconButton size="small" onClick={() => resendMutation.mutate(u._id)} disabled={resendMutation.isPending}>
                        <EmailIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {u.status === 'active' ? (
                      <Tooltip title={t('users.deactivate')}>
                        <IconButton size="small" color="warning" onClick={() => statusMutation.mutate({ id: u._id, status: 'inactive' })}>
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Tooltip title={t('users.activate')}>
                        <IconButton size="small" color="success" onClick={() => statusMutation.mutate({ id: u._id, status: 'active' })}>
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {u.role !== 'coordinator' && (
                      <Tooltip title={t('common.delete')}>
                        <IconButton size="small" color="error" onClick={() => setDeleteId(u._id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('users.invite')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Stack direction="row" spacing={2}>
              <TextField label={t('staff.firstName')} value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} required fullWidth />
              <TextField label={t('staff.lastName')} value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} required fullWidth />
            </Stack>
            <TextField label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required fullWidth />
            <FormControl fullWidth>
              <InputLabel>{t('users.role')}</InputLabel>
              <Select label={t('users.role')} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as InviteUserPayload['role'] }))}>
                <MenuItem value="event_staff">{t('users.eventStaff')}</MenuItem>
                <MenuItem value="event_client">{t('users.eventClient')}</MenuItem>
                <MenuItem value="coordinator">{t('users.coordinator')}</MenuItem>
              </Select>
            </FormControl>
            {inviteMutation.isError && <Alert severity="error">{t('users.inviteError')}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => inviteMutation.mutate()} disabled={!form.firstName || !form.email || inviteMutation.isPending}>
            {inviteMutation.isPending ? `${t('users.invite')}…` : t('users.invite')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="xs">
        <DialogTitle>{t('users.deleteTitle')}</DialogTitle>
        <DialogContent><Typography>{t('users.deleteConfirm')}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={() => deleteMutation.mutate(deleteId!)} disabled={deleteMutation.isPending}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
