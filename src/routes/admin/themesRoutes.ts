import { Router } from 'express';
import { getAllThemes, getThemeById, createTheme, updateTheme, deleteTheme } from '../../controller/admin/themesController';
import { createThemeValidator, updateThemeValidator } from '../../validation/admin/themesValidator';
import { validate } from '../../middlewares/validation';
 import { authenticated } from '../../middlewares/authenticated';
const router = Router();
router.use(authenticated);

router.get('/', getAllThemes);
router.get('/:id', getThemeById);
router.post('/', validate(createThemeValidator), createTheme);
router.put('/:id', validate(updateThemeValidator), updateTheme);
router.delete('/:id', deleteTheme);

export default router;
