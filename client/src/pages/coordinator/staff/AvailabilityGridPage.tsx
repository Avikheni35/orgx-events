import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, IconButton, TextField, InputAdornment,
  Avatar, Tooltip, CircularProgress, Alert, Chip, Stack,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import EventIcon from '@mui/icons-material/Event';
import { useTranslation } from 'react-i18next';
import { staffAvailabilityApi, type StaffAvailabilityOverviewEntry } from '../../../api/staffAvailability';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day));
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Cell availability computation ─────────────────────────────────────────────

type CellStatus = 'available' | 'booked' | 'unavailable' | 'unknown';

interface CellInfo {
  status: CellStatus;
  timeRange?: string;
  bookings: { eventName: string; start: string; end: string }[];
}

function computeCell(
  entry: StaffAvailabilityOverviewEntry,
  date: Date,
): CellInfo {
  const avail = entry.availability;
  const iso = isoDate(date);

  // Find bookings on this day
  const bookings = entry.assignments
    .filter(a => isoDate(new Date(a.slotStart)) === iso)
    .map(a => ({
      eventName: a.eventName,
      start: new Date(a.slotStart).toLocaleTimeString('de-DE', { timeStyle: 'short' }),
      end: new Date(a.slotEnd).toLocaleTimeString('de-DE', { timeStyle: 'short' }),
    }));

  if (!avail) {
    return { status: bookings.length > 0 ? 'booked' : 'unknown', bookings };
  }

  // Check date override first
  const override = avail.dateOverrides.find(o => isoDate(new Date(o.date)) === iso);
  if (override) {
    const timeRange = override.startTime && override.endTime
      ? `${override.startTime}–${override.endTime}`
      : undefined;
    if (!override.available) return { status: 'unavailable', bookings };
    return {
      status: bookings.length > 0 ? 'booked' : 'available',
      timeRange,
      bookings,
    };
  }

  // Fall back to weekly pattern
  const dow = date.getDay();
  const slot = avail.weeklyPattern.find(s => s.dayOfWeek === dow);
  const isAvail = slot?.available ?? (dow >= 1 && dow <= 5);
  if (!isAvail) return { status: 'unavailable', bookings };

  const timeRange = slot?.startTime && slot.endTime
    ? `${slot.startTime}–${slot.endTime}`
    : undefined;

  return {
    status: bookings.length > 0 ? 'booked' : 'available',
    timeRange,
    bookings,
  };
}

// ── Cell Component ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<CellStatus, { bg: string; border: string; text: string }> = {
  available:   { bg: '#E9F5EE', border: '#A8D5B8', text: '#1B5E3B' },
  booked:      { bg: '#FEF3E7', border: '#F5C78A', text: '#7A4A00' },
  unavailable: { bg: '#F5F5F5', border: '#E0E0E0', text: '#9E9E9E' },
  unknown:     { bg: '#FAFAFA', border: '#EEEEEE', text: '#BDBDBD' },
};

function Cell({ info, isToday }: { info: CellInfo; isToday: boolean }) {
  const c = STATUS_COLORS[info.status];
  const icon =
    info.status === 'available'   ? <CheckCircleIcon sx={{ fontSize: 14 }} /> :
    info.status === 'booked'      ? <EventIcon sx={{ fontSize: 14 }} /> :
    info.status === 'unavailable' ? <EventBusyIcon sx={{ fontSize: 14 }} /> :
    null;

  return (
    <Box sx={{
      height: 60,
      borderRadius: '10px',
      bgcolor: c.bg,
      border: `1.5px solid ${isToday ? '#C17B3A' : c.border}`,
      boxShadow: isToday ? `0 0 0 2px #FEF3E7` : 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 0.25, px: 0.5,
      transition: 'transform 0.1s',
      '&:hover': { transform: 'scale(1.04)' },
    }}>
      <Box sx={{ color: c.text, display: 'flex', alignItems: 'center' }}>{icon}</Box>
      {info.timeRange && (
        <Typography sx={{ fontSize: 8, color: c.text, fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {info.timeRange}
        </Typography>
      )}
      {info.bookings.length > 0 && (
        <Typography sx={{ fontSize: 8, fontWeight: 700, color: c.text, lineHeight: 1 }} noWrap>
          {info.bookings[0].eventName.length > 10
            ? info.bookings[0].eventName.slice(0, 10) + '…'
            : info.bookings[0].eventName}
        </Typography>
      )}
      {info.bookings.length > 1 && (
        <Typography sx={{ fontSize: 7, color: c.text, lineHeight: 1 }}>
          +{info.bookings.length - 1} mehr
        </Typography>
      )}
    </Box>
  );
}

// ── Tooltip content for a cell ─────────────────────────────────────────────────

function CellTooltip({ info, dayName, staffName }: { info: CellInfo; dayName: string; staffName: string }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: 0.5, minWidth: 140 }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 0.5 }}>
        {staffName} · {dayName}
      </Typography>
      <Typography sx={{ fontSize: 11, color:
        info.status === 'available' ? '#A8D5B8' :
        info.status === 'booked' ? '#F5C78A' :
        info.status === 'unavailable' ? '#9E9E9E' : '#BDBDBD'
      }}>
        {info.status === 'available'
          ? (info.timeRange ? t('availability.availableTime', { timeRange: info.timeRange }) : t('availability.availableAllDay'))
          : info.status === 'booked'
          ? t('availability.booked')
          : info.status === 'unavailable'
          ? t('availability.unavailable')
          : t('availability.unknown')}
      </Typography>
      {info.bookings.map((b, i) => (
        <Box key={i} sx={{ mt: 0.5, pt: 0.5, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600 }}>{b.eventName}</Typography>
          <Typography sx={{ fontSize: 10, color: '#ccc' }}>{b.start} – {b.end}</Typography>
        </Box>
      ))}
    </Box>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────────

function Legend() {
  const { t } = useTranslation();
  const items: { status: CellStatus; label: string }[] = [
    { status: 'available',   label: t('availability.available') },
    { status: 'booked',      label: t('availability.booked') },
    { status: 'unavailable', label: t('availability.unavailable') },
    { status: 'unknown',     label: t('availability.unknown') },
  ];
  return (
    <Stack direction="row" spacing={1.5} flexWrap="wrap">
      {items.map(({ status, label }) => {
        const c = STATUS_COLORS[status];
        return (
          <Box key={status} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: c.bg, border: `1.5px solid ${c.border}` }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{label}</Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AvailabilityGridPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [search, setSearch] = useState('');

  const weekEnd = addDays(weekStart, 6);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data, isLoading, isError } = useQuery({
    queryKey: ['availability-overview', isoDate(weekStart)],
    queryFn: () => staffAvailabilityApi.getOverview(isoDate(weekStart), isoDate(weekEnd)),
  });

  const allStaff = data?.data?.staff ?? [];
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return allStaff;
    return allStaff.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  }, [allStaff, search]);

  const weekLabel =
    weekStart.getMonth() === weekEnd.getMonth()
      ? `${weekStart.getDate()}. – ${weekEnd.getDate()}. ${t(`availability.monthsAbbr.${weekStart.getMonth()}`)} ${weekStart.getFullYear()}`
      : `${weekStart.getDate()}. ${t(`availability.monthsAbbr.${weekStart.getMonth()}`)} – ${weekEnd.getDate()}. ${t(`availability.monthsAbbr.${weekEnd.getMonth()}`)} ${weekEnd.getFullYear()}`;

  // Summary counts for each day
  const daySummary = weekDays.map(day => {
    let avail = 0, booked = 0, unavail = 0;
    allStaff.forEach(s => {
      const c = computeCell(s, day).status;
      if (c === 'available') avail++;
      else if (c === 'booked') booked++;
      else if (c === 'unavailable') unavail++;
    });
    return { avail, booked, unavail };
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>{t('availability.overviewTitle')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('availability.overviewSubtitle')}
        </Typography>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3, alignItems: 'center' }}>
        {/* Week nav */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: 'background.paper', borderRadius: 2, px: 1.5, py: 0.75,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <IconButton size="small" onClick={() => setWeekStart(w => addDays(w, -7))}>
            <ChevronLeftIcon />
          </IconButton>
          <Box sx={{ textAlign: 'center', minWidth: 200 }}>
            <Typography variant="body2" fontWeight={700}>{weekLabel}</Typography>
          </Box>
          <IconButton size="small" onClick={() => setWeekStart(getMondayOf(new Date()))}>
            <TodayIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => setWeekStart(w => addDays(w, 7))}>
            <ChevronRightIcon />
          </IconButton>
        </Box>

        {/* Search */}
        <TextField
          size="small"
          placeholder={t('availability.gridSearchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
          sx={{ width: 240, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />

        <Box sx={{ flex: 1 }} />
        <Legend />
      </Box>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>{t('availability.loadFailed')}</Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          {/* Grid header */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: '180px repeat(7, 1fr)',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}>
            {/* Staff column header */}
            <Box sx={{ px: 2, py: 1.5, borderRight: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'text.secondary' }}>
                {t('staff.title')} ({filtered.length})
              </Typography>
            </Box>

            {/* Day column headers */}
            {weekDays.map((day, i) => {
              const isToday = isoDate(day) === isoDate(today);
              const s = daySummary[i];
              return (
                <Box key={i} sx={{
                  px: 1, py: 1.5, textAlign: 'center',
                  borderRight: i < 6 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  bgcolor: isToday ? 'action.selected' : 'transparent',
                }}>
                  <Typography sx={{
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    color: isToday ? 'primary.main' : 'text.secondary',
                    letterSpacing: '0.06em',
                  }}>
                    {t(`availability.days.${day.getDay()}`)}
                  </Typography>
                  <Typography sx={{
                    fontSize: 18, fontWeight: 800, lineHeight: 1.1,
                    color: isToday ? 'primary.main' : 'text.primary',
                  }}>
                    {day.getDate()}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.25 }}>
                    {t(`availability.monthsAbbr.${day.getMonth()}`)}
                  </Typography>
                  {allStaff.length > 0 && (
                    <Stack direction="row" spacing={0.5} justifyContent="center" mt={0.5}>
                      <Chip
                        size="small"
                        label={s.avail}
                        sx={{ height: 16, fontSize: 9, bgcolor: '#E9F5EE', color: '#1B5E3B', '& .MuiChip-label': { px: 0.75 } }}
                      />
                      {s.booked > 0 && (
                        <Chip
                          size="small"
                          label={s.booked}
                          sx={{ height: 16, fontSize: 9, bgcolor: '#FEF3E7', color: '#7A4A00', '& .MuiChip-label': { px: 0.75 } }}
                        />
                      )}
                    </Stack>
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Staff rows */}
          {filtered.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {search ? t('availability.noStaffFoundInGrid') : t('availability.noStaffInGrid')}
              </Typography>
            </Box>
          ) : (
            filtered.map((staff, rowIdx) => (
              <Box
                key={staff.profileId}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '180px repeat(7, 1fr)',
                  borderBottom: rowIdx < filtered.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                {/* Staff name cell */}
                <Box
                  onClick={() => navigate(`/coordinator/staff/${staff.profileId}`)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 2, py: 1.5, cursor: 'pointer',
                    borderRight: '1px solid', borderColor: 'divider',
                  }}
                >
                  <Avatar
                    src={staff.photoUrl}
                    sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'primary.light' }}
                  >
                    {staff.firstName[0]}{staff.lastName[0]}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }} noWrap>
                      {staff.firstName} {staff.lastName}
                    </Typography>
                    {!staff.availability && (
                      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                        {t('availability.unknown')}
                      </Typography>
                    )}
                  </Box>
                </Box>

                {/* Day cells */}
                {weekDays.map((day, colIdx) => {
                  const info = computeCell(staff, day);
                  const isToday = isoDate(day) === isoDate(today);
                  return (
                    <Box key={colIdx} sx={{
                      p: 0.75,
                      borderRight: colIdx < 6 ? '1px solid' : 'none',
                      borderColor: 'divider',
                      bgcolor: isToday ? 'action.selected' : 'transparent',
                    }}>
                      <Tooltip
                        title={
                          <CellTooltip
                            info={info}
                            dayName={t(`availability.daysFull.${day.getDay()}`)}
                            staffName={`${staff.firstName} ${staff.lastName}`}
                          />
                        }
                        arrow
                        placement="top"
                      >
                        <Box>
                          <Cell info={info} isToday={isToday} />
                        </Box>
                      </Tooltip>
                    </Box>
                  );
                })}
              </Box>
            ))
          )}
        </Box>
      )}
    </Box>
  );
}
