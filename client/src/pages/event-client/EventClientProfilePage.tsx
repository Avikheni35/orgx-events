import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Card, CardContent, Stack, Chip, Divider, Button, Alert } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import { useTranslation } from 'react-i18next';
import { eventClientPortalApi } from '../../api/eventClientPortal';

export default function EventClientProfilePage() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({ queryKey: ['ec-me'], queryFn: () => eventClientPortalApi.me() });
  const client = data?.data;

  if (isLoading) return <Box sx={{ p: 3 }}>{t('common.loading')}</Box>;
  if (error || !client) return <Box sx={{ p: 3 }}><Alert severity="error">{t('eventClient.profileNotAvailable')}</Alert></Box>;

  const addr = client.address;
  const addrLine = [addr?.street, [addr?.postalCode, addr?.city].filter(Boolean).join(' '), addr?.country !== 'DE' ? addr?.country : undefined].filter(Boolean).join(', ');
  const primaryContact = client.contacts.find((c) => c.isPrimary) ?? client.contacts[0];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>{t('eventClient.companyProfile')}</Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box>
              <Typography variant="h6" fontWeight={700}>{client.name}</Typography>
              <Stack direction="row" spacing={1} mt={0.5}>
                <Chip
                  label={client.type === 'company' ? t('eventClient.company') : t('eventClient.individual')}
                  size="small"
                  variant="outlined"
                />
                {client.industry && <Chip label={client.industry} size="small" variant="outlined" />}
                <Chip
                  label={client.status === 'active' ? t('status.active') : t('status.inactive')}
                  color={client.status === 'active' ? 'success' : 'default'}
                  size="small"
                />
              </Stack>
            </Box>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1.5}>
            {addrLine && (
              <Box>
                <Typography variant="caption" color="text.secondary">{t('common.address')}</Typography>
                <Typography variant="body2">{addrLine}</Typography>
              </Box>
            )}
            {client.vatId && (
              <Box>
                <Typography variant="caption" color="text.secondary">{t('eventClient.vatId')}</Typography>
                <Typography variant="body2">{client.vatId}</Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">{t('eventClient.paymentTerms')}</Typography>
              <Typography variant="body2">{client.paymentTermsDays ?? 30} {t('eventClient.days')}</Typography>
            </Box>
            {client.notes && (
              <Box>
                <Typography variant="caption" color="text.secondary">{t('common.notes')}</Typography>
                <Typography variant="body2">{client.notes}</Typography>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {client.contacts.length > 0 && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} mb={2}>{t('eventClient.contacts')}</Typography>
            {client.contacts.map((c) => (
              <Stack key={c._id} direction="row" justifyContent="space-between" alignItems="flex-start"
                sx={{ mb: 1.5, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { border: 0, mb: 0, pb: 0 } }}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                    {c.isPrimary && <Chip label={t('eventClient.primary')} size="small" color="primary" />}
                  </Stack>
                  {c.jobTitle && <Typography variant="caption" color="text.secondary">{c.jobTitle}</Typography>}
                  <Typography variant="body2">{c.email}</Typography>
                  {c.phone && <Typography variant="body2" color="text.secondary">{c.phone}</Typography>}
                </Box>
                <Button size="small" startIcon={<EmailIcon />} href={`mailto:${c.email}`} sx={{ ml: 2 }}>
                  E-Mail
                </Button>
              </Stack>
            ))}
          </CardContent>
        </Card>
      )}

      {primaryContact && (
        <Card>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={600} mb={1}>{t('eventClient.contactUs')}</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {t('eventClient.contactText')}
            </Typography>
            <Button variant="outlined" startIcon={<EmailIcon />} href={`mailto:${primaryContact.email}`}>
              {t('eventClient.contactAction', { name: primaryContact.name })}
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
