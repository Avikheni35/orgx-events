import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function UnauthorizedPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2 }}>
      <Typography variant="h1" fontWeight={700} color="error">403</Typography>
      <Typography variant="h6">{t('errors.unauthorized')}</Typography>
      <Button variant="contained" onClick={() => navigate('/')}>{t('errors.goHome')}</Button>
    </Box>
  );
}
