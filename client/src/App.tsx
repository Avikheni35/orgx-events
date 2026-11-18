import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuthStore } from './stores/authStore';
import { authApi } from './api/auth';
import apiClient, { setApiToken } from './api/client';
import ProtectedRoute from './components/ProtectedRoute';
import CoordinatorLayout from './layouts/CoordinatorLayout';
import EventStaffLayout from './layouts/EventStaffLayout';
import EventClientLayout from './layouts/EventClientLayout';

import LoginPage from './pages/auth/LoginPage';
import MagicLoginPage from './pages/auth/MagicLoginPage';
import NotFoundPage from './pages/NotFoundPage';
import MaintenancePage from './pages/MaintenancePage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import ImpressumPage from './pages/legal/ImpressumPage';
import DatenschutzPage from './pages/legal/DatenschutzPage';
import AgbPage from './pages/legal/AgbPage';

// Coordinator pages
import CoordinatorDashboardPage from './pages/coordinator/DashboardPage';
import EventListPage from './pages/coordinator/events/EventListPage';
import CreateEventPage from './pages/coordinator/events/CreateEventPage';
import EventDetailPage from './pages/coordinator/events/EventDetailPage';
import WorkforceSheetPage from './pages/coordinator/events/WorkforceSheetPage';
import ClientListPage from './pages/coordinator/clients/ClientListPage';
import AddClientPage from './pages/coordinator/clients/AddClientPage';
import ClientDetailPage from './pages/coordinator/clients/ClientDetailPage';
import VenueListPage from './pages/coordinator/venues/VenueListPage';
import AddVenuePage from './pages/coordinator/venues/AddVenuePage';
import VenueDetailPage from './pages/coordinator/venues/VenueDetailPage';
import StaffListPage from './pages/coordinator/staff/StaffListPage';
import AddStaffPage from './pages/coordinator/staff/AddStaffPage';
import StaffDetailPage from './pages/coordinator/staff/StaffDetailPage';
import AvailabilityGridPage from './pages/coordinator/staff/AvailabilityGridPage';
import TimesheetsPage from './pages/coordinator/timesheets/TimesheetsPage';
import EventTimesheetPage from './pages/coordinator/timesheets/EventTimesheetPage';
import PaymentsPage from './pages/coordinator/payments/PaymentsPage';
import InvoiceListPage from './pages/coordinator/invoices/InvoiceListPage';
import CreateInvoicePage from './pages/coordinator/invoices/CreateInvoicePage';
import InvoiceDetailPage from './pages/coordinator/invoices/InvoiceDetailPage';
import StaffPoolsPage from './pages/coordinator/pools/StaffPoolsPage';
import CoordinatorNotificationsPage from './pages/coordinator/notifications/NotificationsPage';
import ReportsPage from './pages/coordinator/reports/ReportsPage';
import IntegrationsPage from './pages/coordinator/settings/IntegrationsPage';
import M2FeatureSettingsPage from './pages/coordinator/settings/FeatureSettingsPage';
import EventTemplatesPage from './pages/coordinator/templates/EventTemplatesPage';
import UserManagementPage from './pages/coordinator/settings/UserManagementPage';

// Event staff pages
import EventStaffLoginPage from './pages/event-staff/LoginPage';
import EventStaffHomePage from './pages/event-staff/HomePage';
import AvailableEventsPage from './pages/event-staff/events/AvailableEventsPage';
import EventStaffEventDetailPage from './pages/event-staff/events/EventDetailPage';
import AssignmentsPage from './pages/event-staff/assignments/AssignmentsPage';
import CheckInPage from './pages/event-staff/assignments/CheckInPage';
import InvitationPage from './pages/event-staff/invitations/InvitationPage';
import EventStaffProfilePage from './pages/event-staff/ProfilePage';
import AvailabilityPage from './pages/event-staff/AvailabilityPage';
import StaffTimesheetsPage from './pages/event-staff/timesheets/TimesheetsPage';
import StaffNotificationsPage from './pages/event-staff/notifications/NotificationsPage';

// Event client portal pages
import EventClientHomePage from './pages/event-client/EventClientHomePage';
import EventClientEventsPage from './pages/event-client/EventClientEventsPage';
import EventClientEventDetailPage from './pages/event-client/EventClientEventDetailPage';
import EventClientInvoicesPage from './pages/event-client/EventClientInvoicesPage';
import EventClientInvoiceDetailPage from './pages/event-client/EventClientInvoiceDetailPage';
import EventClientProfilePage from './pages/event-client/EventClientProfilePage';

export default function App() {
  const { isInitializing, setAuth, setInitialized } = useAuthStore();
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    (async () => {
      try {
        const { data } = await apiClient.post<{ accessToken: string }>('/auth/refresh');
        setApiToken(data.accessToken);
        const user = await authApi.me();
        useAuthStore.setState({ user, accessToken: data.accessToken, isAuthenticated: true, isInitializing: false });
      } catch {
        setInitialized();
      }
    })();
  }, [setAuth, setInitialized]);

  if (isInitializing) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/event-staff/login" element={<EventStaffLoginPage />} />
      <Route path="/magic-login/:token" element={<MagicLoginPage />} />
      <Route path="/event-staff/invitations/:token" element={<InvitationPage />} />

      {/* Legal pages — public, no auth required */}
      <Route path="/impressum" element={<ImpressumPage />} />
      <Route path="/datenschutz" element={<DatenschutzPage />} />
      <Route path="/agb" element={<AgbPage />} />

      {/* Coordinator portal */}
      <Route element={<ProtectedRoute roles={['super_admin', 'coordinator', 'agency_admin', 'disponent']} />}>
        <Route path="/coordinator" element={<CoordinatorLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CoordinatorDashboardPage />} />
          <Route path="events" element={<EventListPage />} />
          <Route path="events/new" element={<CreateEventPage />} />
          <Route path="events/:id" element={<EventDetailPage />} />
          <Route path="events/:id/workforce" element={<WorkforceSheetPage />} />
          <Route path="clients" element={<ClientListPage />} />
          <Route path="clients/new" element={<AddClientPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="venues" element={<VenueListPage />} />
          <Route path="venues/new" element={<AddVenuePage />} />
          <Route path="venues/:venueId" element={<VenueDetailPage />} />
          <Route path="staff" element={<StaffListPage />} />
          <Route path="staff/new" element={<AddStaffPage />} />
          <Route path="staff/availability" element={<AvailabilityGridPage />} />
          <Route path="staff/:id" element={<StaffDetailPage />} />
          <Route path="pools" element={<StaffPoolsPage />} />
          <Route path="timesheets" element={<TimesheetsPage />} />
          <Route path="events/:id/timesheet" element={<EventTimesheetPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="notifications" element={<CoordinatorNotificationsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="invoices" element={<InvoiceListPage />} />
          <Route path="invoices/new" element={<CreateInvoicePage />} />
          <Route path="invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="templates" element={<EventTemplatesPage />} />
          <Route path="settings/users" element={<UserManagementPage />} />
          <Route path="settings/features" element={<M2FeatureSettingsPage />} />
          <Route path="settings/integrations" element={<IntegrationsPage />} />
        </Route>
      </Route>

      {/* Event staff portal */}
      <Route element={<ProtectedRoute roles={['event_staff']} />}>
        <Route path="/event-staff" element={<EventStaffLayout />}>
          <Route index element={<Navigate to="home" replace />} />
          <Route path="home" element={<EventStaffHomePage />} />
          <Route path="events" element={<AvailableEventsPage />} />
          <Route path="events/:id" element={<EventStaffEventDetailPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="assignments/:id/checkin" element={<CheckInPage />} />
          <Route path="timesheets" element={<StaffTimesheetsPage />} />
          <Route path="notifications" element={<StaffNotificationsPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="profile" element={<EventStaffProfilePage />} />
        </Route>
      </Route>

      {/* Event client portal */}
      <Route element={<ProtectedRoute roles={['event_client']} />}>
        <Route path="/event-client" element={<EventClientLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<EventClientHomePage />} />
          <Route path="events" element={<EventClientEventsPage />} />
          <Route path="events/:eventId" element={<EventClientEventDetailPage />} />
          <Route path="invoices" element={<EventClientInvoicesPage />} />
          <Route path="invoices/:invoiceId" element={<EventClientInvoiceDetailPage />} />
          <Route path="profile" element={<EventClientProfilePage />} />
        </Route>
      </Route>

      <Route path="/maintenance" element={<MaintenancePage />} />
      <Route path="/403" element={<UnauthorizedPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="/" element={<Navigate to="/coordinator/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
