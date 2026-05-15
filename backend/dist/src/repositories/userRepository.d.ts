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
declare const userRepository: {
    create(data: UserData): import(".prisma/client").Prisma.Prisma__UserClient<{
        name: string;
        email: string;
        password: string;
        profile_picture: string | null;
        profile_pictures: string[];
        profileDescriptor: import("@prisma/client/runtime/library").JsonValue | null;
        id: number;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findByEmail(email: string): import(".prisma/client").Prisma.Prisma__UserClient<{
        name: string;
        email: string;
        password: string;
        profile_picture: string | null;
        profile_pictures: string[];
        profileDescriptor: import("@prisma/client/runtime/library").JsonValue | null;
        id: number;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        name: string;
        email: string;
        password: string;
        profile_picture: string | null;
        profile_pictures: string[];
        profileDescriptor: import("@prisma/client/runtime/library").JsonValue | null;
        id: number;
    }[]>;
    findById(id: number): import(".prisma/client").Prisma.Prisma__UserClient<{
        name: string;
        email: string;
        password: string;
        profile_picture: string | null;
        profile_pictures: string[];
        profileDescriptor: import("@prisma/client/runtime/library").JsonValue | null;
        id: number;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findManyByIds(ids: number[]): import(".prisma/client").Prisma.PrismaPromise<{
        name: string;
        profile_picture: string | null;
        id: number;
    }[]>;
    updateById(id: number, data: UserUpdateData): import(".prisma/client").Prisma.Prisma__UserClient<{
        name: string;
        email: string;
        password: string;
        profile_picture: string | null;
        profile_pictures: string[];
        profileDescriptor: import("@prisma/client/runtime/library").JsonValue | null;
        id: number;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    deleteById(id: number): import(".prisma/client").Prisma.Prisma__UserClient<{
        name: string;
        email: string;
        password: string;
        profile_picture: string | null;
        profile_pictures: string[];
        profileDescriptor: import("@prisma/client/runtime/library").JsonValue | null;
        id: number;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    findUsersWithProfilePicture(): import(".prisma/client").Prisma.PrismaPromise<{
        name: string;
        email: string;
        profile_picture: string | null;
        profile_pictures: string[];
        profileDescriptor: import("@prisma/client/runtime/library").JsonValue;
        id: number;
    }[]>;
    findAllForRecognition(): import(".prisma/client").Prisma.PrismaPromise<{
        name: string;
        email: string;
        profile_picture: string | null;
        profile_pictures: string[];
        profileDescriptor: import("@prisma/client/runtime/library").JsonValue;
        id: number;
    }[]>;
};
export default userRepository;
//# sourceMappingURL=userRepository.d.ts.map