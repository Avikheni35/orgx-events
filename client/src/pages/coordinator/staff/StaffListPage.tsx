import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Card, Table, TableHead, TableRow, TableCell, TableBody, Chip, Stack, TablePagination, Rating, TextField, InputAdornment } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { staffProfilesApi } from '../../../api/staffProfiles';

export default function StaffListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['staff-profiles', page, search],
    queryFn: () => staffProfilesApi.list({ page: String(page + 1), limit: '20', ...(search ? { search } : {}) }),
  });
  const profiles = data?.data?.profiles ?? [];
  const total = data?.data?.total ?? 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>{t('staff.title')}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/coordinator/staff/new')}>{t('staff.new')}</Button>
      </Stack>
      <Card sx={{ mb: 2, p: 2 }}>
        <TextField size="small" placeholder={t('staff.searchPlaceholder')} value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput); setPage(0); } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ minWidth: 280 }}
        />
      </Card>
      <Card>
        <Table>
          <TableHead><TableRow>
            <TableCell>{t('common.name')}</TableCell>
            <TableCell>{t('common.email')}</TableCell>
            <TableCell>{t('staff.skills')}</TableCell>
            <TableCell align="right">{t('staff.eventsWorked')}</TableCell>
            <TableCell>{t('staff.rating')}</TableCell>
            <TableCell>{t('common.status')}</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} align="center">{t('common.loading')}</TableCell></TableRow>}
            {!isLoading && profiles.length === 0 && <TableRow><TableCell colSpan={6} align="center">{t('staff.noStaff')}</TableCell></TableRow>}
            {profiles.map((p) => (
              <TableRow key={p._id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/coordinator/staff/${p._id}`)}>
                <TableCell><Typography fontWeight={600}>{p.firstName} {p.lastName}</Typography></TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {p.skills.slice(0, 3).map((s) => <Chip key={s} label={s} size="small" variant="outlined" />)}
                    {p.skills.length > 3 && <Chip label={`+${p.skills.length - 3}`} size="small" />}
                  </Stack>
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{p.totalEventsWorked}</TableCell>
                <TableCell><Rating value={p.rating.average} precision={0.5} readOnly size="small" /></TableCell>
                <TableCell><Chip label={p.status === 'active' ? t('status.active') : t('status.inactive')} color={p.status === 'active' ? 'success' : 'default'} size="small" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination component="div" count={total} page={page} rowsPerPage={20} onPageChange={(_, p) => setPage(p)} rowsPerPageOptions={[20]} />
      </Card>
    </Box>
  );
}
