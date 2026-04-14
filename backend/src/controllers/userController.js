const userService = require('../services/userService');

const userController = {
  async create(req, res) {
    const user = await userService.createUser(req.body);
    res.json(user);
  },

  async list(req, res) {
    const users = await userService.listUsers();
    res.json(users);
  },

  async getById(req, res) {
    const user = await userService.getUserById(req.params.id);
    res.json(user);
  },

  async update(req, res) {
    const user = await userService.updateUser(req.params.id, req.body, req.file);
    res.json(user);
  },

  async remove(req, res) {
    const result = await userService.deleteUser(req.params.id);
    res.json(result);
  },
};

module.exports = userController;
