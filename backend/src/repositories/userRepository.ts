import prisma from '../config/prisma';

interface UserData {
  name: string;
  email: string;
  password: string;
}

interface UserUpdateData {
  name?: string;
  email?: string;
  password?: string;
  profile_picture?: string;
  profile_pictures?: string[];
  profileDescriptor?: any;
}


const userRepository = {
  create(data: UserData) {
    return prisma.user.create({ data });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findAll() {
    return prisma.user.findMany({
      orderBy: { id: 'desc' },
    });
  },

  findById(id: number) {
    return prisma.user.findUnique({ where: { id } });
  },

  findManyByIds(ids: number[]) {
    return prisma.user.findMany({
      where: {
        id: { in: ids },
      },
      select: {
        id: true,
        name: true,
        profile_picture: true,
      },
    });
  },

  updateById(id: number, data: UserUpdateData) {
    return prisma.user.update({
      where: { id },
      data,
    });
  },

  deleteById(id: number) {
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
        profile_pictures: true,
        profileDescriptor: true,
      },
    });
  },

  // Returns ALL users — used for building recognition model from tagged photos
  // even users without profile pictures (they get bootstrapped from manual tags)
  findAllForRecognition() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        profile_picture: true,
        profile_pictures: true,
        profileDescriptor: true,
      },
      orderBy: { id: 'asc' },
    });
  },
};

export default userRepository;
