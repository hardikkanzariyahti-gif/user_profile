const userRepository = require('../repositories/userRepository');
const { validateLoginInput } = require('../validators/userValidators');
const { toUserResponse } = require('../utils/serializers');
const httpError = require('../utils/httpError');

const authService = {
  async login(body) {
    const { email, password } = validateLoginInput(body);

    const user = await userRepository.findByEmail(email);
    if (!user || user.password !== password) {
      throw httpError(401, 'Invalid email or password');
    }

    return {
      message: 'Login successful',
      user: toUserResponse(user),
    };
  },
};

module.exports = authService;
