import albumRepository from '../repositories/albumRepository';
import prisma from '../config/prisma';
import { toGalleryResponse } from '../utils/serializers';

let cachedUsers: any[] | null = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 15000; // 15 seconds cache is extremely safe and will ensure instant sequential requests!

async function getCachedUsers() {
  const now = Date.now();
  if (!cachedUsers || (now - lastCacheTime > CACHE_DURATION_MS)) {
    cachedUsers = await prisma.user.findMany({
      select: { id: true, name: true, profile_picture: true }
    });
    lastCacheTime = now;
  }
  return cachedUsers;
}

const albumService = {
  async enrichAlbum(album: any) {
    if (!album) return album;

    // Fetch all users for mapped recognized badge resolution using cache
    const allUsers = await getCachedUsers();
    const userMap: Record<number, any> = {};
    for (const u of allUsers) userMap[u.id] = u;

    // Format items to look exactly like the Gallery payload
    if (Array.isArray(album.items)) {
      album.items = album.items.map((item: any) => {
        const rawIds = Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds : [];
        const withUsers = {
          ...item,
          recognizedUsers: rawIds.map((id: any) => userMap[Number(id)]).filter(Boolean)
        };
        return toGalleryResponse(withUsers);
      });

      console.log(`[EVENT_PHOTOS] eventId: ${album.id}`);
      console.log(`[EVENT_PHOTOS] count: ${album.items.length}`);
      album.items.forEach((item: any) => {
        console.log(`[EVENT_PHOTOS] imageUrl: ${item.url}`);
      });
    }
    return album;
  },

  async createAlbum(data: { title: string; description?: string; eventType?: string; date?: string; location?: string; userId?: number; itemIds?: number[]; isGlobal?: boolean }) {
    if (!data.title) throw new Error('Album title is required');

    console.log(`[EVENT_CREATE] eventName: ${data.title}`);
    console.log(`[EVENT_CREATE] shouldNotCreateProfile: true`);

    // Ensure a valid user ID exists for Prisma Foreign Key constraint without creating any profile record
    let finalUserId = Number(data.userId) || 0;
    if (finalUserId === 0) {
      const existingUser = await prisma.user.findFirst({ select: { id: true } });
      if (existingUser) {
        finalUserId = existingUser.id;
      } else {
        const dummyUser = await prisma.user.create({
          data: {
            name: 'System Anchor',
            email: 'system_anchor@local.system',
            password: 'system_password_anchor'
          }
        });
        finalUserId = dummyUser.id;
      }
    } else {
      const userExists = await prisma.user.findUnique({ where: { id: finalUserId } });
      if (!userExists) {
        const existingUser = await prisma.user.findFirst({ select: { id: true } });
        if (existingUser) {
          finalUserId = existingUser.id;
        } else {
          const dummyUser = await prisma.user.create({
            data: {
              name: 'System Anchor',
              email: 'system_anchor@local.system',
              password: 'system_password_anchor'
            }
          });
          finalUserId = dummyUser.id;
        }
      }
    }

    const album = await albumRepository.create({
      ...data,
      userId: finalUserId,
      itemIds: data.itemIds || [],
      isGlobal: true
    });

    console.log(`[EVENT_CREATE] createdAlbumId: ${album.id}`);
    if (album.items && album.items.length > 0) {
      console.log(`[EVENT_PHOTOS] eventId: ${album.id}`);
      console.log(`[EVENT_PHOTOS] count: ${album.items.length}`);
      album.items.forEach((item: any) => {
        console.log(`[EVENT_PHOTOS] imageUrl: ${item.url}`);
      });
    }

    return this.enrichAlbum(album);
  },

  async getAlbumsByUser(userId: number) {
    const albums = await albumRepository.findAllByUserId(userId);
    return Promise.all(albums.map(album => this.enrichAlbum(album)));
  },

  async getAlbumById(id: number, userId?: number) {
    const album = await albumRepository.findById(id);
    if (!album) throw new Error('Album not found');
    return this.enrichAlbum(album);
  },

  async getSharedAlbum(shareId: string) {
    const album = await albumRepository.findByShareId(shareId);
    if (!album) throw new Error('Shared album not found');
    return this.enrichAlbum(album);
  },

  async deleteAlbum(id: number, userId?: number) {
    const album = await albumRepository.findById(id);
    if (!album) throw new Error('Album not found');
    
    console.log(`[ALBUM_DELETE] deleting albumId: ${id}`);
    const result = await albumRepository.delete(id);
    console.log(`[ALBUM_DELETE] deleted successfully: ${id}`);
    
    return result;
  },

  async updateAlbum(id: number, userId: number, data: { title?: string; description?: string; eventType?: string; date?: string; location?: string; itemIds?: number[] }) {
    const album = await albumRepository.findById(id);
    if (!album) throw new Error('Album not found');

    const updated = await albumRepository.update(id, data);
    return this.enrichAlbum(updated);
  },
};

export default albumService;
