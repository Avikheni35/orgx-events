import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Card, Table, TableHead, TableRow, TableCell, TableBody,
  Chip, Stack, Button, MenuItem, Select, FormControl, InputLabel, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip,
  IconButton, CircularProgress, Collapse,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import UndoIcon from '@mui/icons-material/Undo';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { paymentsApi, type Payment } from '../../../api/payments';
import { timesheetsApi, type EventTimesheet } from '../../../api/timesheets';
import { integrationsApi } from '../../../api/integrations';
import { useTranslation } from 'react-i18next';
import { staffProfilesApi, type StaffProfile } from '../../../api/staffProfiles';

const now = new Date();

interface EditState {
  id: string;
  staffName: string;
  basePay: number;
  bonus: number;
  deductions: number;
  notes: string;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function PaymentsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<EditState | null>(null);
  const [error, setError] = useState('');
  const [info,  setInfo]  = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const qKey = ['payments', year, month, statusFilter];

  const { data: integrationData } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsApi.get().then((r) => r.data),
  });
  const m3Integrated = integrationData?.connectedServices?.m3?.enabled === true;

  const { data, isLoading } = useQuery({
    queryKey: qKey,
    queryFn: () => paymentsApi.list({ year, month, ...(statusFilter ? { status: statusFilter } : {}) }),
  });
  const payments: Payment[] = data?.data?.payments ?? [];

  // All active staff — used to build the template list
  const { data: staffData } = useQuery({
    queryKey: ['staff-profiles-active'],
    queryFn: () => staffProfilesApi.list({ status: 'active' }),
  });
  const allStaff: StaffProfile[] = staffData?.data?.profiles ?? [];

  // Fetch all approved timesheets for this month to populate detail rows
  const { data: tsData } = useQuery({
    queryKey: ['timesheets-for-payments', year, month],
    queryFn: () => timesheetsApi.list({ status: 'approved', year: String(year), month: String(month) }),
    enabled: allStaff.length > 0 || payments.length > 0,
  });
  const allTimesheets: EventTimesheet[] = tsData?.data?.timesheets ?? [];

  // Group timesheets by staffProfileId
  const tsByStaff: Record<string, EventTimesheet[]> = {};
  for (const ts of allTimesheets) {
    if (!tsByStaff[ts.staffProfileId]) tsByStaff[ts.staffProfileId] = [];
    tsByStaff[ts.staffProfileId].push(ts);
  }

  // Payment map for fast lookup
  const paymentByStaff: Record<string, Payment> = {};
  for (const p of payments) paymentByStaff[p.staffProfileId] = p;

  // Merged rows: every active staff member, plus payments for staff no longer active
  const mergedRows: { staffProfileId: string; staffName: string; payment: Payment | null }[] = [
    ...allStaff.map((s) => ({
      staffProfileId: s._id,
      staffName: `${s.firstName} ${s.lastName}`,
      payment: paymentByStaff[s._id] ?? null,
    })),
    ...payments
      .filter((p) => !allStaff.find((s) => s._id === p.staffProfileId))
      .map((p) => ({ staffProfileId: p.staffProfileId, staffName: p.staffName, payment: p })),
  ];

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const { mutate: generate, isPending: generating } = useMutation({
    mutationFn: () => paymentsApi.generate(year, month),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: qKey });
      const msg = res.data.message ?? `${res.data.generated} Datensätze erstellt/aktualisiert.`;
      setInfo(msg);
      setError('');
    },
    onError: () => setError(t('payments.generateFailed')),
  });

  const { mutate: saveEdit, isPending: saving } = useMutation({
    mutationFn: (e: EditState) => paymentsApi.update(e.id, {
      basePay: e.basePay, bonus: e.bonus, deductions: e.deductions, notes: e.notes || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setEditing(null); setError(''); },
    onError: () => setError(t('timesheets.saveFailed')),
  });

  const { mutate: markPaid } = useMutation({
    mutationFn: (id: string) => paymentsApi.markPaid(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setError(''); },
    onError: () => setError(t('common.errorGeneric')),
  });

  const { mutate: revert } = useMutation({
    mutationFn: (id: string) => paymentsApi.revert(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setError(''); },
    onError: () => setError(t('common.errorGeneric')),
  });

  // Previous month for carry-forward lookup
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const { data: prevData } = useQuery({
    queryKey: ['payments-prev', prevYear, prevMonth],
    queryFn: () => paymentsApi.list({ year: prevYear, month: prevMonth }),
  });
  const prevPayments: Payment[] = prevData?.data?.payments ?? [];
  const prevCarryMap: Record<string, number> = {};
  for (const p of prevPayments) {
    if (p.carryForwardHours && p.carryForwardHours > 0) {
      prevCarryMap[p.staffProfileId] = p.carryForwardHours;
    }
  }

  const pending = payments.filter((p) => p.status === 'pending');
  const totals  = payments.reduce((acc, p) => ({
    hours:  acc.hours  + p.totalHoursWorked,
    amount: acc.amount + p.totalAmount,
  }), { hours: 0, amount: 0 });

  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  // Total columns: toggle + Mitarbeiter + Stunden + Einsätze + Grundlohn(TS) + Grundlohn + Bonus + Abzüge + Gesamt + Std.gezahlt + Vorm.offen + Übertrag + Status + Zahldatum + Notiz + Actions = 16
  const COL_COUNT = 16;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('payments.title')}</Typography>

      {m3Integrated && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('payments.erpIntegrationActive')}
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {info  && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo('')}>{info}</Alert>}

      {/* Controls */}
      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" gap={1}>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>{t('reports.month')}</InputLabel>
            <Select value={month} label={t('reports.month')} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((i) => (
                <MenuItem key={i} value={i}>{t(`reports.months.${i}`)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>{t('reports.year')}</InputLabel>
            <Select value={year} label={t('reports.year')} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>{t('common.status')}</InputLabel>
            <Select value={statusFilter} label={t('common.status')} onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="">{t('common.all')}</MenuItem>
              <MenuItem value="pending">{t('status.open')}</MenuItem>
              <MenuItem value="paid">{t('status.paid')}</MenuItem>
            </Select>
          </FormControl>

          <Box flex={1} />

          <Button
            variant="outlined"
            startIcon={generating ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={() => generate()}
            disabled={generating}
          >
            {t('payments.loadFromTimesheets')}
          </Button>

          {pending.length > 0 && (
            <Chip label={`${pending.length} ${t('status.open').toLowerCase()}`} color="warning" variant="outlined" />
          )}
        </Stack>
      </Card>

      {/* Table */}
      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ '& td, & th': { whiteSpace: 'nowrap' } }}>
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12 } }}>
                <TableCell sx={{ width: 32 }} />
                <TableCell>{t('staff.title')}</TableCell>
                <TableCell align="right">{t('timesheets.hours')}</TableCell>
                <TableCell align="right">{t('staff.eventsWorked')}</TableCell>
                <TableCell align="right">{t('payments.basePayTs')}</TableCell>
                <TableCell align="right">{t('payments.basePay')}</TableCell>
                <TableCell align="right">{t('payments.bonus')}</TableCell>
                <TableCell align="right">{t('payments.deductions')}</TableCell>
                <TableCell align="right">{t('invoices.total')}</TableCell>
                <TableCell align="right">{t('payments.paidHours')}</TableCell>
                <TableCell align="right">{t('payments.prevPending')}</TableCell>
                <TableCell align="right">{t('payments.carryForward')}</TableCell>
                <TableCell>{t('common.status')}</TableCell>
                <TableCell>{t('payments.paymentDate')}</TableCell>
                <TableCell>{t('common.notes')}</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={COL_COUNT} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && mergedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COL_COUNT} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {t('payments.noPayments')}
                  </TableCell>
                </TableRow>
              )}

              {mergedRows.map((row) => {
                const p = row.payment;
                const staffTs = tsByStaff[row.staffProfileId] ?? [];
                const isOpen = !!expanded[row.staffProfileId];
                const hasTs = staffTs.length > 0;

                return (
                  <>
                    {/* Main payment row */}
                    <TableRow key={row.staffProfileId} hover sx={{ '& td': { borderBottom: isOpen ? 0 : undefined } }}>
                      <TableCell sx={{ width: 32, px: 0.5 }}>
                        {hasTs ? (
                          <IconButton size="small" onClick={() => toggleExpand(row.staffProfileId)}>
                            {isOpen ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
                          </IconButton>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color={p ? 'text.primary' : 'text.secondary'}>
                          {row.staffName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {p ? p.totalHoursWorked.toFixed(2) : <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right">
                        {p ? p.totalEventsWorked : <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                        {p ? `€ ${p.basePayFromTimesheets.toFixed(2)}` : <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {p ? `€ ${p.basePay.toFixed(2)}` : <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: p?.bonus && p.bonus > 0 ? 'success.main' : 'text.disabled' }}>
                        {p ? (p.bonus > 0 ? `+ € ${p.bonus.toFixed(2)}` : '—') : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: p?.deductions && p.deductions > 0 ? 'error.main' : 'text.disabled' }}>
                        {p ? (p.deductions > 0 ? `- € ${p.deductions.toFixed(2)}` : '—') : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                        {p ? `€ ${p.totalAmount.toFixed(2)}` : <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {p?.paidHours != null && p?.totalHours != null ? (
                          <Typography variant="caption" fontWeight={600}
                            sx={{ color: p.paidHours < p.totalHours ? '#E65100' : 'success.main' }}>
                            {p.paidHours.toFixed(2)} / {p.totalHours.toFixed(2)} h
                          </Typography>
                        ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {prevCarryMap[row.staffProfileId] ? (
                          <Chip
                            label={`${prevCarryMap[row.staffProfileId].toFixed(2)} h`}
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ fontSize: 10, fontWeight: 600 }}
                          />
                        ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {p?.carryForwardHours && p.carryForwardHours > 0 ? (
                          <Chip
                            label={`${p.carryForwardHours.toFixed(2)} h`}
                            size="small"
                            color="info"
                            variant="outlined"
                            sx={{ fontSize: 10, fontWeight: 600 }}
                          />
                        ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                      </TableCell>
                      <TableCell>
                        {!p ? (
                          <Chip label={t('payments.noEntry')} size="small" variant="outlined" sx={{ fontSize: 10, color: 'text.disabled' }} />
                        ) : p.status === 'paid' && p.paidHours != null && p.totalHours != null && p.paidHours < p.totalHours && !p.carryForwardHours ? (
                          <Chip
                            label={t('payments.partiallyPaid')}
                            size="small"
                            sx={{ fontSize: 10, bgcolor: '#E65100', color: '#fff', fontWeight: 600 }}
                          />
                        ) : (
                          <Chip
                            label={p.status === 'paid' ? t('status.paid') : t('status.open')}
                            color={p.status === 'paid' ? 'success' : 'warning'}
                            size="small"
                            sx={{ fontSize: 10 }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                        {p?.paidAt ? fmtDate(p.paidAt) : '—'}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 140 }}>
                        <Typography variant="caption" color="text.secondary" noWrap title={p?.notes}>
                          {p?.notes || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {!m3Integrated && p && (
                          <Stack direction="row" spacing={0.5}>
                            {p.status === 'pending' && (
                              <>
                                <Tooltip title={t('common.edit')}>
                                  <IconButton size="small" onClick={() => setEditing({
                                    id: p._id, staffName: p.staffName,
                                    basePay: p.basePay, bonus: p.bonus,
                                    deductions: p.deductions, notes: p.notes ?? '',
                                  })}>
                                    <EditIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={t('payments.markPaid')}>
                                  <IconButton size="small" color="success" onClick={() => markPaid(p._id)}>
                                    <CheckCircleIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                            {p.status === 'paid' && (
                              <Tooltip title={t('payments.revert')}>
                                <IconButton size="small" color="warning" onClick={() => revert(p._id)}>
                                  <UndoIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded timesheet detail rows */}
                    {hasTs && (
                      <TableRow key={`${row.staffProfileId}-detail`}>
                        <TableCell colSpan={COL_COUNT} sx={{ py: 0, px: 0, borderBottom: isOpen ? undefined : 0 }}>
                          <Collapse in={isOpen} unmountOnExit>
                            <Table size="small" sx={{ bgcolor: 'action.hover' }}>
                              <TableHead>
                                <TableRow sx={{ '& th': { fontSize: 11, color: 'text.secondary', fontWeight: 600, py: 0.5 } }}>
                                  <TableCell sx={{ width: 32 }} />
                                  <TableCell>{t('events.title')}</TableCell>
                                  <TableCell>{t('timesheets.position')}</TableCell>
                                  <TableCell>{t('common.date')}</TableCell>
                                  <TableCell align="right">{t('timesheets.planned')}</TableCell>
                                  <TableCell align="right">{t('timesheets.hours')}</TableCell>
                                  <TableCell align="right">{t('timesheets.gross')}</TableCell>
                                  <TableCell>{t('timesheets.accounting')}</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {staffTs.map((ts) => (
                                  <TableRow key={ts._id}>
                                    <TableCell sx={{ width: 32 }}>
                                      <Typography variant="caption" color="text.disabled">↳</Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="caption" fontWeight={500}>{ts.eventName}</Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="caption" color="text.secondary">{ts.positionTitle}</Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Typography variant="caption" color="text.secondary">
                                        {fmtDate(ts.plannedStartTime)}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                        {new Date(ts.plannedStartTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                        {' – '}
                                        {new Date(ts.plannedEndTime).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                      <Typography variant="caption">{ts.totalHours.toFixed(2)}</Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                                      <Typography variant="caption">€ {ts.grossPay.toFixed(2)}</Typography>
                                    </TableCell>
                                    <TableCell>
                                      {ts.syncStatus === 'synced' && <Chip label={t('timesheets.synced')} color="success" size="small" sx={{ fontSize: 10 }} />}
                                      {ts.syncStatus === 'pending' && <Chip label={t('status.pending')} color="info" size="small" sx={{ fontSize: 10 }} />}
                                      {ts.syncStatus === 'failed'  && <Chip label={t('timesheets.syncError')} color="error" size="small" sx={{ fontSize: 10 }} />}
                                      {(!ts.syncStatus || ts.syncStatus === 'not_configured') && <Typography variant="caption" color="text.disabled">—</Typography>}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}

              {payments.length > 0 && mergedRows.length > 0 && (
                <TableRow sx={{ bgcolor: 'action.hover', '& td': { fontWeight: 700 } }}>
                  <TableCell />
                  <TableCell>{t('invoices.total')}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{totals.hours.toFixed(2)}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {totals.amount.toFixed(2)}</TableCell>
                  <TableCell colSpan={7} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Card>

      {/* Edit Dialog */}
      {editing && (
        <Dialog open onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
          <DialogTitle>{t('payments.editTitle')} — {editing.staffName}</DialogTitle>
          <DialogContent>
            <Stack spacing={2.5} sx={{ mt: 1 }}>
              <TextField
                label={`${t('payments.basePay')} (€)`} type="number" size="small" fullWidth
                value={editing.basePay}
                onChange={(e) => setEditing((s) => s && { ...s, basePay: Number(e.target.value) })}
                inputProps={{ min: 0, step: 0.01 }}
                helperText={t('payments.basePayHelper')}
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  label={`${t('payments.bonus')} (€)`} type="number" size="small" fullWidth
                  value={editing.bonus}
                  onChange={(e) => setEditing((s) => s && { ...s, bonus: Number(e.target.value) })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
                <TextField
                  label={`${t('payments.deductions')} (€)`} type="number" size="small" fullWidth
                  value={editing.deductions}
                  onChange={(e) => setEditing((s) => s && { ...s, deductions: Number(e.target.value) })}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Stack>
              <TextField
                label={t('common.notesOptional')} size="small" fullWidth multiline rows={2}
                value={editing.notes}
                onChange={(e) => setEditing((s) => s && { ...s, notes: e.target.value })}
              />
              <Alert severity="info">
                {t('payments.payout')}: € {Math.max(0, editing.basePay + editing.bonus - editing.deductions).toFixed(2)}
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditing(null)} disabled={saving}>{t('common.cancel')}</Button>
            <Button variant="contained" onClick={() => saveEdit(editing)} disabled={saving}>
              {saving ? `${t('common.save')}…` : t('common.save')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
