import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItemButton,
  ListItemIcon, ListItemText, IconButton, Divider, Avatar, Chip, Badge, Stack, Button,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventIcon from '@mui/icons-material/Event';
import BusinessIcon from '@mui/icons-material/Business';
import PlaceIcon from '@mui/icons-material/Place';
import PeopleIcon from '@mui/icons-material/People';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PaymentsIcon from '@mui/icons-material/Payments';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AssessmentIcon from '@mui/icons-material/Assessment';
import MenuIcon from '@mui/icons-material/Menu';
import LinkIcon from '@mui/icons-material/Link';
import TuneIcon from '@mui/icons-material/Tune';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/auth';
import { notificationsApi } from '../api/notifications';

const DRAWER_WIDTH = 240;

export default function CoordinatorLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();

  const NAV = [
    { key: 'nav.dashboard',        icon: <DashboardIcon />,     path: '/coordinator/dashboard' },
    { key: 'nav.events',           icon: <EventIcon />,          path: '/coordinator/events' },
    { key: 'nav.clients',          icon: <BusinessIcon />,       path: '/coordinator/clients' },
    { key: 'nav.venues',           icon: <PlaceIcon />,          path: '/coordinator/venues' },
    { key: 'nav.staff',            icon: <PeopleIcon />,         path: '/coordinator/staff' },
    { key: 'nav.availability',     icon: <CalendarMonthIcon />,  path: '/coordinator/staff/availability' },
    { key: 'nav.pools',            icon: <GroupWorkIcon />,      path: '/coordinator/pools' },
    { key: 'nav.timesheets',       icon: <AccessTimeIcon />,     path: '/coordinator/timesheets' },
    { key: 'nav.payments',         icon: <PaymentsIcon />,       path: '/coordinator/payments' },
    { key: 'nav.reports',          icon: <AssessmentIcon />,     path: '/coordinator/reports' },
    { key: 'nav.templates',        icon: <ContentCopyIcon />,    path: '/coordinator/templates' },
    { key: 'nav.notifications',    icon: null,                   path: '/coordinator/notifications' },
    { key: 'nav.users',            icon: <PeopleIcon />,         path: '/coordinator/settings/users' },
    { key: 'nav.features',         icon: <TuneIcon />,           path: '/coordinator/settings/features' },
    { key: 'nav.integrations',     icon: <LinkIcon />,           path: '/coordinator/settings/integrations' },
  ];

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 30_000,
  });
  const unreadCount = countData?.data?.count ?? 0;

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    logout();
    navigate('/login');
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <EventIcon color="primary" />
        <Typography variant="h6" fontWeight={700} color="primary">M2 Events</Typography>
      </Box>
      <Divider />
      <List sx={{ flex: 1, pt: 1 }}>
        {NAV.map((item) => {
          const isNotif = item.path === '/coordinator/notifications';
          const icon = isNotif
            ? <Badge badgeContent={unreadCount || undefined} color="error" max={99}><NotificationsIcon /></Badge>
            : item.icon;
          return (
            <ListItemButton
              key={item.path}
              selected={pathname.startsWith(item.path)}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
              sx={{ borderRadius: 1, mx: 1, mb: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
              <ListItemText primary={t(item.key)} />
            </ListItemButton>
          );
        })}
      </List>
      <Divider />
      {/* Language switcher */}
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Stack direction="row" spacing={0.5}>
          <Button
            size="small"
            variant={i18n.language === 'de' ? 'contained' : 'outlined'}
            onClick={() => i18n.changeLanguage('de')}
            sx={{ minWidth: 0, px: 1.5, fontSize: 11 }}
          >DE</Button>
          <Button
            size="small"
            variant={i18n.language === 'en' ? 'contained' : 'outlined'}
            onClick={() => i18n.changeLanguage('en')}
            sx={{ minWidth: 0, px: 1.5, fontSize: 11 }}
          >EN</Button>
        </Stack>
      </Box>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>{user?.firstName} {user?.lastName}</Typography>
          <Chip label={user?.role} size="small" sx={{ fontSize: 10, height: 16 }} />
        </Box>
        <IconButton size="small" onClick={handleLogout} title={t('common.logout')}>
          <MenuIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ display: { sm: 'none' }, zIndex: (th) => th.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6">M2 Events</Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
        open
      >
        {drawer}
      </Drawer>
      <Box component="main" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', ml: { sm: `${DRAWER_WIDTH}px` }, p: 3, mt: { xs: 7, sm: 0 } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
