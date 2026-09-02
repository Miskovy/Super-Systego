import {Router} from 'express';
import { getThemeCategoryById, getAllThemeCategories, createThemeCategory, deleteThemeCategory, updateThemeCategory } from '../../controller/admin/ThemesCategoryController';
import { authenticated } from '../../middlewares/authenticated';
const router = Router();

router.get('/', getAllThemeCategories);
router.get('/:id', getThemeCategoryById);
router.post('/', createThemeCategory);
router.put('/:id', updateThemeCategory);
router.delete('/:id', deleteThemeCategory);

export default router;