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
    profileDescriptor?: any;
}
declare const userRepository: {
    create(data: UserData): Promise<any>;
    findByEmail(email: string): Promise<any>;
    findAll(): Promise<any[]>;
    findById(id: number): Promise<any>;
    findManyByIds(ids: number[]): Promise<any[]>;
    updateById(id: number, data: UserUpdateData): Promise<any>;
    deleteById(id: number): Promise<void>;
    findUsersWithProfilePicture(): Promise<any[]>;
    findAllForRecognition(): Promise<any[]>;
};
export default userRepository;
//# sourceMappingURL=userRepository.d.ts.map