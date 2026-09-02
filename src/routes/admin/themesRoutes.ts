import { Router } from 'express';
import { getAllThemes, getThemeById, createTheme, updateTheme, deleteTheme, bulkCreateThemes, getThemeBySlug } from '../../controller/admin/themesController';
import { authenticated } from '../../middlewares/authenticated';
const router = Router();

router.get('/', getAllThemes);
router.get('/:id', getThemeById);
router.get('/slug/:slug', getThemeBySlug);
router.post('/', createTheme);
router.post('/bulk', bulkCreateThemes);
router.put('/:id', updateTheme);
router.delete('/:id', deleteTheme);

export default router;
