import { Router } from 'express';
import {
    getAllClients, getClientById, createClient,
    updateClient, deleteClient, select, rebuildClientFrontend, deployClientBackend, viewSelection, regenerateClientEnv, installClientSsl,
    regenerateApiKey, generateApiKeysForExistingClients
} from '../../controller/admin/ClientController';
import { installClientDependencies, diagnoseClient, testSslInstallation } from '../../utils/ClientProvisioner';
import { createClientValidator, updateClientValidator } from '../../validation/admin/clientValidator';
import { validate } from '../../middlewares/validation';
import { authenticated } from '../../middlewares/authenticated';
const router = Router();

router.use(authenticated);


router.get('/select', select);
router.get('/selectionpackages', viewSelection);
router.post('/generate-all-api-keys', generateApiKeysForExistingClients);
router.get('/', getAllClients);
router.get('/:id', getClientById);
router.post('/', validate(createClientValidator), createClient);
router.put('/:id', validate(updateClientValidator), updateClient);
router.delete('/:id', deleteClient);
router.post('/:id/rebuild-frontend', rebuildClientFrontend);
router.post('/:id/deploy-backend', deployClientBackend);
router.post('/:id/regenerate-env', regenerateClientEnv);
router.post('/:id/install-ssl', installClientSsl);
router.post('/:id/install-dependencies', installClientDependencies);
router.post('/:id/regenerate-api-key', regenerateApiKey);
router.post('/diagnose', diagnoseClient);
router.post('/diagnose-ssl', testSslInstallation);

export default router;

