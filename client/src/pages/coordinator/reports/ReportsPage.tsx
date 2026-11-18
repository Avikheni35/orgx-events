import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Typography, Card, CardContent, Stack, Grid, Chip, Tabs, Tab,
  Table, TableHead, TableRow, TableCell, TableBody, FormControl,
  InputLabel, Select, MenuItem, CircularProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { paymentsApi } from '../../../api/payments';
import { eventsApi } from '../../../api/events';
import { timesheetsApi } from '../../../api/timesheets';

const now = new Date();

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent sx={{ py: 2 }}>
        <Typography variant="h4" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        {sub && <Typography variant="caption" color="text.disabled">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

function PaymentStatusChip({ status, paidHours, totalHours }: { status: string; paidHours?: number; totalHours?: number }) {
  const { t } = useTranslation();
  if (status === 'paid' && paidHours != null && totalHours != null && paidHours < totalHours) {
    return <Chip label={t('payments.partiallyPaid')} size="small" sx={{ fontSize: 10, bgcolor: '#E65100', color: '#fff', fontWeight: 600 }} />;
  }
  return <Chip label={status === 'paid' ? t('status.paid') : t('status.open')} color={status === 'paid' ? 'success' : 'warning'} size="small" sx={{ fontSize: 10 }} />;
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const [tab,   setTab]   = useState(0);
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  // ── Tab 0: Monthly payments ──────────────────────────────────────────────────
  const { data: payData, isLoading: payLoading } = useQuery({
    queryKey: ['payments-report', year, month],
    queryFn: () => paymentsApi.list({ year, month }),
    enabled: tab === 0,
  });
  const payments = payData?.data?.payments ?? [];

  const totalHours    = payments.reduce((s, p) => s + p.totalHoursWorked, 0);
  const totalPay      = payments.reduce((s, p) => s + p.totalAmount, 0);
  const totalBonus    = payments.reduce((s, p) => s + p.bonus, 0);
  const paidCount     = payments.filter((p) => p.status === 'paid').length;
  const partialCount  = payments.filter((p) => p.status === 'paid' && p.paidHours != null && p.totalHours != null && p.paidHours < p.totalHours).length;

  // ── Tab 1: Event overview ────────────────────────────────────────────────────
  const { data: evData, isLoading: evLoading } = useQuery({
    queryKey: ['events-report', year],
    queryFn: () => eventsApi.list({ limit: '200' }),
    enabled: tab === 1,
  });
  const events = (evData?.data?.events ?? []).filter((ev) => new Date(ev.startDate).getFullYear() === year);

  // ── Tab 2: Timesheet summary ─────────────────────────────────────────────────
  const { data: tsData, isLoading: tsLoading } = useQuery({
    queryKey: ['ts-report', year, month],
    queryFn: () => timesheetsApi.list({ limit: '500' }),
    enabled: tab === 2,
  });
  const allTs = tsData?.data?.timesheets ?? [];
  const monthTs = allTs.filter((t) => {
    const d = new Date(t.plannedStartTime);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const tsHours    = monthTs.reduce((s, t) => s + t.totalHours, 0);
  const tsPay      = monthTs.reduce((s, t) => s + t.grossPay, 0);
  const tsApproved = monthTs.filter((t) => t.status === 'approved').length;

  const MonthYearPicker = () => (
    <Stack direction="row" spacing={2}>
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
    </Stack>
  );

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('reports.title')}</Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={t('reports.monthlyPayments')} />
        <Tab label={t('reports.eventSummary')} />
        <Tab label={t('timesheets.title')} />
      </Tabs>

      {/* ── Tab 0: Monthly staff payments ──────────────────────────────────── */}
      {tab === 0 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
            <Typography variant="h6" color="text.secondary">{t(`reports.months.${month}`)} {year}</Typography>
            <MonthYearPicker />
          </Stack>

          <Grid container spacing={2} mb={3}>
            <Grid item xs={6} sm={3}>
              <StatCard label={t('staff.title')} value={String(payments.length)} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard label={t('reports.totalHours')} value={`${totalHours.toFixed(1)} h`} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard
                label={t('payments.totalPay')}
                value={`€ ${totalPay.toFixed(2)}`}
                sub={totalBonus > 0 ? `inkl. € ${totalBonus.toFixed(2)} Bonus` : undefined}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatCard
                label={t('status.paid')}
                value={`${paidCount} / ${payments.length}`}
                sub={partialCount > 0 ? `${partialCount} Teilzahlung(en)` : undefined}
              />
            </Grid>
          </Grid>

          {payLoading && <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>}
          {!payLoading && payments.length === 0 && (
            <Typography color="text.secondary" textAlign="center" py={4}>
              {t('payments.noPayments')}
            </Typography>
          )}

          {payments.length > 0 && (
            <Card>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12 } }}>
                      <TableCell>{t('staff.title')}</TableCell>
                      <TableCell align="right">{t('timesheets.hours')}</TableCell>
                      <TableCell align="right">{t('events.title')}</TableCell>
                      <TableCell align="right">{t('payments.amount')}</TableCell>
                      <TableCell align="right">{t('payments.bonus')}</TableCell>
                      <TableCell align="right">{t('timesheets.hours')}</TableCell>
                      <TableCell align="right">{t('invoices.total')}</TableCell>
                      <TableCell align="right">{t('payments.totalHours')}</TableCell>
                      <TableCell>{t('common.status')}</TableCell>
                      <TableCell>{t('payments.paymentDate')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p._id} hover>
                        <TableCell><Typography variant="body2" fontWeight={600}>{p.staffName}</Typography></TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{p.totalHoursWorked.toFixed(2)}</TableCell>
                        <TableCell align="right">{p.totalEventsWorked}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {p.basePay.toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: p.bonus > 0 ? 'success.main' : 'text.disabled' }}>
                          {p.bonus > 0 ? `+ € ${p.bonus.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: p.deductions > 0 ? 'error.main' : 'text.disabled' }}>
                          {p.deductions > 0 ? `- € ${p.deductions.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>€ {p.totalAmount.toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                          {p.paidHours != null && p.totalHours != null ? (
                            <Typography variant="caption" fontWeight={600}
                              sx={{ color: p.paidHours < p.totalHours ? '#E65100' : 'success.main' }}>
                              {p.paidHours.toFixed(2)} / {p.totalHours.toFixed(2)} h
                            </Typography>
                          ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell>
                          <PaymentStatusChip status={p.status} paidHours={p.paidHours} totalHours={p.totalHours} />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {fmtDate(p.paidAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'action.hover', '& td': { fontWeight: 700 } }}>
                      <TableCell>{t('invoices.total')}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{totalHours.toFixed(2)} h</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'success.main' }}>
                        {totalBonus > 0 ? `+ € ${totalBonus.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell />
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {totalPay.toFixed(2)}</TableCell>
                      <TableCell />
                      <TableCell>
                        <Chip label={`${paidCount}/${payments.length} ${t('status.paid').toLowerCase()}`} size="small" color="success" sx={{ fontSize: 10 }} />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>
            </Card>
          )}
        </Box>
      )}

      {/* ── Tab 1: Event overview ──────────────────────────────────────────── */}
      {tab === 1 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
            <Typography variant="h6" color="text.secondary">{t('events.title')} {year}</Typography>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>{t('reports.year')}</InputLabel>
              <Select value={year} label={t('reports.year')} onChange={(e) => setYear(Number(e.target.value))}>
                {yearOptions.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>

          <Grid container spacing={2} mb={3}>
            <Grid item xs={6} sm={3}><StatCard label={t('events.title')} value={String(events.length)} /></Grid>
            <Grid item xs={6} sm={3}><StatCard label={t('eventClient.completedTab')} value={String(events.filter((e) => e.status === 'completed').length)} /></Grid>
            <Grid item xs={6} sm={3}><StatCard label={t('status.confirmed')} value={String(events.filter((e) => e.status === 'confirmed').length)} /></Grid>
            <Grid item xs={6} sm={3}><StatCard label={t('status.cancelled')} value={String(events.filter((e) => e.status === 'cancelled').length)} /></Grid>
          </Grid>

          {evLoading && <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>}

          <Card>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12 } }}>
                    <TableCell>{t('events.title')}</TableCell>
                    <TableCell>{t('events.client')}</TableCell>
                    <TableCell>{t('common.date')}</TableCell>
                    <TableCell align="right">{t('events.positions')}</TableCell>
                    <TableCell>{t('common.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        {t('events.noEvents')}
                      </TableCell>
                    </TableRow>
                  )}
                  {events.map((ev) => (
                    <TableRow key={ev._id} hover>
                      <TableCell><Typography variant="body2" fontWeight={600}>{ev.name}</Typography></TableCell>
                      <TableCell>{ev.clientName}</TableCell>
                      <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {new Date(ev.startDate).toLocaleDateString('de-DE')}
                      </TableCell>
                      <TableCell align="right">{ev.positions?.length ?? 0}</TableCell>
                      <TableCell>
                        <Chip label={ev.status} size="small" sx={{ fontSize: 10 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Card>
        </Box>
      )}

      {/* ── Tab 2: Timesheets summary ──────────────────────────────────────── */}
      {tab === 2 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
            <Typography variant="h6" color="text.secondary">{t('timesheets.title')} {t(`reports.months.${month}`)} {year}</Typography>
            <MonthYearPicker />
          </Stack>

          <Grid container spacing={2} mb={3}>
            <Grid item xs={6} sm={3}><StatCard label={t('timesheets.title')} value={String(monthTs.length)} /></Grid>
            <Grid item xs={6} sm={3}><StatCard label={t('reports.totalHours')} value={`${tsHours.toFixed(1)} h`} /></Grid>
            <Grid item xs={6} sm={3}><StatCard label={t('timesheets.gross')} value={`€ ${tsPay.toFixed(2)}`} /></Grid>
            <Grid item xs={6} sm={3}><StatCard label={t('status.approved')} value={`${tsApproved} / ${monthTs.length}`} /></Grid>
          </Grid>

          {tsLoading && <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>}
          {!tsLoading && monthTs.length === 0 && (
            <Typography color="text.secondary" textAlign="center" py={4}>
              {t('timesheets.noTimesheets')}
            </Typography>
          )}

          {monthTs.length > 0 && (
            <Card>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 12 } }}>
                      <TableCell>{t('timesheets.employee')}</TableCell>
                      <TableCell>{t('events.title')}</TableCell>
                      <TableCell>{t('timesheets.position')}</TableCell>
                      <TableCell align="right">{t('timesheets.hours')}</TableCell>
                      <TableCell align="right">{t('timesheets.gross')}</TableCell>
                      <TableCell>{t('timesheets.accounting')}</TableCell>
                      <TableCell>{t('common.status')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthTs.map((ts) => (
                      <TableRow key={ts._id} hover>
                        <TableCell><Typography variant="body2" fontWeight={600}>{ts.staffName}</Typography></TableCell>
                        <TableCell>{ts.eventName}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{ts.positionTitle}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{ts.totalHours.toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {ts.grossPay.toFixed(2)}</TableCell>
                        <TableCell>
                          {ts.syncStatus === 'synced'  && <Chip label={t('timesheets.synced')}  color="success" size="small" sx={{ fontSize: 10 }} />}
                          {ts.syncStatus === 'pending' && <Chip label={t('status.pending')} color="info"    size="small" sx={{ fontSize: 10 }} />}
                          {ts.syncStatus === 'failed'  && <Chip label={t('timesheets.syncError')}     color="error"   size="small" sx={{ fontSize: 10 }} />}
                          {(!ts.syncStatus || ts.syncStatus === 'not_configured') && <Typography variant="caption" color="text.disabled">—</Typography>}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ts.status === 'approved' ? t('status.approved') : ts.status === 'pending' ? t('status.open') : t('status.disputed')}
                            size="small"
                            color={ts.status === 'approved' ? 'success' : ts.status === 'pending' ? 'warning' : 'error'}
                            sx={{ fontSize: 10 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: 'action.hover', '& td': { fontWeight: 700 } }}>
                      <TableCell colSpan={3}>{t('invoices.total')}</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{tsHours.toFixed(2)} h</TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>€ {tsPay.toFixed(2)}</TableCell>
                      <TableCell />
                      <TableCell>
                        <Chip label={`${tsApproved}/${monthTs.length} ${t('status.approved').toLowerCase()}`} size="small" color="success" sx={{ fontSize: 10 }} />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
}
