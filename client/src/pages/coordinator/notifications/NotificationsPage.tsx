import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, Stack, Chip, Button, CircularProgress } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { useTranslation } from 'react-i18next';
import { notificationsApi, type Notification } from '../../../api/notifications';

const TYPE_COLORS: Record<Notification['type'], 'success' | 'primary' | 'info' | 'warning' | 'default'> = {
  assignment_confirmed: 'success',
  assignment_declined:  'warning',
  timesheet_approved:   'primary',
  payment_paid:         'info',
  general:              'default',
};

export default function NotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  });
  const notifications: Notification[] = data?.data?.notifications ?? [];
  const unread = notifications.filter((n) => !n.read).length;

  const { mutate: markRead } = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const { mutate: markAll, isPending: markingAll } = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('notifications.title')}</Typography>
          {unread > 0 && (
            <Typography variant="body2" color="text.secondary">{t('notifications.unreadCount', { count: unread })}</Typography>
          )}
        </Box>
        {unread > 0 && (
          <Button
            startIcon={<DoneAllIcon />}
            onClick={() => markAll()}
            disabled={markingAll}
            variant="outlined"
            size="small"
          >
            {t('notifications.markAllRead')}
          </Button>
        )}
      </Stack>

      {isLoading && <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>}

      {!isLoading && notifications.length === 0 && (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <NotificationsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">{t('notifications.noNotifications')}</Typography>
        </Box>
      )}

      <Stack spacing={1.5}>
        {notifications.map((n) => (
          <Card
            key={n._id}
            variant="outlined"
            sx={{
              cursor: n.read ? 'default' : 'pointer',
              borderLeft: n.read ? undefined : '3px solid',
              borderLeftColor: n.read ? undefined : 'primary.main',
              opacity: n.read ? 0.7 : 1,
              '&:hover': n.read ? {} : { bgcolor: 'action.hover' },
            }}
            onClick={() => { if (!n.read) markRead(n._id); }}
          >
            <CardContent sx={{ p: '12px !important' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box flex={1}>
                  <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                    <Chip
                      label={n.type.replace(/_/g, ' ')}
                      size="small"
                      color={TYPE_COLORS[n.type]}
                      sx={{ fontSize: 10, textTransform: 'capitalize' }}
                    />
                    {!n.read && <Chip label={t('notifications.new')} size="small" color="primary" sx={{ fontSize: 9, height: 16 }} />}
                  </Stack>
                  <Typography variant="body2" fontWeight={700}>{n.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{n.body}</Typography>
                </Box>
                <Typography variant="caption" color="text.disabled" flexShrink={0} ml={2}>
                  {new Date(n.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
