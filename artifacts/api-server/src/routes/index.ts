import { Router, type IRouter } from "express";
import healthRouter from "./health";
import proxyRouter from "./proxy";
import movieboxRouter from "./moviebox";
import fzmoviesRouter from "./fzmovies";

const router: IRouter = Router();

router.use(healthRouter);
router.use(proxyRouter);
router.use("/moviebox", movieboxRouter);
router.use("/fzmovies", fzmoviesRouter);

export default router;
