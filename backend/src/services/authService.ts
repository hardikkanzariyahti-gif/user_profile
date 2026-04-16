import userRepository from '../repositories/userRepository';
import { validateLoginInput } from '../validators/userValidators';
import { toUserResponse } from '../utils/serializers';
import httpError from '../utils/httpError';

const authService = {
  async login(body: any) {
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

export default authService;
