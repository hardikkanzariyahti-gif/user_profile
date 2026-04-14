const prisma = require('../config/prisma');

const galleryRepository = {
  findAll() {
    return prisma.galleryItem.findMany({
      orderBy: { uploadedAt: 'desc' },
    });
  },

  createMany(items) {
    return prisma.galleryItem.createMany({ data: items });
  },

  createOne(data) {
    return prisma.galleryItem.create({ data });
  },
};

module.exports = galleryRepository;
