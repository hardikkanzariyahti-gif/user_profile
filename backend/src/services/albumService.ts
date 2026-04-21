import albumRepository from '../repositories/albumRepository';

const albumService = {
  async createAlbum(data: { title: string; description?: string; userId: number; itemIds: number[]; isGlobal?: boolean }) {
    if (!data.title) throw new Error('Album title is required');
    if (!data.itemIds || data.itemIds.length === 0) throw new Error('At least one photo is required to create an album');
    
    return albumRepository.create(data);
  },

  async getAlbumsByUser(userId: number) {
    return albumRepository.findAllByUserId(userId);
  },

  async getAlbumById(id: number, userId: number) {
    const album = await albumRepository.findById(id);
    if (!album) throw new Error('Album not found');
    if (album.userId !== userId && !album.isGlobal) throw new Error('Unauthorized access to album');
    return album;
  },

  async getSharedAlbum(shareId: string) {
    const album = await albumRepository.findByShareId(shareId);
    if (!album) throw new Error('Shared album not found');
    return album;
  },

  async deleteAlbum(id: number, userId: number) {
    const album = await albumRepository.findById(id);
    if (!album) throw new Error('Album not found');
    if (album.userId !== userId) throw new Error('Unauthorized to delete this album');
    
    return albumRepository.delete(id);
  },

  async updateAlbum(id: number, userId: number, data: { title?: string; description?: string; itemIds?: number[] }) {
    const album = await albumRepository.findById(id);
    if (!album) throw new Error('Album not found');
    if (album.userId !== userId) throw new Error('Unauthorized to update this album');

    return albumRepository.update(id, data);
  },
};

export default albumService;
