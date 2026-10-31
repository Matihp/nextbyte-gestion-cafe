const { Router } = require('express');
const authController = require('../controllers/authController');
const { authRequired } = require('../middlewares/authRequired');
const validate = require('../middlewares/validate');
const { validarLogin } = require('../dtos/auth.dto');

const router = Router();

router.post('/login', validate(validarLogin), authController.login);
router.get('/me', authRequired, authController.me);

module.exports = router;
