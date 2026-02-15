import { Router } from 'express';
import { view, create, modify, delete_item,getById } from '../../controller/admin/PackageController';
// import { authenticated } from '../../middlewares/authenticated';
import { catchAsync } from '../../utils/catchAsync';
 import { authenticated } from '../../middlewares/authenticated';

export const PackageRouter = Router();

PackageRouter.use(authenticated)


PackageRouter.get('/', catchAsync(view));
PackageRouter.get('/:id', catchAsync(getById))
PackageRouter.post('/add', catchAsync(create));
PackageRouter.put('/update/:id', catchAsync(modify));
PackageRouter.delete('/delete_item/:id', catchAsync(delete_item));

export default PackageRouter;


