import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItemButton,
  ListItemIcon, ListItemText, IconButton, Divider, Avatar, Chip, Stack, Button,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EventIcon from '@mui/icons-material/Event';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PersonIcon from '@mui/icons-material/Person';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../api/auth';

const DRAWER_WIDTH = 240;

export default function EventClientLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();

  const NAV = [
    { key: 'nav.dashboard', icon: <DashboardIcon />, path: '/event-client/dashboard' },
    { key: 'nav.events',    icon: <EventIcon />,     path: '/event-client/events' },
    { key: 'nav.invoices',  icon: <ReceiptIcon />,   path: '/event-client/invoices' },
    { key: 'nav.profile',   icon: <PersonIcon />,    path: '/event-client/profile' },
  ];

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    logout();
    navigate('/login');
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <EventIcon color="secondary" />
        <Typography variant="h6" fontWeight={700} color="secondary">{t('eventClient.portal')}</Typography>
      </Box>
      <Divider />
      <List sx={{ flex: 1, pt: 1 }}>
        {NAV.map((item) => (
          <ListItemButton
            key={item.path}
            selected={pathname.startsWith(item.path)}
            onClick={() => { navigate(item.path); setMobileOpen(false); }}
            sx={{ borderRadius: 1, mx: 1, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={t(item.key)} />
          </ListItemButton>
        ))}
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
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 14 }}>
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>{user?.firstName} {user?.lastName}</Typography>
          <Chip label="Client" size="small" sx={{ fontSize: 10, height: 16 }} />
        </Box>
        <IconButton size="small" onClick={handleLogout} title={t('auth.logout')}><LogoutIcon fontSize="small" /></IconButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ display: { sm: 'none' }, zIndex: (th) => th.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)}><MenuIcon /></IconButton>
          <Typography variant="h6">{t('eventClient.portal')}</Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >{drawer}</Drawer>
      <Drawer
        variant="permanent"
        sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
        open
      >{drawer}</Drawer>
      <Box component="main" sx={{ flex: 1, ml: { sm: `${DRAWER_WIDTH}px` }, p: 3, mt: { xs: 7, sm: 0 } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
