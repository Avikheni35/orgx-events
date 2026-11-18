import { Box, Typography, Button } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import { useTranslation } from 'react-i18next';

export default function MaintenancePage() {
  const { t } = useTranslation();
  return (
    <Box
      minHeight="100vh"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={3}
      sx={{ bgcolor: 'background.default', px: 3, textAlign: 'center' }}
    >
      <BuildIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
      <Box>
        <Typography variant="h4" fontWeight={800} gutterBottom>{t('errors.maintenance')}</Typography>
        <Typography variant="body1" color="text.secondary" maxWidth={440}>{t('errors.maintenanceDesc')}</Typography>
      </Box>
      <Button variant="outlined" onClick={() => window.location.reload()}>{t('errors.reload')}</Button>
    </Box>
  );
}
