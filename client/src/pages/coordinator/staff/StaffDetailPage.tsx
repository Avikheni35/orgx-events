import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, Chip, Stack, Button, Tabs, Tab, Rating, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Alert, IconButton, Grid, FormControlLabel, Switch, Tooltip, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { useTranslation } from 'react-i18next';
import { staffProfilesApi } from '../../../api/staffProfiles';
import { timesheetsApi, type EventTimesheet } from '../../../api/timesheets';
import { paymentsApi, type Payment } from '../../../api/payments';
import { staffRatingsApi, type StaffRating } from '../../../api/staffRatings';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useNavigate } from 'react-router-dom';

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [certDialog, setCertDialog] = useState(false);
  const [cert, setCert] = useState({ name: '', issuer: '', issuedDate: '', expiryDate: '' });
  const [error, setError] = useState('');
  const [accountResult, setAccountResult] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const STATUS_COLORS_TS: Record<EventTimesheet['status'], string> = { pending: 'warning.main', approved: 'success.main', disputed: 'error.main' };
  const STATUS_LABEL_TS: Record<EventTimesheet['status'], string> = {
    pending: t('status.open'), approved: t('status.approved'), disputed: t('status.disputed'),
  };

  const { data, isLoading } = useQuery({ queryKey: ['staff-profile', id], queryFn: () => staffProfilesApi.get(id!) });
  const profile = data?.data;

  const { data: tsData } = useQuery({
    queryKey: ['staff-timesheets', id],
    queryFn: () => timesheetsApi.list({ staffProfileId: id!, limit: '50' }),
    enabled: tab === 2,
  });
  const timesheets: EventTimesheet[] = tsData?.data?.timesheets ?? [];

  const { data: payData } = useQuery({
    queryKey: ['staff-payments', id],
    queryFn: () => paymentsApi.forStaff(id!),
    enabled: tab === 3,
  });
  const payments: Payment[] = payData?.data?.payments ?? [];

  const { data: ratingsData } = useQuery({
    queryKey: ['staff-ratings', id],
    queryFn: () => staffRatingsApi.forStaff(id!),
    enabled: tab === 4,
  });
  const ratings: StaffRating[] = ratingsData?.data?.ratings ?? [];

  const { mutate: toggleDirectAssignable } = useMutation({
    mutationFn: (val: boolean) => staffProfilesApi.update(id!, { directAssignable: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-profile', id] }),
  });

  const { mutate: addCert, isPending: addingCert } = useMutation({
    mutationFn: () => staffProfilesApi.addCertification(id!, cert),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-profile', id] }); setCertDialog(false); setCert({ name: '', issuer: '', issuedDate: '', expiryDate: '' }); },
    onError: () => setError(t('staff.certAddError')),
  });

  const { mutate: createAccount, isPending: creatingAccount } = useMutation({
    mutationFn: () => staffProfilesApi.createAccount(id!),
    onSuccess: (res) => setAccountResult(res.data),
    onError: () => setError(t('staff.accountCreateError')),
  });

  const { mutate: removeCert } = useMutation({
    mutationFn: (certId: string) => staffProfilesApi.removeCertification(id!, certId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-profile', id] }),
  });

  if (isLoading || !profile) return <Box sx={{ p: 3 }}>{t('common.loading')}</Box>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{profile.firstName} {profile.lastName}</Typography>
          <Typography color="text.secondary">{profile.email}{profile.phone && ` · ${profile.phone}`}</Typography>
          <Stack direction="row" spacing={1} mt={1} alignItems="center">
            <Rating value={profile.rating.average} precision={0.5} readOnly size="small" />
            <Typography variant="caption">({t('staff.ratingsCount', { count: profile.rating.count })})</Typography>
            <Chip label={profile.status} color={profile.status === 'active' ? 'success' : 'default'} size="small" />
          </Stack>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Chip label={`${profile.totalEventsWorked} ${t('staff.eventsWorkedSuffix')}`} variant="outlined" />
          <Chip label={`${Math.round(profile.totalHoursWorked)} ${t('staff.hrsSuffix')}`} variant="outlined" />
          <Button
            variant="outlined"
            size="small"
            startIcon={<LockOpenIcon />}
            onClick={() => createAccount()}
            disabled={creatingAccount}
          >
            {profile.userId ? t('staff.resetPassword') : t('staff.createLogin')}
          </Button>
          <Tooltip title={t('staff.directAssignableTooltip')}>
            <FormControlLabel
              control={
                <Switch
                  checked={profile.directAssignable}
                  onChange={(e) => toggleDirectAssignable(e.target.checked)}
                  color="warning"
                  size="small"
                />
              }
              label={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <FlashOnIcon sx={{ fontSize: 14, color: profile.directAssignable ? 'warning.main' : 'text.disabled' }} />
                  <Typography variant="caption" fontWeight={600}
                    color={profile.directAssignable ? 'warning.main' : 'text.secondary'}>
                    {t('staff.directAssignable')}
                  </Typography>
                </Stack>
              }
              sx={{ m: 0 }}
            />
          </Tooltip>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={t('staff.tabProfile')} />
        <Tab label={`${t('staff.tabCertifications')} (${profile.certifications.length})`} />
        <Tab label={t('staff.tabTimesheets')} />
        <Tab label={t('staff.tabPayments')} />
        <Tab label={`${t('staff.tabRatings')} (${profile.rating.count})`} />
      </Tabs>

      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card><CardContent>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('staff.skills')}</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {profile.skills.length === 0 && <Typography variant="body2" color="text.secondary">{t('staff.noSkills')}</Typography>}
                {profile.skills.map((s) => <Chip key={s} label={s} size="small" />)}
              </Stack>
            </CardContent></Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card><CardContent>
              <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('staff.poolsAssigned')}</Typography>
              {profile.poolIds.length === 0 ? (
                <Typography variant="body2" color="text.secondary">{t('staff.noPoolsAssigned')}</Typography>
              ) : (
                <Typography variant="body2">{t('pools.memberCount', { count: profile.poolIds.length })}</Typography>
              )}
            </CardContent></Card>
          </Grid>
          {profile.notes && (
            <Grid item xs={12}>
              <Card><CardContent>
                <Typography variant="subtitle2" color="text.secondary" mb={1}>{t('common.notes')}</Typography>
                <Typography>{profile.notes}</Typography>
              </CardContent></Card>
            </Grid>
          )}
        </Grid>
      )}

      {tab === 1 && (
        <Box>
          <Stack direction="row" justifyContent="flex-end" mb={2}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCertDialog(true)}>{t('staff.addCertification')}</Button>
          </Stack>
          <Stack spacing={2}>
            {profile.certifications.length === 0 && <Typography color="text.secondary" align="center">{t('staff.noCertifications')}</Typography>}
            {profile.certifications.map((c) => (
              <Card key={c._id}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography fontWeight={600}>{c.name}</Typography>
                      {c.issuer && <Typography variant="body2" color="text.secondary">{c.issuer}</Typography>}
                      <Stack direction="row" spacing={2} mt={0.5}>
                        {c.issuedDate && <Typography variant="caption">{t('staff.issuedOn')}: {new Date(c.issuedDate).toLocaleDateString('de-DE')}</Typography>}
                        {c.expiryDate && <Typography variant="caption" color={new Date(c.expiryDate) < new Date() ? 'error' : 'text.secondary'}>{t('staff.certValidUntil')}: {new Date(c.expiryDate).toLocaleDateString('de-DE')}</Typography>}
                      </Stack>
                    </Box>
                    <IconButton size="small" color="error" onClick={() => removeCert(c._id)}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {tab === 2 && (
        <Box>
          {timesheets.length === 0 ? (
            <Typography color="text.secondary" align="center" py={4}>{t('staff.noTimesheets')}</Typography>
          ) : (
            <Stack spacing={1.5}>
              {timesheets.map((ts) => (
                <Card key={ts._id} variant="outlined" sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                  onClick={() => navigate(`/coordinator/events/${ts.eventId}/timesheet`)}>
                  <CardContent sx={{ p: '12px !important' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box flex={1}>
                        <Typography fontWeight={700} variant="body2">{ts.eventName}</Typography>
                        <Typography variant="caption" color="text.secondary">{ts.positionTitle}</Typography>
                        <Stack direction="row" spacing={2} mt={0.5} flexWrap="wrap">
                          <Typography variant="caption">
                            {new Date(ts.plannedStartTime).toLocaleDateString('de-DE')}
                          </Typography>
                          <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {t('timesheets.planned')} {new Date(ts.plannedStartTime).toLocaleTimeString('de-DE', { timeStyle: 'short' })}–{new Date(ts.plannedEndTime).toLocaleTimeString('de-DE', { timeStyle: 'short' })}
                          </Typography>
                          {ts.actualStartTime && ts.actualEndTime && (
                            <Typography variant="caption" color="success.main" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                              {t('timesheets.actual')} {new Date(ts.actualStartTime).toLocaleTimeString('de-DE', { timeStyle: 'short' })}–{new Date(ts.actualEndTime).toLocaleTimeString('de-DE', { timeStyle: 'short' })}
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                      <Stack alignItems="flex-end" spacing={0.5} flexShrink={0} ml={2}>
                        <Chip label={STATUS_LABEL_TS[ts.status]} size="small"
                          sx={{ fontSize: 10, color: STATUS_COLORS_TS[ts.status], borderColor: STATUS_COLORS_TS[ts.status] }}
                          variant="outlined" />
                        <Typography variant="caption" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {ts.totalHours.toFixed(2)} h · € {ts.grossPay.toFixed(2)}
                        </Typography>
                        {ts.ratingByCoordinator && (
                          <Stack direction="row">
                            {[1,2,3,4,5].map((n) =>
                              (ts.ratingByCoordinator ?? 0) >= n
                                ? <StarIcon key={n} sx={{ fontSize: 12, color: '#f59e0b' }} />
                                : <StarBorderIcon key={n} sx={{ fontSize: 12, color: '#d1d5db' }} />
                            )}
                          </Stack>
                        )}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {/* Totals */}
              <Card sx={{ bgcolor: 'action.hover' }}>
                <CardContent sx={{ p: '12px !important' }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography fontWeight={700}>{t('common.total')}</Typography>
                    <Typography fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {timesheets.reduce((s, ts) => s + ts.totalHours, 0).toFixed(2)} h
                      &nbsp;·&nbsp;
                      € {timesheets.reduce((s, ts) => s + ts.grossPay, 0).toFixed(2)}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          )}
        </Box>
      )}

      {tab === 3 && (
        <Box>
          {payments.length === 0 ? (
            <Typography color="text.secondary" align="center" py={4}>{t('staff.noPayments')}</Typography>
          ) : (
            <Stack spacing={1.5}>
              {payments.map((p) => {
                const monthName = t(`reports.months.${p.month}`);
                return (
                  <Card key={p._id} variant="outlined">
                    <CardContent sx={{ p: '12px !important' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box flex={1}>
                          <Typography fontWeight={700} variant="body2">{monthName} {p.year}</Typography>
                          <Stack direction="row" spacing={2} mt={0.5} flexWrap="wrap">
                            <Typography variant="caption" color="text.secondary">
                              {p.totalHoursWorked.toFixed(2)} {t('staff.hrsSuffix')} · {p.totalEventsWorked} {t('staff.eventsWorkedSuffix')}
                            </Typography>
                            {p.bonus > 0 && (
                              <Typography variant="caption" color="success.main">
                                + € {p.bonus.toFixed(2)} {t('payments.bonus')}
                              </Typography>
                            )}
                            {p.deductions > 0 && (
                              <Typography variant="caption" color="error.main">
                                - € {p.deductions.toFixed(2)} {t('payments.deductions')}
                              </Typography>
                            )}
                          </Stack>
                          {p.notes && (
                            <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
                              {p.notes}
                            </Typography>
                          )}
                        </Box>
                        <Stack alignItems="flex-end" spacing={0.5} flexShrink={0} ml={2}>
                          <Chip
                            label={p.status === 'paid' ? t('status.paid') : t('status.open')}
                            color={p.status === 'paid' ? 'success' : 'warning'}
                            size="small"
                            sx={{ fontSize: 10 }}
                          />
                          <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            € {p.totalAmount.toFixed(2)}
                          </Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
              <Card sx={{ bgcolor: 'action.hover' }}>
                <CardContent sx={{ p: '12px !important' }}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography fontWeight={700}>{t('common.total')}</Typography>
                    <Typography fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {payments.reduce((s, p) => s + p.totalHoursWorked, 0).toFixed(2)} {t('staff.hrsSuffix')} &nbsp;·&nbsp;
                      € {payments.reduce((s, p) => s + p.totalAmount, 0).toFixed(2)}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          )}
        </Box>
      )}

      {tab === 4 && (
        <Box>
          {ratings.length === 0 ? (
            <Typography color="text.secondary" align="center" py={4}>{t('staff.noRatings')}</Typography>
          ) : (
            <Stack spacing={1.5}>
              {ratings.map((r) => (
                <Card key={r._id} variant="outlined">
                  <CardContent sx={{ p: '14px !important' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box flex={1}>
                        <Typography fontWeight={700} variant="body2">{r.eventName}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(r.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </Typography>
                        {r.comment && (
                          <Typography variant="body2" sx={{ mt: 0.75, fontStyle: 'italic', color: 'text.secondary' }}>
                            „{r.comment}"
                          </Typography>
                        )}
                      </Box>
                      <Stack alignItems="flex-end" spacing={0.25} flexShrink={0} ml={2}>
                        <Stack direction="row">
                          {[1,2,3,4,5].map((n) =>
                            r.score >= n
                              ? <StarIcon key={n} sx={{ fontSize: 16, color: '#f59e0b' }} />
                              : <StarBorderIcon key={n} sx={{ fontSize: 16, color: '#d1d5db' }} />
                          )}
                        </Stack>
                        <Typography variant="caption" fontWeight={700}>{r.score}/5</Typography>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
              {/* Summary */}
              <Card sx={{ bgcolor: 'action.hover' }}>
                <CardContent sx={{ p: '12px !important' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography fontWeight={700}>{t('staff.average')}</Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Rating value={profile.rating.average} precision={0.5} readOnly size="small" />
                      <Typography fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {profile.rating.average.toFixed(1)} / 5 ({profile.rating.count})
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          )}
        </Box>
      )}

      {/* Account created dialog */}
      <Dialog open={!!accountResult} onClose={() => setAccountResult(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('staff.accountCreatedTitle')}</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>{t('staff.accountCreatedText')}</Alert>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="caption" color="text.secondary">{t('common.email')}</Typography>
              <Typography fontWeight={700}>{accountResult?.email}</Typography>
            </Box>
            <Divider />
            <Box>
              <Typography variant="caption" color="text.secondary">{t('staff.tempPassword')}</Typography>
              <Typography fontWeight={700} sx={{ fontFamily: 'monospace', fontSize: 18, letterSpacing: 2 }}>
                {accountResult?.temporaryPassword}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setAccountResult(null)}>{t('staff.understood')}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={certDialog} onClose={() => setCertDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('staff.addCertification')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label={`${t('common.name')} *`} value={cert.name} onChange={(e) => setCert((c) => ({ ...c, name: e.target.value }))} fullWidth />
            <TextField label={t('staff.certIssuer')} value={cert.issuer} onChange={(e) => setCert((c) => ({ ...c, issuer: e.target.value }))} fullWidth />
            <Stack direction="row" spacing={2}>
              <TextField label={t('staff.certIssuedDate')} type="date" value={cert.issuedDate} onChange={(e) => setCert((c) => ({ ...c, issuedDate: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
              <TextField label={t('staff.certExpiryDate')} type="date" value={cert.expiryDate} onChange={(e) => setCert((c) => ({ ...c, expiryDate: e.target.value }))} fullWidth InputLabelProps={{ shrink: true }} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCertDialog(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={() => addCert()} disabled={addingCert || !cert.name}>{t('common.add')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
