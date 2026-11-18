import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Card, Table, TableHead, TableRow, TableCell, TableBody, Chip, Tabs, Tab, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { eventClientPortalApi } from '../../api/eventClientPortal';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'primary' | 'success' | 'error'> = {
  draft: 'default', planning: 'info', staffing: 'warning', confirmed: 'primary',
  in_progress: 'primary', completed: 'success', cancelled: 'error',
};

export default function EventClientEventsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tabIdx, setTabIdx] = useState(0);

  const TABS = [
    { label: t('common.all'), status: undefined },
    { label: t('eventClient.upcomingTab'), status: 'confirmed' },
    { label: t('eventClient.completedTab'), status: 'completed' },
    { label: t('eventClient.cancelledTab'), status: 'cancelled' },
  ];

  const statusLabels: Record<string, string> = {
    draft: t('eventClient.statusLabels.draft'),
    planning: t('eventClient.statusLabels.planning'),
    staffing: t('eventClient.statusLabels.staffing'),
    confirmed: t('eventClient.statusLabels.confirmed'),
    in_progress: t('eventClient.statusLabels.in_progress'),
    completed: t('eventClient.statusLabels.completed'),
    cancelled: t('eventClient.statusLabels.cancelled'),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['ec-events', tabIdx],
    queryFn: () => eventClientPortalApi.listEvents(TABS[tabIdx].status ? { status: TABS[tabIdx].status! } : {}),
  });
  const events = data?.data?.events ?? [];

  const totalWorkers = (e: typeof events[0]) => e.positions?.reduce((s: number, p: { headcount: number }) => s + p.headcount, 0) ?? 0;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('eventClient.myInvoices').replace(t('eventClient.myInvoices'), t('nav.events'))}</Typography>
      <Tabs value={tabIdx} onChange={(_, v) => setTabIdx(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        {TABS.map((tab) => <Tab key={tab.label} label={tab.label} />)}
      </Tabs>
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('eventClient.eventName')}</TableCell>
              <TableCell>{t('common.date')}</TableCell>
              <TableCell>{t('events.venue')}</TableCell>
              <TableCell align="right">{t('eventClient.workers')}</TableCell>
              <TableCell>{t('common.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} align="center">{t('common.loading')}</TableCell></TableRow>}
            {!isLoading && events.length === 0 && <TableRow><TableCell colSpan={5} align="center">{t('eventClient.noEvents')}</TableCell></TableRow>}
            {events.map((e) => (
              <TableRow key={e._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/event-client/events/${e._id}`)}>
                <TableCell>
                  <Typography fontWeight={600}>{e.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{e.eventNumber}</Typography>
                </TableCell>
                <TableCell>
                  <Stack>
                    <Typography variant="body2">{new Date(e.startDate).toLocaleDateString()}</Typography>
                    {e.startDate !== e.endDate && (
                      <Typography variant="caption" color="text.secondary">
                        {t('eventClient.untilDate', { date: new Date(e.endDate).toLocaleDateString() })}
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell>{e.venueName ?? '—'}</TableCell>
                <TableCell align="right">{totalWorkers(e)}</TableCell>
                <TableCell><Chip label={statusLabels[e.status] ?? e.status} color={STATUS_COLORS[e.status] ?? 'default'} size="small" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Box>
  );
}
