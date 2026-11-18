import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Box, BottomNavigation, BottomNavigationAction, Paper, Avatar, Typography, Stack, IconButton, Tooltip, Badge, Button } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import EventIcon from '@mui/icons-material/Event';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PersonIcon from '@mui/icons-material/Person';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/auth';
import { notificationsApi } from '../api/notifications';

export default function EventStaffLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();

  const NAV = [
    { key: 'nav.home',         icon: <HomeIcon />,          path: '/event-staff/home' },
    { key: 'nav.events',       icon: <EventIcon />,          path: '/event-staff/events' },
    { key: 'nav.assignments',  icon: <AssignmentIcon />,     path: '/event-staff/assignments' },
    { key: 'nav.hours',        icon: <AccessTimeIcon />,     path: '/event-staff/timesheets' },
    { key: 'nav.available',    icon: <CalendarMonthIcon />,  path: '/event-staff/availability' },
    { key: 'nav.profile',      icon: <PersonIcon />,         path: '/event-staff/profile' },
  ];

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 30_000,
  });
  const unreadCount = countData?.data?.count ?? 0;

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    navigate('/event-staff/login', { replace: true });
  };

  const activeIdx = NAV.findIndex((n) => pathname.startsWith(n.path));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh', maxWidth: 480, mx: 'auto' }}>
      {/* Top bar */}
      <Box sx={{
        px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider',
        bgcolor: 'background.paper', flexShrink: 0,
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 13, fontWeight: 700 }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={700} lineHeight={1.2}>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary">Event Staff</Typography>
          </Box>
          {/* Language switcher */}
          <Stack direction="row" spacing={0.25}>
            <Button
              size="small"
              variant={i18n.language === 'de' ? 'contained' : 'text'}
              onClick={() => i18n.changeLanguage('de')}
              sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 10 }}
            >DE</Button>
            <Button
              size="small"
              variant={i18n.language === 'en' ? 'contained' : 'text'}
              onClick={() => i18n.changeLanguage('en')}
              sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 10 }}
            >EN</Button>
          </Stack>
          <Tooltip title={t('nav.notifications')}>
            <IconButton size="small" onClick={() => navigate('/event-staff/notifications')} sx={{ color: 'text.secondary' }}>
              <Badge badgeContent={unreadCount || undefined} color="error" max={99}>
                <NotificationsIcon fontSize="small" />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title={t('auth.logout')}>
            <IconButton size="small" onClick={handleLogout} sx={{ color: 'text.secondary' }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Page content */}
      <Box sx={{ flex: 1, overflow: 'auto', pb: 7 }}>
        <Outlet />
      </Box>

      {/* Bottom navigation */}
      <Paper
        elevation={8}
        sx={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, zIndex: 100 }}
      >
        <BottomNavigation value={activeIdx} onChange={(_, v) => navigate(NAV[v].path)} showLabels>
          {NAV.map((n) => (
            <BottomNavigationAction key={n.path} label={t(n.key)} icon={n.icon} sx={{ minWidth: 0 }} />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
