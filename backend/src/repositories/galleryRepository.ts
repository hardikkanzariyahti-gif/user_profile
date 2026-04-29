import supabase from '../../supabase';

interface GalleryItemData {
  url: string;
  uploadedAt: Date;
  label?: string;
  isProfile?: boolean;
  userId?: number | null;
  recognizedUserIds: number[];
  faceDescriptors?: any;
}

const mapItem = (item: any) => {
  if (!item) return item;
  const mapped = { ...item };
  if (item.face_descriptors !== undefined) {
    mapped.faceDescriptors = item.face_descriptors;
  }
  return mapped;
};

const mapToDb = (data: any) => {
  const dbData = { ...data };
  if (data.faceDescriptors !== undefined) {
    dbData.face_descriptors = data.faceDescriptors;
    delete dbData.faceDescriptors;
  }
  return dbData;
};

const galleryRepository = {
  async findAll() {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .order('uploadedAt', { ascending: false });
    if (error) throw error;
    return data.map(mapItem);
  },

  async findById(id: number) {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return mapItem(data);
  },

  async findByHashtag(tag: string) {
    const { data, error } = await supabase
      .from('gallery')
      .select('*')
      .contains('hashtags', [tag])
      .order('uploadedAt', { ascending: false });
    if (error) throw error;
    return data.map(mapItem);
  },

  async updateById(id: number, data: any) {
    const { data: updated, error } = await supabase
      .from('gallery')
      .update(mapToDb(data))
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapItem(updated);
  },

  async createMany(items: GalleryItemData[]) {
    const { data, error } = await supabase
      .from('gallery')
      .insert(items.map(mapToDb))
      .select();
    if (error) throw error;
    return data.map(mapItem);
  },

  async createOne(data: GalleryItemData) {
    const { data: created, error } = await supabase
      .from('gallery')
      .insert(mapToDb(data))
      .select()
      .single();
    if (error) throw error;
    return mapItem(created);
  },

  async deleteById(id: number) {
    const { error } = await supabase
      .from('gallery')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

export default galleryRepository;

