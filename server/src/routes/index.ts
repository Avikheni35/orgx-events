import { Router } from 'express';
import { resolveTenant } from '../middleware/tenant';
import { requireModule } from '../middleware/requireModule';
import authRoutes from './auth';
import eventClientRoutes from './eventClients';
import venueRoutes from './venues';
import eventRoutes from './events';
import staffProfileRoutes from './staffProfiles';
import assignmentRoutes from './assignments';
import timesheetRoutes from './timesheets';
import invoiceRoutes from './invoices';
import paymentRoutes from './payments';
import notificationRoutes from './notifications';
import staffPoolRoutes from './staffPools';
import eventApplicationRoutes from './eventApplications';
import staffAvailabilityRoutes from './staffAvailability';
import staffRatingRoutes from './staffRatings';
import eventClientPortalRoutes from './eventClientPortal';
import integrationRoutes from './integrations';
import settingsRoutes from './settings';
import internalRoutes from './internal';
import eventTemplateRoutes from './eventTemplates';
import userManagementRoutes from './userManagement';

const router = Router();

// Internal service-to-service routes — no tenant middleware, token-gated by requireServiceToken
router.use('/internal', internalRoutes);

router.use(resolveTenant);
router.use('/auth', authRoutes);        // auth is always reachable — no module gate
router.use(requireModule('m2'));        // all data routes below require M2 to be enabled
router.use('/event-clients', eventClientRoutes);
router.use('/venues', venueRoutes);
router.use('/events', eventRoutes);
router.use('/staff-profiles', staffProfileRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/timesheets', timesheetRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/staff-pools', staffPoolRoutes);
router.use('/event-applications', eventApplicationRoutes);
router.use('/staff-availability', staffAvailabilityRoutes);
router.use('/staff-ratings', staffRatingRoutes);
router.use('/event-client-portal', eventClientPortalRoutes);
router.use('/settings/integrations', integrationRoutes);
router.use('/settings', settingsRoutes);
router.use('/event-templates', eventTemplateRoutes);
router.use('/users', userManagementRoutes);

export default router;
