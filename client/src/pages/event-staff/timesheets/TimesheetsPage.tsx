import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, Stack, Chip, CircularProgress } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useTranslation } from 'react-i18next';
import { timesheetsApi, type EventTimesheet } from '../../../api/timesheets';

function fmt(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function StaffTimesheetsPage() {
  const { t } = useTranslation();

  const STATUS_COLOR: Record<EventTimesheet['status'], 'warning' | 'success' | 'error'> = {
    pending: 'warning', approved: 'success', disputed: 'error',
  };
  const STATUS_LABEL: Record<EventTimesheet['status'], string> = {
    pending: t('status.open'),
    approved: t('status.approved'),
    disputed: t('status.disputed'),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['my-timesheets'],
    queryFn: () => timesheetsApi.myList(),
  });
  const timesheets: EventTimesheet[] = data?.data ?? [];

  const grouped = timesheets.reduce<Map<string, { name: string; date: string; items: EventTimesheet[] }>>(
    (acc, ts) => {
      if (!acc.has(ts.eventId)) acc.set(ts.eventId, { name: ts.eventName, date: ts.plannedStartTime, items: [] });
      acc.get(ts.eventId)!.items.push(ts);
      return acc;
    },
    new Map()
  );

  const totalHours = timesheets.reduce((s, ts) => s + ts.totalHours, 0);
  const totalPay   = timesheets.reduce((s, ts) => s + ts.grossPay, 0);

  if (isLoading) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" fontWeight={700} mb={2}>{t('eventStaff.timesheets.mineTitle')}</Typography>

      {timesheets.length > 0 && (
        <Card sx={{ mb: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <CardContent sx={{ py: '14px !important' }}>
            <Stack direction="row" justifyContent="space-around">
              <Box textAlign="center">
                <Typography variant="h5" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {totalHours.toFixed(1)}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>{t('eventStaff.timesheets.totalHoursLabel')}</Typography>
              </Box>
              <Box sx={{ width: 1, bgcolor: 'primary.contrastText', opacity: 0.25 }} />
              <Box textAlign="center">
                <Typography variant="h5" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  € {totalPay.toFixed(2)}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>{t('eventStaff.timesheets.totalPayLabel')}</Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      )}

      {timesheets.length === 0 && (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography color="text.secondary">{t('eventStaff.timesheets.noTimesheetsYet')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('eventStaff.timesheets.timesheetsAfterEvent')}
          </Typography>
        </Box>
      )}

      <Stack spacing={2}>
        {[...grouped.entries()].map(([eventId, group]) => {
          const groupHours = group.items.reduce((s, ts) => s + ts.totalHours, 0);
          const groupPay   = group.items.reduce((s, ts) => s + ts.grossPay, 0);
          return (
            <Card key={eventId}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                  <Box flex={1} mr={1}>
                    <Typography fontWeight={700} noWrap>{group.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(group.date).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })}
                    </Typography>
                  </Box>
                  <Box textAlign="right" flexShrink={0}>
                    <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {groupHours.toFixed(1)} h
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      € {groupPay.toFixed(2)}
                    </Typography>
                  </Box>
                </Stack>

                <Stack spacing={1}>
                  {group.items.map((ts) => (
                    <Box key={ts._id} sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box flex={1} minWidth={0}>
                          <Typography variant="body2" fontWeight={600} noWrap>{ts.positionTitle}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {t('eventStaff.timesheets.planned')} {fmt(ts.plannedStartTime)}–{fmt(ts.plannedEndTime)}
                          </Typography>
                          {ts.actualStartTime && ts.actualEndTime && (
                            <Typography variant="caption" color="success.main" display="block">
                              {t('eventStaff.timesheets.actual')} {fmt(ts.actualStartTime)}–{fmt(ts.actualEndTime)}
                            </Typography>
                          )}
                          {ts.breakTaken && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {t('eventStaff.timesheets.breakLabel')} {t('eventStaff.timesheets.breakMinutes', { min: ts.actualBreakMinutes })}
                            </Typography>
                          )}
                        </Box>
                        <Stack alignItems="flex-end" spacing={0.5} flexShrink={0} ml={1}>
                          <Chip
                            label={STATUS_LABEL[ts.status]}
                            color={STATUS_COLOR[ts.status]}
                            size="small"
                            sx={{ fontSize: 10 }}
                          />
                          <Typography variant="caption" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {ts.totalHours.toFixed(2)} h · € {ts.grossPay.toFixed(2)}
                          </Typography>
                          {ts.ratingByCoordinator && (
                            <Stack direction="row">
                              {[1, 2, 3, 4, 5].map((n) =>
                                (ts.ratingByCoordinator ?? 0) >= n
                                  ? <StarIcon key={n} sx={{ fontSize: 11, color: '#f59e0b' }} />
                                  : <StarBorderIcon key={n} sx={{ fontSize: 11, color: '#d1d5db' }} />
                              )}
                            </Stack>
                          )}
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
