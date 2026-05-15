import { PrismaClient } from '@prisma/client';
declare const prisma: PrismaClient<{
    datasources: {
        db: {
            url: string | undefined;
        };
    };
    log: ("warn" | "error")[];
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
export default prisma;
//# sourceMappingURL=prisma.d.ts.map