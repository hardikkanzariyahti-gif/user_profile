"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = __importDefault(require("../../supabase"));
const mapItem = (item) => {
    if (!item)
        return item;
    const mapped = { ...item };
    if (item.face_descriptors !== undefined) {
        mapped.faceDescriptors = item.face_descriptors;
    }
    return mapped;
};
const mapToDb = (data) => {
    const dbData = { ...data };
    if (data.faceDescriptors !== undefined) {
        dbData.face_descriptors = data.faceDescriptors;
        delete dbData.faceDescriptors;
    }
    return dbData;
};
const galleryRepository = {
    async findAll() {
        const { data, error } = await supabase_1.default
            .from('gallery')
            .select('*')
            .order('uploadedAt', { ascending: false });
        if (error)
            throw error;
        return data.map(mapItem);
    },
    async findById(id) {
        const { data, error } = await supabase_1.default
            .from('gallery')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            throw error;
        return mapItem(data);
    },
    async findByHashtag(tag) {
        const { data, error } = await supabase_1.default
            .from('gallery')
            .select('*')
            .contains('hashtags', [tag])
            .order('uploadedAt', { ascending: false });
        if (error)
            throw error;
        return data.map(mapItem);
    },
    async updateById(id, data) {
        const { data: updated, error } = await supabase_1.default
            .from('gallery')
            .update(mapToDb(data))
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        return mapItem(updated);
    },
    async createMany(items) {
        const { data, error } = await supabase_1.default
            .from('gallery')
            .insert(items.map(mapToDb))
            .select();
        if (error)
            throw error;
        return data.map(mapItem);
    },
    async createOne(data) {
        const { data: created, error } = await supabase_1.default
            .from('gallery')
            .insert(mapToDb(data))
            .select()
            .single();
        if (error)
            throw error;
        return mapItem(created);
    },
    async deleteById(id) {
        const { error } = await supabase_1.default
            .from('gallery')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
    },
};
exports.default = galleryRepository;
//# sourceMappingURL=galleryRepository.js.map