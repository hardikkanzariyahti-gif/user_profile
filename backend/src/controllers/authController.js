const authService = require('../services/authService');

const authController = {
  async login(req, res) {
    const result = await authService.login(req.body);
    res.json(result);
  },
};

module.exports = authController;
