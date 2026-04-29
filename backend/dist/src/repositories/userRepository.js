"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_1 = __importDefault(require("../../supabase"));
const mapUser = (user) => {
    if (!user)
        return user;
    const mapped = { ...user };
    if (user["profile picture"] !== undefined) {
        mapped.profile_picture = user["profile picture"];
    }
    if (user["profile_descriptor"] !== undefined) {
        mapped.profileDescriptor = user["profile_descriptor"];
    }
    return mapped;
};
const userRepository = {
    async create(data) {
        const { data: created, error } = await supabase_1.default
            .from('users')
            .insert(data)
            .select()
            .single();
        if (error)
            throw error;
        return mapUser(created);
    },
    async findByEmail(email) {
        const { data, error } = await supabase_1.default
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        if (error && error.code !== 'PGRST116')
            throw error;
        return mapUser(data) || null;
    },
    async findAll() {
        const { data, error } = await supabase_1.default
            .from('users')
            .select('*')
            .order('id', { ascending: false });
        if (error)
            throw error;
        return data.map(mapUser);
    },
    async findById(id) {
        const { data, error } = await supabase_1.default
            .from('users')
            .select('*')
            .eq('id', id)
            .single();
        if (error && error.code !== 'PGRST116')
            throw error;
        return mapUser(data) || null;
    },
    async findManyByIds(ids) {
        const { data, error } = await supabase_1.default
            .from('users')
            .select('id, name, "profile picture"')
            .in('id', ids);
        if (error)
            throw error;
        return data.map(mapUser);
    },
    async updateById(id, data) {
        const dbData = { ...data };
        if (data.profile_picture !== undefined) {
            dbData["profile picture"] = data.profile_picture;
            delete dbData.profile_picture;
        }
        if (data.profileDescriptor !== undefined) {
            dbData["profile_descriptor"] = data.profileDescriptor;
            delete dbData.profileDescriptor;
        }
        const { data: updated, error } = await supabase_1.default
            .from('users')
            .update(dbData)
            .eq('id', id)
            .select()
            .single();
        if (error)
            throw error;
        return mapUser(updated);
    },
    async deleteById(id) {
        const { error } = await supabase_1.default
            .from('users')
            .delete()
            .eq('id', id);
        if (error)
            throw error;
    },
    async findUsersWithProfilePicture() {
        const { data, error } = await supabase_1.default
            .from('users')
            .select('id, name, email, "profile picture", profile_descriptor')
            .not('"profile picture"', 'is', null);
        if (error)
            throw error;
        return data.map(mapUser);
    },
    async findAllForRecognition() {
        const { data, error } = await supabase_1.default
            .from('users')
            .select('id, name, email, "profile picture", profile_descriptor')
            .order('id', { ascending: true });
        if (error)
            throw error;
        return data.map(mapUser);
    },
};
exports.default = userRepository;
//# sourceMappingURL=userRepository.js.map