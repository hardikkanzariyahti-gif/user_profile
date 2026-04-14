const prisma = require('../config/prisma');

const userRepository = {
  create(data) {
    return prisma.user.create({ data });
  },

  findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  findAll() {
    return prisma.user.findMany({
      orderBy: { id: 'desc' },
    });
  },

  findById(id) {
    return prisma.user.findUnique({ where: { id } });
  },

  updateById(id, data) {
    return prisma.user.update({
      where: { id },
      data,
    });
  },

  deleteById(id) {
    return prisma.user.delete({ where: { id } });
  },

  findUsersWithProfilePicture() {
    return prisma.user.findMany({
      where: {
        profile_picture: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        profile_picture: true,
      },
    });
  },
};

module.exports = userRepository;
