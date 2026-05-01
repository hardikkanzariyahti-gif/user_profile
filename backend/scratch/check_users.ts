import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.user.findMany().then(users => {
  console.log(JSON.stringify(users.map(u => ({id: u.id, name: u.name, profile_picture: u.profile_picture})), null, 2));
  prisma.$disconnect();
});
